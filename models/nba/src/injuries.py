import hashlib
import re
from datetime import datetime
from zoneinfo import ZoneInfo
import pandas as pd
import pdfplumber
from .storage import Client
from .sources import record_raw
from .vendor.nbainjuries._util import _gen_url, _validate_headers, __clean_injrep
from . import db
from .pit import known_by,timestamp

STATUSES={'AVAILABLE','PROBABLE','QUESTIONABLE','DOUBTFUL','OUT'}

def normalize_status(text):
    status=str(text).strip().upper()
    if status not in STATUSES:
        raise ValueError(f'Unknown injury status: {text}')
    return status

def eligible_snapshots(rows, cutoff):
    selected={}
    for r in rows:
        if known_by(r['report_time'],cutoff) and r['game_id'] and r['player_id']:
            key=(r['game_id'],r['player_id'])
            if key not in selected or timestamp(r['report_time'])>timestamp(selected[key]['report_time']) or (timestamp(r['report_time'])==timestamp(selected[key]['report_time']) and r.get('parser_version',1)>selected[key].get('parser_version',1)):
                selected[key]=r
    return list(selected.values())

def header_bounds(words):
    labels=['GameDate','GameTime','Matchup','Team','PlayerName','CurrentStatus','Reason']
    lines={}
    for word in words:
        lines.setdefault(round(word['top'],1),[]).append(word)
    for line in lines.values():
        line=sorted(line,key=lambda w:w['x0'])
        if ''.join(w['text'] for w in line).replace(' ','')!=''.join(labels):
            continue
        bounds=[];cursor=0
        for label in labels:
            bounds.append(line[cursor]['x0']-2)
            value=''
            while value!=label and cursor<len(line):
                value+=line[cursor]['text'].replace(' ','');cursor+=1
            if value!=label:
                raise ValueError('Unrecognized official PDF header')
        return bounds
    raise ValueError('Unrecognized official PDF column layout')


def parse_pdf(path):
    from bisect import bisect_right
    frames=[]
    with pdfplumber.open(path) as pdf:
        bounds=header_bounds(pdf.pages[0].extract_words())
        for page in pdf.pages:
            lines=[]
            for word in sorted(page.extract_words(),key=lambda w:(round(w['top'],1),w['x0'])):
                if not lines or abs(lines[-1][0]-word['top'])>2:
                    lines.append((word['top'],[]))
                lines[-1][1].append(word)
            records=[]
            for _,words in lines:
                text=' '.join(w['text'] for w in words)
                if 'Injury Report:' in text or re.search(r'Page\s*\d',text) or 'GameDate' in text.replace(' ','') or 'CurrentStatus' in text.replace(' ',''):
                    continue
                cells=[[] for _ in range(7)]
                for word in words:
                    col=max(0,min(6,bisect_right(bounds,word['x0']+.5)-1))
                    cells[col].append(word['text'])
                records.append([' '.join(c) or None for c in cells])
            df=pd.DataFrame(records,columns=['Game Date','Game Time','Matchup','Team','Player Name','Current Status','Reason'])
            _validate_headers(df)
            df['LastonPgBoundary']=False
            if not df.empty:
                df.loc[df.index[-1],'LastonPgBoundary']=True
                frames.append(df)
    if not frames:
        raise ValueError('Unrecognized official PDF layout; retain raw report for review')
    result=__clean_injrep(pd.concat(frames,ignore_index=True))
    return result.where(result.notna(),None).to_dict('records')

def ingest_report(timestamp):
    stamp=datetime.fromisoformat(timestamp)
    if stamp.tzinfo is None:
        raise ValueError('Report timestamp requires a timezone offset')
    local=stamp.astimezone(ZoneInfo('America/New_York')).replace(tzinfo=None)
    url=_gen_url(local)
    report_time=stamp.astimezone(ZoneInfo('UTC')).isoformat()
    e=db.engine()
    with e.begin() as conn:
        path,receipt=Client().get(url,'official_nba_injury',True)
        record_raw(conn,'injury_reports',receipt)
        with pdfplumber.open(path) as pdf:
            header=pdf.pages[0].extract_text() or ''
        match=re.search(r'Injury Report:\s*(\d{2}/\d{2}/\d{2})\s+(\d{2}:\d{2}\s*[AP]M)',header)
        if not match:
            raise ValueError('No authoritative publication timestamp in PDF header')
        report_time=datetime.strptime(match[1]+' '+match[2],'%m/%d/%y %I:%M %p').replace(tzinfo=ZoneInfo('America/New_York')).astimezone(ZoneInfo('UTC')).isoformat()
        try:
            records=parse_pdf(path)
        except ValueError as exc:
            db.derived(conn,'quality_issues','injury:'+receipt['payload_hash'],{'error':str(exc),'source':url})
            return {'parsed':0,'unresolved':0,'issue':str(exc)}
        players=db.rows(conn,'players');games=db.game_index(conn);teams=db.rows(conn,'teams')
        unresolved=0
        for i,r in enumerate(records):
            name=str(r['Player Name'] or '')
            if ',' in name:
                last,first=name.split(',',1);name=first.strip()+' '+last.strip()
            normalized=lambda s:re.sub(r'\W','',s).casefold()
            ids=[p['player_id'] for p in players if normalized(p['payload']['name'] or '')==normalized(name)]
            tids=[t['team_id'] for t in teams if normalized((t['payload'].get('city') or '')+' '+(t['payload'].get('name') or ''))==normalized(r['Team'] or '')]
            date=pd.to_datetime(r['Game Date'],errors='coerce')
            possible=[g for g in games if len(tids)==1 and tids[0] in (g['home_team_id'],g['away_team_id']) and not pd.isna(date)
                      and pd.Timestamp(g['start_time']).tz_convert('America/New_York').date()==date.date()]
            if len(ids)!=1 or len(possible)!=1:
                unresolved+=1
                db.derived(conn,'quality_issues',f"injury-map:{receipt['payload_hash']}:{i}",{'row':r,'error':'Unresolved canonical identity; not used'})
                continue
            row=dict(game_id=possible[0]['game_id'],player_id=ids[0],team_id=tids[0],player_name=name,
                     status=normalize_status(r['Current Status']),reason=r['Reason'],report_time=report_time,source=url,
                     raw_payload_hash=receipt['payload_hash'],parser_version=3)
            db.derived(conn,'injury_snapshots',f"v3:{receipt['payload_hash']}:{row['game_id']}:{ids[0]}",row,game_id=row['game_id'],
                       player_id=ids[0],team_id=tids[0],captured_at=receipt['requested_at'],as_of_date=report_time)
        return {'parsed':len(records),'unresolved':unresolved}

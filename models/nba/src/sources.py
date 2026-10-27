"""Versioned public adapters. A failed source remains a recorded failure."""
import hashlib
import io
import json
import tarfile
import requests
import pandas as pd
from urllib.parse import urlencode
from .config import DATA, PINS
from .storage import Client, utcnow
from . import db

NBA_STATS = ('boxscoretraditionalv3','boxscoreadvancedv3','boxscorefourfactorsv3',
             'boxscoremiscv3','playbyplayv3','gamerotation','leaguedashlineups',
             'teamplayeronoffsummary','leaguedashteamstats')

def record_raw(conn, kind, receipt):
    rid = hashlib.sha256(json.dumps(receipt,sort_keys=True).encode()).hexdigest()
    db.put(conn, 'raw_'+kind, dict(id=rid, payload_hash=receipt['payload_hash'], source=receipt['source'],
        endpoint=receipt['endpoint'], requested_at=receipt['requested_at'], payload=receipt), immutable=True)

class NBA:
    def __init__(self, client=None):
        self.client = client or Client()

    def archive(self, season, kind, conn):
        repo, rev = PINS['nba_data']
        url = f'https://raw.githubusercontent.com/{repo}/{rev}/datasets/{kind}_{season}.tar.xz'
        try:
            path, receipt = self.client.get(url, 'nba_archive', True)
        except requests.RequestException:
            path, receipt = self.client.get(url+'?download=1','nba_archive',True)
        record_raw(conn,'nba_payloads',receipt)
        with tarfile.open(path, mode='r:xz') as archive:
            members = [m for m in archive.getmembers() if m.isfile() and m.name.endswith('.csv')]
            if len(members) != 1:
                raise ValueError('Unexpected archive members')
            # Read a stream, never extract untrusted paths onto disk.
            return pd.read_csv(archive.extractfile(members[0]), low_memory=False)

    def stats(self, endpoint, game_id, conn, **params):
        if endpoint not in NBA_STATS:
            raise ValueError('Unsupported NBA endpoint')
        query = {'GameID':game_id, 'StartPeriod':0, 'EndPeriod':0, 'RangeType':0,
                 'StartRange':0, 'EndRange':0, **params}
        path, receipt = self.client.get('https://stats.nba.com/stats/'+endpoint+'?'+urlencode(query),'nba_stats')
        record_raw(conn,'nba_payloads',receipt)
        return json.loads(path.read_text()), receipt

    def box(self, game_id, conn):
        url=f'https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{game_id}.json'
        path, receipt = self.client.get(url,'nba_live_box')
        record_raw(conn,'nba_payloads',receipt)
        box=json.loads(path.read_text())['game']
        if str(box['gameId']).zfill(10) != game_id:
            raise ValueError('Box-score identity mismatch')
        return box, receipt

def clean(value):
    if pd.isna(value):
        return None
    if hasattr(value,'item'):
        return value.item()
    return value

def elapsed(clock, period):
    minutes, seconds = str(clock).split(':')
    length=720 if period<=4 else 300
    start=(period-1)*720 if period<=4 else 2880+(period-5)*300
    remaining=int(minutes)*60+float(seconds)
    if not 0<=remaining<=length:
        raise ValueError('Invalid event clock')
    return start+length-remaining

def normalize_game(frame, cdn, season):
    gid=str(int(frame.GAME_ID.iloc[0])).zfill(10)
    identities={}
    for role in (4,5):
        ids=set()
        for n in (1,2,3):
            ids.update(str(int(v)) for v in frame.loc[frame[f'PERSON{n}TYPE'].eq(role),f'PLAYER{n}_TEAM_ID'].dropna() if v>0)
        if len(ids)!=1:
            raise ValueError('Ambiguous canonical home/away identity')
        identities[role]=ids.pop()
    if identities[4]==identities[5]:
        raise ValueError('Same home and away team')
    if cdn.empty:
        raise ValueError('No trustworthy game timestamp; no fabricated date')
    timestamps=pd.to_datetime(cdn.timeActual, utc=True, errors='coerce').dropna()
    if timestamps.empty:
        raise ValueError('Missing event timestamps')
    events=[]
    home=away=0
    for r in frame.sort_values('EVENTNUM').to_dict('records'):
        p=int(r['PERIOD'])
        if pd.notna(r['SCORE']):
            # NBA V2 SCORE is visitor - home.
            a,h=[int(v.strip()) for v in r['SCORE'].split('-')]
            if a<away or h<home:
                raise ValueError('Score correction/reversal requires review')
            away,home=a,h
        events.append(dict(number=int(r['EVENTNUM']),period=p,second=elapsed(r['PCTIMESTRING'],p),
            kind=int(r['EVENTMSGTYPE']),subtype=int(r['EVENTMSGACTIONTYPE']),home_score=home,away_score=away,
            description=' '.join(str(r[k]) for k in ('HOMEDESCRIPTION','VISITORDESCRIPTION','NEUTRALDESCRIPTION') if pd.notna(r[k])),
            **{f'p{n}':int(r[f'PLAYER{n}_ID']) for n in (1,2,3)},
            **{f't{n}':str(int(r[f'PLAYER{n}_TEAM_ID'])) if pd.notna(r[f'PLAYER{n}_TEAM_ID']) else None for n in (1,2,3)}))
    last=cdn.sort_values('orderNumber').iloc[-1]
    if (home,away)!=(int(last.scoreHome),int(last.scoreAway)):
        raise ValueError('NBA archive score reconciliation failed')
    if not {1,2,3,4}.issubset({e['period'] for e in events}):
        raise ValueError('Incomplete regulation periods')
    return dict(game_id=gid,season=season,start_time=timestamps.min().isoformat(),completed_at=timestamps.max().isoformat(),
        home_team_id=identities[4],away_team_id=identities[5],status='final',
        payload=dict(events=events,home_score=home,away_score=away,source='pinned_nba_archive',
                     **halftime_provenance(cdn),
                     historical_semantics='retrospective event reconstruction; not an as-received live archive'))

def halftime_provenance(cdn):
    h1=cdn[cdn.period.le(2)].copy()
    ends=h1[h1.period.eq(2)&h1.actionType.eq('period')&h1.subType.eq('end')]
    if ends.empty:
        return {'halftime_eligible':False,'halftime_issue':'No Q2 end timestamp'}
    cutoff=pd.to_datetime(ends.timeActual,utc=True,errors='coerce').max()
    actual=pd.to_datetime(h1.timeActual,utc=True,errors='coerce')
    edited=pd.to_datetime(h1.edited,utc=True,errors='coerce')
    valid=not pd.isna(cutoff) and actual.notna().all() and edited.notna().all() and bool((actual<=cutoff).all()) and bool((edited<=cutoff).all())
    return {'halftime_eligible':bool(valid),'halftime_cutoff':None if pd.isna(cutoff) else cutoff.isoformat(),
            'h1_latest_edit':None if edited.dropna().empty else edited.max().isoformat(),
            'halftime_issue':None if valid else 'Missing knowledge timestamp or H1 events edited after halftime'}

def audit_halftime():
    e=db.engine();nba=NBA();summary={}
    from sqlalchemy import select
    with e.connect() as c:
        table=db.tables['games']
        games=[dict(r) for r in c.execute(select(*[col for col in table.c if col.name!='payload'])).mappings()]
    for season in sorted({g['season'] for g in games}):
        with e.begin() as c:
            cdn=nba.archive(season,'cdnnba',c)
        grouped={str(int(k)).zfill(10):v for k,v in cdn.groupby('gameId')}
        eligible=0;count=0
        with e.begin() as c:
            for g in games:
                if g['season']!=season:
                    continue
                audit=halftime_provenance(grouped[g['game_id']])
                g['payload']=c.execute(select(table.c.payload).where(table.c.game_id==g['game_id'])).scalar_one()
                g['payload'].update(audit);db.put(c,'games',g)
                g.pop('payload')
                count+=1;eligible+=int(audit['halftime_eligible'])
        summary[season]={'games':count,'strict_halftime_eligible':eligible,'excluded_late_or_missing_edits':count-eligible}
    (DATA/'reports').mkdir(exist_ok=True)
    (DATA/'reports/halftime_audit.json').write_text(json.dumps(summary,indent=2))
    return summary

def backfill_games(start, end, limit=None, boxes=False, refresh=False):
    nba=NBA()
    e=db.engine()
    summary={}
    with e.connect() as conn:
        known_teams={r['team_id'] for r in db.rows(conn,'teams')}
        known_players={r['player_id'] for r in db.rows(conn,'players')}
        from sqlalchemy import select
        existing=set(conn.execute(select(db.tables['games'].c.game_id)).scalars())
    for season in range(start,end+1):
        with e.begin() as conn:
            try:
                pbp=nba.archive(season,'nbastats',conn)
                cdn=nba.archive(season,'cdnnba',conn)
            except (requests.RequestException,ValueError,tarfile.TarError) as exc:
                db.derived(conn,'quality_issues',f'source:{season}',{'stage':'archive','error':str(exc)})
                summary[season]={'source_failed':str(exc)}
                continue
        grouped={int(k):v for k,v in cdn.groupby('gameId',sort=False)}
        valid=failed=skipped=0
        for i,(_,frame) in enumerate(pbp.groupby('GAME_ID',sort=True)):
            if limit is not None and i>=limit:
                break
            gid=str(int(frame.GAME_ID.iloc[0])).zfill(10)
            if gid in existing and not boxes and not refresh:
                skipped+=1
                continue
            with e.begin() as conn:
                try:
                    game=normalize_game(frame,grouped.get(int(gid),pd.DataFrame()),season)
                    for n in (1,2,3):
                        for _,r in frame.dropna(subset=[f'PLAYER{n}_TEAM_ID']).drop_duplicates(f'PLAYER{n}_TEAM_ID').iterrows():
                            tid=str(int(r[f'PLAYER{n}_TEAM_ID']))
                            if tid in known_teams:
                                continue
                            db.put(conn,'teams',dict(team_id=tid,payload={'abbreviation':clean(r[f'PLAYER{n}_TEAM_ABBREVIATION']),
                                   'city':clean(r[f'PLAYER{n}_TEAM_CITY']),'name':clean(r[f'PLAYER{n}_TEAM_NICKNAME'])}))
                            known_teams.add(tid)
                        for _,r in frame.loc[frame[f'PLAYER{n}_ID'].gt(0)].drop_duplicates(f'PLAYER{n}_ID').iterrows():
                            pid=str(int(r[f'PLAYER{n}_ID']))
                            if pid not in known_players:
                                db.put(conn,'players',dict(player_id=pid,payload={'name':clean(r[f'PLAYER{n}_NAME'])}))
                                known_players.add(pid)
                    db.put(conn,'games',game)
                    if boxes:
                        try:
                            box,receipt=nba.box(gid,conn)
                            for side in ('homeTeam','awayTeam'):
                                team=box[side]
                                if str(team['teamId']) not in (game['home_team_id'],game['away_team_id']):
                                    raise ValueError('Box-score team identity mismatch')
                                for player in team['players']:
                                    db.derived(conn,'player_game_stats',f"{gid}:{player['personId']}",player,
                                        game_id=gid,team_id=str(team['teamId']),player_id=str(player['personId']),captured_at=receipt['requested_at'])
                        except (requests.RequestException,ValueError,KeyError) as exc:
                            db.derived(conn,'quality_issues',gid+':box',{'stage':'official_box','error':str(exc)},game_id=gid)
                    valid+=1
                except (ValueError,KeyError,TypeError) as exc:
                    db.derived(conn,'quality_issues',gid+':normalize',{'stage':'normalize','error':str(exc)})
                    failed+=1
        summary[season]={'valid_games':valid,'existing_games_skipped':skipped,'quarantined_games':failed}
        print(json.dumps({'event':'season_complete','season':season,**summary[season]}),flush=True)
    return summary

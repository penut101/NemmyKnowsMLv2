"""ESPN/hoopR validation fallback; retain source IDs and strict crosswalk evidence."""
import re
import unicodedata
import pandas as pd
from sqlalchemy import select
from . import db
from .sources import record_raw, clean
from .storage import Client

ALIASES={'GS':'GSW','NY':'NYK','NO':'NOP','SA':'SAS','UTAH':'UTA','WSH':'WAS','PHO':'PHX','BKN':'BKN'}

def name_key(name):
    value=unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower()
    value=re.sub(r'\b(jr|sr|ii|iii|iv)\b','',value)
    return re.sub(r'[^a-z]','',value)

def ingest(season):
    client=Client()
    url=f'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/espn_nba_player_boxscores/player_box_{season+1}.parquet'
    path,receipt=client.get(url,'hoopr_espn_box',True)
    frame=pd.read_parquet(path)
    with db.engine().begin() as conn:
        record_raw(conn,'nba_payloads',receipt)
        table=db.tables['games']
        games=[dict(g) for g in conn.execute(select(*[c for c in table.c if c.name!='payload']).where(table.c.season==season)).mappings()]
        names={int(p['player_id']):p['payload']['name'] for p in db.rows(conn,'players')}
        teammap={t['payload']['abbreviation']:t['team_id'] for t in db.rows(conn,'teams')}
        lookup={}
        for g in games:
            key=(pd.Timestamp(g['start_time']).tz_convert('America/New_York').date(),g['home_team_id'],g['away_team_id'])
            lookup.setdefault(key,[]).append(g)
        accepted=unmapped=0
        for eid,group in frame.groupby('game_id'):
            first=group.iloc[0]
            h=group[group.home_away.eq('home')];a=group[group.home_away.eq('away')]
            if h.empty or a.empty:
                continue
            hid=teammap.get(ALIASES.get(h.iloc[0].team_abbreviation,h.iloc[0].team_abbreviation))
            aid=teammap.get(ALIASES.get(a.iloc[0].team_abbreviation,a.iloc[0].team_abbreviation))
            stamp=pd.Timestamp(first.game_date_time)
            stamp=stamp.tz_localize('UTC') if stamp.tzinfo is None else stamp.tz_convert('UTC')
            candidates=lookup.get((stamp.tz_convert('America/New_York').date(),hid,aid),[])
            if len(candidates)!=1:
                continue
            game=candidates[0];gid=game['game_id']
            game=dict(game,payload=conn.execute(select(table.c.payload).where(table.c.game_id==gid)).scalar_one())
            if abs((pd.Timestamp(game['start_time'])-stamp).total_seconds())>6*3600:
                continue
            if (int(h.iloc[0].team_score),int(a.iloc[0].team_score))!=(game['payload']['home_score'],game['payload']['away_score']):
                db.derived(conn,'quality_issues',gid+':fallback_score',{'error':'Independent final-score disagreement'},game_id=gid)
                continue
            db.put(conn,'source_game_mappings',dict(source='espn',external_id=str(eid),game_id=gid,
                payload={'home_team_id':hid,'away_team_id':aid,'scheduled_time':stamp.isoformat(),'score_verified':True}))
            candidates_by_team={tid:set(e[f'p{n}'] for e in game['payload']['events'] for n in (1,2,3)
                if e[f't{n}']==tid and e[f'p{n}']>0) for tid in (hid,aid)}
            for row in group.to_dict('records'):
                if pd.isna(row['minutes']) or row['minutes']<=0:
                    continue
                tid=hid if row['home_away']=='home' else aid
                ids=[p for p in candidates_by_team[tid] if name_key(names.get(p,''))==name_key(row['athlete_display_name'])]
                if len(ids)!=1:
                    unmapped+=1
                    db.derived(conn,'quality_issues',f"{gid}:player:{row['athlete_id']}",{'error':'Ambiguous player crosswalk','name':row['athlete_display_name']},game_id=gid)
                    continue
                payload={k:clean(v) for k,v in row.items() if k in ('minutes','starter','fouls','points','athlete_id','athlete_position_abbreviation')}
                payload.update(source='hoopr_espn_box',raw_payload_hash=receipt['payload_hash'],regulation_minutes=None)
                db.derived(conn,'player_game_stats',f'{gid}:{ids[0]}',payload,game_id=gid,team_id=tid,
                    player_id=str(ids[0]),captured_at=receipt['requested_at'])
                accepted+=1
        return {'player_rows':accepted,'unresolved_players':unmapped}

"""Bootstrap official fixtures, never predictions, odds, or historical decisions.

Use --source for replay of a saved response. --emit-sql-dir supports a reviewed
connector import; --write uses the same rows with target guarding and upserts.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys

import requests
import psycopg
from psycopg.types.json import Jsonb
from setup import ROOT, check_target

sys.path.insert(0, str(ROOT/'models/mlb'))
from backend.team_mappings import normalize_team, TEAM_ID_BY_CODE

IMPORT = """INSERT INTO mlb.games
 (game_pk,game_date,game_type,home_team,away_team,home_score,away_score,status,venue,start_time)
 SELECT game_pk,game_date,game_type,home_team,away_team,home_score,away_score,status,venue,start_time
 FROM jsonb_to_recordset(%s::jsonb) AS x(game_pk integer,game_date date,game_type text,
 home_team text,away_team text,home_score integer,away_score integer,status text,venue text,start_time timestamptz)
 ON CONFLICT (game_pk) DO NOTHING;"""


def normalize(data):
    games = {}
    # The season response includes the original postponed listing and the
    # replacement listing. Only discard an original when the provider supplies
    # an explicit rescheduledFrom cross-reference to it.
    replaced = {(g['gamePk'], g['rescheduledFrom'])
                for d in data['dates'] for g in d['games'] if g.get('rescheduledFrom')}
    for day in data['dates']:
        for game in day['games']:
            if (game['gamePk'], game.get('gameDate')) in replaced:
                continue
            if game.get('gameType') not in ('R','F','D','L','W'):
                continue
            home, away = game['teams']['home'], game['teams']['away']
            h = normalize_team(home['team']['abbreviation'])
            a = normalize_team(away['team']['abbreviation'])
            if h not in TEAM_ID_BY_CODE or a not in TEAM_ID_BY_CODE:
                raise ValueError('Unknown official team identifier')
            detail = game['status'].get('detailedState')
            status = detail if detail in ('Postponed','Cancelled','Canceled','If Necessary') else game['status'].get('abstractGameState','Scheduled')
            if game.get('ifNecessary') == 'Y' and status == 'Preview':
                status = 'If Necessary'
            row = dict(game_pk=game['gamePk'],game_date=game.get('officialDate') or day['date'],
                       game_type=game['gameType'],home_team=h,away_team=a,
                       home_score=home.get('score'),away_score=away.get('score'),status=status,
                       venue=game.get('venue',{}).get('name'),start_time=game.get('resumedFrom') or game.get('rescheduleDate') or game.get('gameDate'))
            if row['game_pk'] in games and games[row['game_pk']] != row:
                # Resumed games may appear on multiple dates; officialDate is
                # authoritative, but conflicting observations need review.
                raise ValueError(f"Conflicting source observations for {row['game_pk']}")
            games[row['game_pk']] = row
    return list(games.values())


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--season',type=int,required=True)
    p.add_argument('--source',type=Path)
    p.add_argument('--output',type=Path,default=ROOT/'output/database-bootstrap')
    p.add_argument('--emit-sql-dir',type=Path)
    p.add_argument('--write',action='store_true')
    p.add_argument('--local',action='store_true')
    p.add_argument('--project-ref')
    args = p.parse_args()
    if args.source:
        content = args.source.read_bytes()
        receipt = {'source_file':str(args.source),'replayed_at':datetime.now(timezone.utc).isoformat()}
    else:
        r = requests.get('https://statsapi.mlb.com/api/v1/schedule',params={
            'sportId':1,'season':args.season,'gameTypes':'R,F,D,L,W','hydrate':'team,venue'},timeout=60)
        r.raise_for_status()
        content = r.content
        receipt = {'url':r.url,'retrieved_at':datetime.now(timezone.utc).isoformat()}
    rows = normalize(json.loads(content))
    receipt.update(sha256=hashlib.sha256(content).hexdigest(),games=len(rows),season=args.season)
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/f'mlb-{args.season}.json').write_bytes(content)
    (args.output/f'mlb-{args.season}-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    if args.emit_sql_dir:
        args.emit_sql_dir.mkdir(parents=True,exist_ok=True)
        for i in range(0,len(rows),200):
            payload = json.dumps(rows[i:i+200]).replace("'", "''")
            (args.emit_sql_dir/f'{i//200:03}.sql').write_text(IMPORT.replace('%s',"'"+payload+"'"),encoding='utf-8')
    if args.write:
        if os.getenv('MLBMODEL_DB_WRITES') != '1':
            raise ValueError('Set MLBMODEL_DB_WRITES=1 for an intentional import')
        url = os.environ['DATABASE_URL']
        check_target(url,args.local,args.project_ref)
        with psycopg.connect(url) as conn:
            conn.execute(IMPORT,(Jsonb(rows),))
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()

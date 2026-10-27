"""Run with python -m src.cli from models/nba."""
import argparse
import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from alembic import command
from alembic.config import Config
from .config import ROOT,DATA
from . import db

def main():
    parser=argparse.ArgumentParser()
    subs=parser.add_subparsers(dest='command',required=True)
    subs.add_parser('migrate')
    for name in ('backfill-games','backfill-boxes','backfill-injuries'):
        p=subs.add_parser(name)
        p.add_argument('--start-season',type=int,default=2020)
        p.add_argument('--end-season',type=int,default=2023)
        p.add_argument('--limit-per-season',type=int)
        if name=='backfill-games':
            p.add_argument('--official-boxes',action='store_true')
            p.add_argument('--refresh',action='store_true')
        if name=='backfill-injuries':
            p.add_argument('--report-time')
    for name in ('build-rotations','build-player-ratings','build-team-ratings','build-pregame-features',
                 'build-halftime-dataset','train-pregame','train-halftime','evaluate-all','backfill-markets','coverage','audit-halftime'):
        subs.add_parser(name)
    collect=subs.add_parser('collect-market');collect.add_argument('--source',choices=['espn','action'],required=True)
    collect.add_argument('--event');collect.add_argument('--date')
    args=parser.parse_args()
    if args.command=='migrate':
        config=Config(str(ROOT/'alembic.ini'));config.set_main_option('script_location',str(ROOT/'migrations'))
        command.upgrade(config,'head');result={'migration':'head'}
    elif args.command=='backfill-games':
        from .sources import backfill_games
        result=backfill_games(args.start_season,args.end_season,args.limit_per_season,args.official_boxes,args.refresh)
    elif args.command=='audit-halftime':
        from .sources import audit_halftime
        result=audit_halftime()
    elif args.command=='backfill-boxes':
        from .box_fallback import ingest
        result={}
        for season in range(args.start_season,args.end_season+1):
            result[season]=ingest(season)
    elif args.command=='build-rotations':
        from .features import build_rotations
        result=build_rotations()
    elif args.command in ('build-player-ratings','build-team-ratings','build-pregame-features','build-halftime-dataset'):
        from .features import build_features
        result=build_features()
    elif args.command in ('train-pregame','train-halftime','evaluate-all'):
        from .modeling import evaluate
        result=evaluate()
    elif args.command=='backfill-markets':
        from .markets import historical_sbr
        result=historical_sbr()
        (DATA/'reports').mkdir(exist_ok=True)
        (DATA/'reports/market_coverage.json').write_text(json.dumps(result,indent=2))
    elif args.command=='collect-market':
        from .markets import collect
        result=collect(args.source,args.event,args.date)
    elif args.command=='backfill-injuries':
        from .injuries import ingest_report
        from .storage import Client
        result={}
        stamps=[args.report_time] if args.report_time else []
        if not stamps:
            client=Client()
            for season in range(args.start_season,args.end_season+1):
                url=f'https://official.nba.com/nba-injury-report-{season}-{str(season+1)[-2:]}-season/'
                try:
                    path,_=client.get(url,'official_injury_hub',True)
                    matches=sorted(set(re.findall(r'Injury-Report_(\d{4}-\d{2}-\d{2})_(\d{2}(?:_\d{2})?[AP]M)\.pdf',path.read_text(errors='replace'))))
                    if args.limit_per_season:
                        matches=matches[:args.limit_per_season]
                    if not matches:
                        result[season]={'issue':'No historical report URLs exposed by hub; supply --report-time'}
                    for date,hour in matches:
                        fmt='%Y-%m-%d_%I_%M%p' if '_' in hour else '%Y-%m-%d_%I%p'
                        stamps.append(datetime.strptime(date+'_'+hour,fmt).replace(tzinfo=ZoneInfo('America/New_York')).isoformat())
                except Exception as exc:
                    result[season]={'issue':str(exc)}
        for stamp in stamps:
            try:
                result[stamp]=ingest_report(stamp)
            except Exception as exc:
                result[stamp]={'issue':str(exc)}
        (DATA/'reports').mkdir(exist_ok=True)
        (DATA/'reports/injury_coverage.json').write_text(json.dumps(result,indent=2))
    else:
        from sqlalchemy import select,func
        with db.engine().connect() as conn:
            result={name:conn.execute(select(func.count()).select_from(table)).scalar_one() for name,table in db.tables.items()}
    print(json.dumps(result,indent=2,allow_nan=False))

if __name__=='__main__':
    main()

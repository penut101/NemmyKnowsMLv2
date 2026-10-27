"""Defensive market contracts: unknown quote time is never a historical opener."""
import json
import sqlite3
import statistics
import pandas as pd
from datetime import datetime
from . import db
from .storage import Client
from .sources import record_raw
from .config import PINS
from .pit import known_by,timestamp

def implied(price):
    price=float(price)
    if abs(price)<100:
        raise ValueError('American price must have absolute value >=100')
    return -price/(-price+100) if price<0 else 100/(price+100)

def devig(home,away):
    h,a=implied(home),implied(away)
    return {'home':h/(h+a),'away':a/(h+a),'raw_home':h,'raw_away':a,'vig':h+a-1}

def expected_home_margin(home_spread):
    return -float(home_spread)

def consensus(rows,cutoff):
    eligible=[r for r in rows if known_by(r.get('available_at'),cutoff) and not r.get('is_live') and r.get('period')=='full']
    latest={}
    priorities={'open':0,'close':1,'current':2}
    for r in eligible:
        key=(r['sportsbook'],r['market'],r['side'])
        if key not in latest or (timestamp(r['available_at']),priorities.get(r.get('quote_stage'),2))>(timestamp(latest[key]['available_at']),priorities.get(latest[key].get('quote_stage'),2)):
            latest[key]=r
    selected=list(latest.values())
    spread=[r['line'] for r in selected if r['market']=='spread' and r['side']=='home' and r.get('line') is not None]
    total=[r['line'] for r in selected if r['market']=='total' and r.get('line') is not None]
    probs=[]
    openings={}
    for r in eligible:
        key=(r['sportsbook'],r['market'],r['side'])
        if r.get('is_opening') and r.get('line') is not None and (key not in openings or timestamp(r['available_at'])<timestamp(openings[key]['available_at'])):
            openings[key]=r
    opening_spreads=[r['line'] for r in openings.values() if r['market']=='spread' and r['side']=='home']
    opening_totals=[r['line'] for r in openings.values() if r['market']=='total' and r['side']=='over']
    books=sorted({r['sportsbook'] for r in selected})
    for b in books:
        pair={r['side']:r for r in selected if r['sportsbook']==b and r['market']=='moneyline'}
        if set(pair)=={'home','away'} and all(r.get('price') is not None for r in pair.values()) and timestamp(pair['home']['available_at'])==timestamp(pair['away']['available_at']):
            probs.append(devig(pair['home']['price'],pair['away']['price'])['home'])
    return {'market_spread':statistics.median(spread) if spread else None,
            'market_total':statistics.median(total) if total else None,
            'market_probability':statistics.median(probs) if probs else None,
            'market_opening_spread':statistics.median(opening_spreads) if opening_spreads else None,
            'market_opening_total':statistics.median(opening_totals) if opening_totals else None,
            'market_line_movement':statistics.median(spread)-statistics.median(opening_spreads) if spread and opening_spreads else None,
            'market_dispersion':statistics.pstdev(spread) if len(spread)>1 else 0 if spread else None,
            'market_book_count':len(books),'contributing_books':books}

def normalize_espn(payload, mapping, receipt):
    out=[]
    def number(value, price=False):
        if isinstance(value,dict):
            value=value.get('american',value.get('value'))
        if value is None:
            return None
        if str(value).upper() in ('EVEN','EV'):
            return 100.0 if price else 0.0
        if str(value).upper() in ('PK','PICK'):
            return 0.0
        return float(value)
    for item in payload.get('items',[]):
        provider=str(item.get('provider',{}).get('name','unknown'))
        # Only explicit home line contracts; do not guess the sign of `details`.
        for stage in ('open','current','close'):
            quote=item.get(stage,{})
            home=item.get('homeTeamOdds',{}).get(stage,{})
            away=item.get('awayTeamOdds',{}).get(stage,{})
            if not quote and not home and not away:
                continue
            for market,side,line,price in (
                ('spread','home',number(home.get('pointSpread')),number(home.get('spread'),True)),
                ('spread','away',number(away.get('pointSpread')),number(away.get('spread'),True)),
                ('total','over',number(quote.get('total')),number(quote.get('over'),True)),
                ('total','under',number(quote.get('total')),number(quote.get('under'),True)),
                ('moneyline','home',None,number(home.get('moneyLine'),True)),
                ('moneyline','away',None,number(away.get('moneyLine'),True))):
                if line is None and price is None:
                    continue
                out.append(dict(game_id=mapping['game_id'],captured_at=receipt['requested_at'],available_at=receipt['requested_at'],
                    source='espn',sportsbook=provider,market=market,period='full',side=side,line=line,price=price,
                    is_live=bool(item.get('inGame',False)),is_opening=stage=='open',is_closing_candidate=stage=='close',
                    raw_event_id=mapping['external_id'],raw_payload_hash=receipt['payload_hash'],
                    raw_implied_probability=implied(price) if price is not None else None,quote_stage=stage))
    return out

def collect(source, event=None, date=None):
    if source=='espn':
        if not event:
            raise ValueError('ESPN event ID required')
        url=f'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/{event}/competitions/{event}/odds'
    elif source=='action':
        datetime.strptime(date,'%Y%m%d')
        url=f'https://api.actionnetwork.com/web/v2/scoreboard/nba?date={date}'
    else:
        raise ValueError('Unknown provider')
    with db.engine().begin() as conn:
        path,receipt=Client().get(url,source)
        record_raw(conn,'market_payloads',receipt)
        payload=json.loads(path.read_text())
        if source=='action':
            from .box_fallback import ALIASES
            teams={t['payload']['abbreviation']:t['team_id'] for t in db.rows(conn,'teams')}
            games=db.game_index(conn);mapping={}
            for event in payload.get('games',[]):
                external={t['id']:teams.get(ALIASES.get(t['abbr'],t['abbr'])) for t in event.get('teams',[])}
                candidates=[g for g in games if g['home_team_id']==external.get(event['home_team_id']) and g['away_team_id']==external.get(event['away_team_id'])
                    and abs((pd.Timestamp(g['start_time'])-pd.Timestamp(event['start_time'])).total_seconds())<6*3600]
                if len(candidates)==1:
                    gid=candidates[0]['game_id'];mapping[str(event['id'])]=gid
                    db.put(conn,'source_game_mappings',dict(source='action',external_id=str(event['id']),game_id=gid,payload={'canonical_teams_and_time_verified':True}))
            quotes=normalize_action(payload,mapping,receipt)
            for i,q in enumerate(quotes):
                db.derived(conn,'market_snapshots',f"action:{receipt['payload_hash']}:{receipt['requested_at']}:{i}",q,game_id=q['game_id'],captured_at=q['captured_at'])
            return {'raw_saved':True,'normalized':len(quotes),'unmapped':sum(q['game_id'] is None for q in quotes)}
        mappings=[m for m in db.rows(conn,'source_game_mappings') if m['source']=='espn' and m['external_id']==str(event)]
        if len(mappings)!=1:
            return {'raw_saved':True,'normalized':0,'issue':'Unmapped event'}
        quotes=normalize_espn(payload,mappings[0],receipt)
        for i,q in enumerate(quotes):
            db.derived(conn,'market_snapshots',f"espn:{receipt['payload_hash']}:{receipt['requested_at']}:{i}",q,game_id=q['game_id'],captured_at=q['captured_at'])
        return {'raw_saved':True,'normalized':len(quotes)}

def normalize_action(payload, mappings, receipt):
    out=[]
    for game in payload.get('games',[]):
        gid=mappings.get(str(game['id']))
        for book,periods in game.get('markets',{}).items():
            for kind,offers in periods.get('event',{}).items():
                if kind not in ('spread','total','moneyline'):
                    continue
                for offer in offers:
                    if offer.get('is_alt_market') or offer.get('period')!='event':
                        continue
                    side=offer.get('side')
                    if side not in (('over','under') if kind=='total' else ('home','away')):
                        continue
                    price=float(offer['odds'])
                    out.append(dict(game_id=gid,captured_at=receipt['requested_at'],available_at=receipt['requested_at'],
                        source='action',sportsbook=str(book),market=kind,period='full',side=side,
                        line=float(offer['value']) if kind!='moneyline' else None,price=price,raw_implied_probability=implied(price),
                        is_live=bool(offer.get('is_live',True)),is_opening=False,is_closing_candidate=False,
                        raw_event_id=str(game['id']),raw_payload_hash=receipt['payload_hash'],
                        mapping_status='canonical' if gid else 'unresolved',source_start_time=game['start_time']))
    return out

def historical_sbr():
    repo,revision=PINS['sbr']
    url=f'https://raw.githubusercontent.com/{repo}/{revision}/Data/OddsData.sqlite'
    with db.engine().begin() as conn:
        path,receipt=Client().get(url,'sbr_archive',True)
        record_raw(conn,'market_payloads',receipt)
    with sqlite3.connect('file:'+path.as_posix()+'?mode=ro',uri=True) as source:
        names=[r[0] for r in source.execute("select name from sqlite_master where type='table'")]
        info={n:{'columns':[r[1] for r in source.execute('pragma table_info("'+n.replace('"','""')+'")')],
                 'rows':source.execute('select count(*) from "'+n.replace('"','""')+'"').fetchone()[0]} for n in names}
        with db.engine().begin() as conn:
            games=db.game_index(conn,scores=True);teams=db.rows(conn,'teams')
            teammap={(t['payload'].get('city','')+' '+t['payload'].get('name','')).strip():t['team_id'] for t in teams}
            lookup={(pd.Timestamp(g['start_time']).tz_convert('America/New_York').date(),g['home_team_id'],g['away_team_id']):g for g in games}
            count=0
            for season in sorted({g['season'] for g in games}):
                name=f'odds_{season}-{str(season+1)[-2:]}_new'
                if name not in names:
                    continue
                for i,row in pd.read_sql_query('select * from "'+name+'"',source).iterrows():
                    date=pd.to_datetime(row['Date'],errors='coerce')
                    if pd.isna(date):
                        continue
                    game=lookup.get((date.date(),teammap.get(row['Home']),teammap.get(row['Away'])))
                    if not game:
                        continue
                    gid=game['game_id']
                    if int(row['Points'])!=game['payload']['home_score']+game['payload']['away_score'] or int(row['Win_Margin'])!=game['payload']['home_score']-game['payload']['away_score']:
                        continue
                    pair=devig(row['ML_Home'],row['ML_Away'])
                    external=f'{name}:{i}'
                    db.put(conn,'source_game_mappings',dict(source='sbr',external_id=external,game_id=gid,payload={'date':str(date.date()),'home_team_id':game['home_team_id'],'away_team_id':game['away_team_id'],'score_verified':True}))
                    for market,side,line,price in [('spread','home',-float(row['Spread']),None),('total','over',float(row['OU']),None),('moneyline','home',None,float(row['ML_Home'])),('moneyline','away',None,float(row['ML_Away']))]:
                        q=dict(game_id=gid,captured_at=receipt['requested_at'],available_at=None,source='sbr_archive',sportsbook='unspecified_sbr_book',
                            market=market,period='full',side=side,line=line,price=price,is_live=False,is_opening=False,is_closing_candidate=False,
                            raw_event_id=external,raw_payload_hash=receipt['payload_hash'],timing_status='unknown_quote_time',
                            spread_source_convention='source Spread is away spread; negated for home',
                            no_vig_probability=pair[side] if market=='moneyline' else None,
                            raw_implied_probability=implied(price) if price else None,vig=pair['vig'] if price else None)
                        db.derived(conn,'market_snapshots',f'sbr:{gid}:{market}:{side}',q,game_id=gid,captured_at=receipt['requested_at'])
                        count+=1
    return {'raw_hash':receipt['payload_hash'],'tables':info,'normalized_snapshots':count,'strict_use':'Normalized but excluded from historical features: no verifiable quote timestamps; opening/closing semantics not asserted'}

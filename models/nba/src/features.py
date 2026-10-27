"""Causal feature builders. Outcomes and model inputs are separate objects."""
import json
from collections import defaultdict
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sqlalchemy import select,delete
from . import db
from .rotations import reconstruct,validate_minutes,seconds,RotationError,rapm
from .minutes import project,status_probabilities
from .injuries import eligible_snapshots
from .markets import consensus
from .pit import strictly_before

def build_rotations():
    e=db.engine();accepted=failed=0
    with e.connect() as conn:
        table=db.tables['games']
        games=[dict(r) for r in conn.execute(select(*[c for c in table.c if c.name!='payload'])).mappings()]
        boxes=db.rows(conn,'player_game_stats')
    bygame=defaultdict(list)
    for row in boxes:
        bygame[row['game_id']].append(row)
    for g in games:
        with e.begin() as conn:
            g['payload']=conn.execute(select(table.c.payload).where(table.c.game_id==g['game_id'])).scalar_one()
            gid=g['game_id'];box=bygame[gid]
            try:
                starters={t:{int(b['player_id']) for b in box if b['team_id']==t and b['payload'].get('starter')} for t in (g['home_team_id'],g['away_team_id'])}
                if any(len(s)!=5 for s in starters.values()):
                    starters=None
                stints=reconstruct(g['payload']['events'],g['home_team_id'],g['away_team_id'],starters=starters)
                official={int(b['player_id']):seconds(b['payload'].get('statistics',{}).get('minutes',b['payload'].get('minutes',0))) for b in box}
                validate_minutes(stints,official,tolerance=90)
                player_rows=[];lineup_rows=[]
                for i,s in enumerate(stints):
                    lineup_rows.append(dict(id=f'{gid}:{i}',game_id=gid,team_id=None,player_id=None,captured_at=None,
                        as_of_date=g['completed_at'],payload=dict(**s,validated=True,completed_at=g['completed_at'])))
                    for side,tid in [('home_players',g['home_team_id']),('away_players',g['away_team_id'])]:
                        for p in s[side]:
                            player_rows.append(dict(id=f'{gid}:{i}:{p}',game_id=gid,team_id=tid,player_id=str(p),captured_at=None,
                                as_of_date=g['completed_at'],payload={k:s[k] for k in ('period','in_game_second','out_game_second','stint_seconds')}))
                for name,records in [('rotation_stints',player_rows),('lineup_stints',lineup_rows)]:
                    target=db.tables[name]
                    conn.execute(delete(target).where(target.c.game_id==gid))
                    if records:
                        conn.execute(target.insert(),records)
                for b in box:
                    p=int(b['player_id'])
                    reg=sum(s['stint_seconds']/60 for s in stints if s['period']<=4 and p in s['home_players']+s['away_players'])
                    payload=dict(b['payload'],regulation_minutes=reg,minutes_validated=True)
                    db.derived(conn,'player_game_stats',b['id'],payload,game_id=gid,team_id=b['team_id'],player_id=b['player_id'],captured_at=b['captured_at'])
                    db.derived(conn,'lineup_snapshots',gid+':actual:'+str(b['captured_at'])+':'+b['player_id'],{'state':'CONFIRMED','starter':bool(payload.get('starter')),
                        'source':payload.get('source','nba_box'),'confirmation_timestamp':b['captured_at'],'historical_actual_only':True},
                        game_id=gid,team_id=b['team_id'],player_id=b['player_id'],captured_at=b['captured_at'])
                accepted+=1
            except (RotationError,KeyError,TypeError) as exc:
                db.derived(conn,'quality_issues',gid+':rotation',{'error':str(exc),'stage':'rotation'},game_id=gid)
                failed+=1
            g.pop('payload',None)
    return {'validated_games':accepted,'quarantined_games':failed}

def period_state(events, home, away, max_period=2):
    selected=[e for e in events if e['period']<=max_period]
    if not selected or not {1,2}.issubset({e['period'] for e in selected}):
        raise ValueError('Missing first half')
    stats={t:dict(fga=0,fgm=0,fg3a=0,fg3m=0,fta=0,ftm=0,orb=0,drb=0,tov=0,paint=0,fastbreak=0,secondchance=0) for t in (home,away)}
    previous_rebounds={};fouls=defaultdict(int)
    largest_home=largest_away=ties=changes=0;leading=0.;previous_time=0.;previous_margin=0
    q1margin=q2five_margin=0
    for e in selected:
        margin=e['home_score']-e['away_score']
        leading+=(e['second']-previous_time)*(1 if previous_margin>0 else -1 if previous_margin<0 else 0)
        previous_time=e['second']
        largest_home=max(largest_home,margin);largest_away=max(largest_away,-margin)
        changes+=int(margin*previous_margin<0)
        ties+=int(margin==0 and previous_margin!=0)
        previous_margin=margin
        if e['period']==1:
            q1margin=margin
        if e['second']<=1140:
            q2five_margin=margin
        if e['t1'] not in stats:
            continue
        s=stats[e['t1']];d=e['description'].upper();kind=e['kind']
        if kind in (1,2):
            three='3PT' in d
            s['fga']+=1;s['fgm']+=int(kind==1);s['fg3a']+=int(three);s['fg3m']+=int(three and kind==1)
            if kind==1:
                s['paint']+=2*int(any(x in d for x in ('LAYUP','DUNK')))
                s['fastbreak']+=(3 if three else 2)*int('FAST BREAK' in d)
                s['secondchance']+=(3 if three else 2)*int('PUTBACK' in d)
        elif kind==3:
            s['fta']+=1;s['ftm']+=int('MISS' not in d)
        elif kind==5:
            s['tov']+=1
        elif kind==6:
            # NBA action type 11/12/16/18 are technical/double technical, not personal fouls.
            if e.get('subtype') not in (11,12,16,18):
                fouls[e['p1']]+=1
        elif kind==4:
            import re
            match=re.search(r'OFF:(\d+) DEF:(\d+)',d)
            if match:
                current=tuple(map(int,match.groups()));prev=previous_rebounds.get(e['p1'],(0,0))
                s['orb']+=max(current[0]-prev[0],0);s['drb']+=max(current[1]-prev[1],0)
                previous_rebounds[e['p1']]=current
    last=selected[-1]
    result={'h1_home':last['home_score'],'h1_away':last['away_score'],
        'h1_margin':last['home_score']-last['away_score'],'h1_total':last['home_score']+last['away_score'],
        'q1_margin':q1margin,'q2_margin':last['home_score']-last['away_score']-q1margin,
        'q2_last5_margin':last['home_score']-last['away_score']-q2five_margin,
        'largest_home_lead':largest_home,'largest_away_lead':largest_away,'lead_changes':changes,'ties':ties,
        'time_leading_difference':leading,'max_feature_period':max(e['period'] for e in selected)}
    for side,t,op in [('home',home,away),('away',away,home)]:
        s=stats[t];opp=stats[op]
        s['poss']=s['fga']+.44*s['fta']-s['orb']+s['tov']
        s['efg']=(s['fgm']+.5*s['fg3m'])/max(s['fga'],1)
        s['tov_rate']=s['tov']/max(s['poss'],1)
        s['orb_rate']=s['orb']/max(s['orb']+opp['drb'],1)
        s['ftr']=s['fta']/max(s['fga'],1)
        s['fg3_rate']=s['fg3m']/max(s['fg3a'],1)
        s['fg3_attempt_rate']=s['fg3a']/max(s['fga'],1)
        s['fg2a']=s['fga']-s['fg3a'];s['fg2m']=s['fgm']-s['fg3m']
        s['fg2_rate']=s['fg2m']/max(s['fg2a'],1);s['ft_rate']=s['ftm']/max(s['fta'],1)
        result.update({f'h1_{side}_{k}':v for k,v in s.items()})
    result['h1_pace']=result['h1_home_poss']+result['h1_away_poss']
    result['players_three_fouls']=sum(v>=3 for v in fouls.values())
    return result,stats,dict(fouls)

def targets(events):
    h1=[e for e in events if e['period']<=2][-1]
    reg=[e for e in events if e['period']<=4][-1]
    final=events[-1]
    h=reg['home_score']-h1['home_score'];a=reg['away_score']-h1['away_score']
    return dict(h2_margin=h-a,h2_total=h+a,regulation_margin=reg['home_score']-reg['away_score'],
        final_margin=final['home_score']-final['away_score'],final_total=final['home_score']+final['away_score'],
        winner=int(final['home_score']>final['away_score']),overtime=int(final['period']>4))

def team_strength(history,cutoff):
    eligible=[g for g in history if strictly_before(g['completed_at'],cutoff)]
    teams=sorted({g[k] for g in eligible for k in ('home_team_id','away_team_id')})
    if not teams:
        return {}
    idx={t:i for i,t in enumerate(teams)}
    x=[];y=[];weights=[]
    for g in eligible:
        for side,opp,score in [('home_team_id','away_team_id','home_score'),('away_team_id','home_team_id','away_score')]:
            row=np.zeros(len(teams)*2)
            row[idx[g[side]]]=1;row[len(teams)+idx[g[opp]]]=-1
            x.append(row);y.append(100*g['payload'][score]/max(g['possessions'],1))
            age=(pd.Timestamp(cutoff)-pd.Timestamp(g['completed_at'])).total_seconds()/86400
            weights.append(2**(-age/180))
    fit=Ridge(alpha=20).fit(x,y,sample_weight=weights)
    return {t:{'adjusted_offense':float(fit.coef_[i]),'adjusted_defense':float(fit.coef_[len(teams)+i]),
        'adjusted_net':float(fit.coef_[i]+fit.coef_[len(teams)+i])} for t,i in idx.items()}

def build_features():
    e=db.engine()
    with e.connect() as conn:
        game_table=db.tables['games']
        games=[dict(r) for r in conn.execute(select(*[c for c in game_table.c if c.name!='payload']).order_by(game_table.c.start_time)).mappings()]
        boxes=db.rows(conn,'player_game_stats');rotation=db.rows(conn,'lineup_stints')
        injury=[r['payload'] for r in db.rows(conn,'injury_snapshots')]
        markets=[r['payload'] for r in db.rows(conn,'market_snapshots')]
    prior=[];team_history=defaultdict(list);player_history=defaultdict(list);team_players=defaultdict(list);observations=[]
    bygame=defaultdict(list);boxgame=defaultdict(list)
    seen=set()
    for r in rotation:
        key=(r['game_id'],r['payload']['period'],r['payload']['in_game_second'])
        if key not in seen:
            bygame[r['game_id']].append(r['payload']);seen.add(key)
    for b in boxes:
        boxgame[b['game_id']].append(b)
    elo=defaultdict(lambda:1500.);rating_cache={};rapm_cache={};result=[];elo_applied=set();persisted_months=set()
    for g in games:
        with e.connect() as conn:
            g['payload']=conn.execute(select(game_table.c.payload).where(game_table.c.game_id==g['game_id'])).scalar_one()
        gid=g['game_id'];home=g['home_team_id'];away=g['away_team_id'];cutoff=g['start_time']
        # Only completed earlier games are eligible even for simultaneous games.
        prior_ready=[p for p in prior if strictly_before(p['completed_at'],cutoff)]
        for completed in sorted(prior_ready,key=lambda x:x['completed_at']):
            if completed['game_id'] not in elo_applied:
                ht,at=completed['home_team_id'],completed['away_team_id']
                probability=1/(1+10**((elo[at]-elo[ht]-65)/400))
                delta=20*(int(completed['payload']['home_score']>completed['payload']['away_score'])-probability)
                elo[ht]+=delta;elo[at]-=delta;elo_applied.add(completed['game_id'])
        month=pd.Timestamp(cutoff).strftime('%Y-%m-01T00:00:00+00:00')
        if pd.Timestamp(month)>=pd.Timestamp(cutoff):
            month=(pd.Timestamp(month)-pd.Timedelta(microseconds=1)).isoformat()
        if month not in rating_cache:
            rating_cache[month]=team_strength(prior_ready,month)
            rapm_cache[month]=rapm(observations,month)
        team_ratings=rating_cache[month];impacts=rapm_cache[month]
        pre={};expected={};remaining={};roster_features={}
        for label,t in [('home',home),('away',away)]:
            history=[h for h in team_history[t] if strictly_before(h['completed_at'],cutoff)]
            margin=[h['margin'] for h in history[-10:]]
            last=history[-1] if history else None
            rest=min((pd.Timestamp(cutoff)-pd.Timestamp(last['start_time'])).total_seconds()/86400,14) if last else 7
            pre[label+'_rest']=rest;pre[label+'_b2b']=float(rest<1.5)
            pre[label+'_form']=float(np.mean(margin)) if margin else 0
            pre[label+'_elo']=elo[t]
            for key in ('adjusted_offense','adjusted_defense','adjusted_net'):
                pre[label+'_'+key]=team_ratings.get(t,{}).get(key,0)
            for window,n in [('season',10000),('last10',10),('last5',5),('venue',10)]:
                selected=[h for h in history if (window!='season' or h['season']==g['season']) and (window!='venue' or h['home']==(label=='home'))][-n:]
                for key in ('ortg','drtg','pace','efg','tov_rate','orb_rate','ftr','fg3_attempt_rate','paint','fastbreak','secondchance','fg3_rate'):
                    pre[f'{label}_{window}_{key}']=float(np.mean([h[key] for h in selected])) if selected else None
            recent_players=[p for p in team_players[t] if strictly_before(p['completed_at'],cutoff)]
            dates=sorted({p['completed_at'] for p in recent_players})[-10:]
            roster=sorted({p['player_id'] for p in recent_players if p['completed_at'] in dates})
            status={r['player_id']:r['status'] for r in eligible_snapshots(injury,cutoff) if r['game_id']==gid and r['team_id']==t}
            empirical=status_probabilities([],cutoff)
            try:
                minutes=project(player_history,roster,cutoff,empirical,status)
                base=project(player_history,roster,cutoff)
            except ValueError:
                minutes={};base={}
            expected[t]=minutes
            top=sorted(roster,key=lambda p:base.get(p,0),reverse=True)[:5]
            strength=lambda ps:sum(minutes.get(p,0)*impacts.get(p,{}).get('net_impact',0) for p in ps)/240
            pre[label+'_player_impact']=float(np.mean([impacts.get(p,{}).get('net_impact',0) for p in roster])) if roster else None
            pre[label+'_roster_strength']=strength(roster) if minutes else None
            pre[label+'_starter_strength']=strength(top) if minutes else None
            pre[label+'_bench_strength']=strength(set(roster)-set(top)) if minutes else None
            pre[label+'_missing_minutes']=sum(max(base.get(p,0)-minutes.get(p,0),0) for p in roster) if minutes else None
            pre[label+'_missing_starter_minutes']=sum(max(base.get(p,0)-minutes.get(p,0),0) for p in top) if minutes else None
            pre[label+'_missing_impact']=sum(max(base.get(p,0)-minutes.get(p,0),0)*impacts.get(p,{}).get('net_impact',0) for p in roster) if minutes else None
            pre[label+'_personnel_coverage']=float(bool(minutes) and bool(impacts))
            pre[label+'_injury_report_coverage']=float(bool(status))
            roster_features[t]=(roster,top,status)
        pre['elo_probability']=1/(1+10**((pre['away_elo']-pre['home_elo']-65)/400))
        market=consensus([m for m in markets if m['game_id']==gid],cutoff)
        half,_,fouls=period_state(g['payload']['events'],home,away)
        try:
            hs=reconstruct(g['payload']['events'],home,away,max_period=2)
            for label,t,side in [('home',home,'home_players'),('away',away,'away_players')]:
                roster,top,status=roster_features[t]
                actual={str(p):sum(s['stint_seconds']/60 for s in hs if p in s[side]) for s in hs for p in s[side]}
                h1={p:{'minutes':m,'fouls':fouls.get(int(p),0)} for p,m in actual.items()}
                half[label+'_starter_minutes']=sum(actual.get(p,0) for p in top)
                half[label+'_weighted_minutes_deviation']=sum((m-expected[t].get(p,0)/2)*impacts.get(p,{}).get('net_impact',0) for p,m in actual.items())
                ordered=sorted(roster,key=lambda p:impacts.get(p,{}).get('net_impact',0),reverse=True)
                half[label+'_top3_minutes']=sum(actual.get(p,0) for p in ordered[:3])
                half[label+'_high_impact_fouls']=sum(fouls.get(int(p),0)>=3 for p in ordered[:3])
                half[label+'_bench_only_minutes']=sum(s['stint_seconds']/60 for s in hs if not set(map(int,top))&set(s[side]))
                half[label+'_top2_shared_minutes']=sum(s['stint_seconds']/60 for s in hs if set(map(int,ordered[:2]))<=set(s[side])) if len(ordered)>=2 else None
                half[label+'_lineup_count']=len({tuple(s[side]) for s in hs})
                try:
                    h2=project(player_history,roster,cutoff,status_probabilities([],cutoff),status,h1)
                    remaining[t]=h2
                    half[label+'_h2_strength']=sum(v*impacts.get(p,{}).get('net_impact',0) for p,v in h2.items())/120
                except ValueError:
                    half[label+'_h2_strength']=None
        except RotationError:
            half['rotation_unavailable']=1
        for label in ('home','away'):
            for feature in ('efg','fg3_rate','tov_rate','orb_rate'):
                previous=pre[label+'_last10_'+feature] if label+'_last10_'+feature in pre else None
                half[label+'_'+feature+'_deviation']=half['h1_'+label+'_'+feature]-previous if previous is not None else None
        expected_pace=[pre[s+'_last10_pace'] for s in ('home','away') if pre[s+'_last10_pace'] is not None]
        half['pace_deviation']=half['h1_pace']-float(np.mean(expected_pace)) if expected_pace else None
        outcome=targets(g['payload']['events'])
        row=dict(game_id=gid,season=g['season'],cutoff=cutoff,rating_as_of=month,pregame=pre,market=market,halftime=half,targets=outcome,
                 halftime_eligible=g['payload'].get('halftime_eligible',False),halftime_cutoff=g['payload'].get('halftime_cutoff'),
                 halftime_issue=g['payload'].get('halftime_issue','Knowledge timestamps not audited'))
        with e.begin() as conn:
            db.derived(conn,'pregame_features',gid,row,game_id=gid,as_of_date=cutoff)
            db.derived(conn,'halftime_features',gid,row,game_id=gid,as_of_date=row['halftime_cutoff'])
            for t,minutes in expected.items():
                roster,top,status=roster_features[t]
                db.derived(conn,'pregame_availability',gid+':'+t,{'statuses':status,'report_observed':bool(status),
                    'projected_starters':top,'lineup_state':'PROJECTED','unlisted_status':'UNKNOWN',
                    'uncertain_status_probability_basis':'Beta(1,1) prior; empirical history unavailable'},game_id=gid,team_id=t,as_of_date=cutoff)
                for p,m in minutes.items():
                    db.derived(conn,'projected_minutes',gid+':'+p,{'regulation_minutes':m,'basis':'prior median with bounded replacement allocation'},game_id=gid,team_id=t,player_id=p,as_of_date=cutoff)
            for t,minutes in remaining.items():
                for p,m in minutes.items():
                    db.derived(conn,'projected_minutes',gid+':h2:'+p,{'remaining_regulation_minutes':m,'stage':'halftime',
                        'strict_eligible':row['halftime_eligible']},game_id=gid,team_id=t,player_id=p,as_of_date=row['halftime_cutoff'])
            if month not in persisted_months:
                for t,rating in team_ratings.items():
                    db.put(conn,'team_ratings',dict(id=month+':'+t,entity_id=t,as_of_date=month,payload=rating))
                for p,rating in impacts.items():
                    db.put(conn,'player_ratings',dict(id=month+':'+p,entity_id=p,as_of_date=month,payload=rating))
                persisted_months.add(month)
        result.append(row)
        # Update history only after emitting all target-game features.
        _,fullstats,_=period_state(g['payload']['events'],home,away,max_period=4)
        possession=np.mean([fullstats[t]['poss'] for t in (home,away)])
        regulation=[event for event in g['payload']['events'] if event['period']<=4][-1]
        record=dict(g,possessions=float(possession),payload={'home_score':regulation['home_score'],'away_score':regulation['away_score']});prior.append(record)
        for t,op,is_home in [(home,away,True),(away,home,False)]:
            score=regulation['home_score' if is_home else 'away_score'];against=regulation['away_score' if is_home else 'home_score']
            state=dict(fullstats[t],completed_at=g['completed_at'],start_time=cutoff,season=g['season'],home=is_home,
                margin=score-against,ortg=100*score/max(possession,1),drtg=100*against/max(possession,1),pace=float(possession))
            team_history[t].append(state)
            with e.begin() as conn:
                db.derived(conn,'team_game_stats',gid+':'+t,state,game_id=gid,team_id=t,as_of_date=g['completed_at'])
        observations.extend(bygame[gid])
        for b in boxgame[gid]:
            if b['payload'].get('regulation_minutes') is not None:
                item=dict(player_id=b['player_id'],team_id=b['team_id'],completed_at=g['completed_at'],
                    regulation_minutes=b['payload']['regulation_minutes'],starter=b['payload'].get('starter',False))
                player_history[b['player_id']].append(item);team_players[b['team_id']].append(item)
        # The chronological index must not retain millions of event dictionaries.
        g.pop('payload',None)
    from .config import DATA
    (DATA/'derived').mkdir(exist_ok=True)
    (DATA/'derived/dataset.json').write_text(json.dumps(result,allow_nan=False))
    return {'games':len(result),'seasons':sorted({r['season'] for r in result})}

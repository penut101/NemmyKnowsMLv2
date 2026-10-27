"""Reconstruct periods independently; never use a later period to infer H1."""
import re
import numpy as np
from scipy.sparse import csr_matrix
from sklearn.linear_model import Ridge
from .pit import strictly_before

class RotationError(ValueError):
    pass

def seconds(value):
    if str(value).startswith('PT'):
        m=re.fullmatch(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?',str(value))
        if not m:
            raise RotationError('Invalid official minutes')
        h,mi,s=m.groups()
        return float(h or 0)*3600+float(mi or 0)*60+float(s or 0)
    if ':' in str(value):
        m,s=str(value).split(':')
        return 60*float(m)+float(s)
    return float(value)*60

def starters_for_period(events, team_id):
    entered=set()
    initial=set()
    for e in events:
        if e['kind']==8:
            if e['t1']==team_id and e['p1'] not in entered:
                initial.add(e['p1'])
            if e['t2']==team_id:
                entered.add(e['p2'])
        else:
            for n in (1,2,3):
                if e[f't{n}']==team_id and e[f'p{n}']>0 and e[f'p{n}'] not in entered:
                    initial.add(e[f'p{n}'])
    if len(initial)!=5:
        raise RotationError(f'Cannot identify exactly five period starters: {len(initial)}')
    return initial

def reconstruct(events, home, away, max_period=None, starters=None):
    selected=[e for e in events if max_period is None or e['period']<=max_period]
    stints=[]
    for period in sorted({e['period'] for e in selected}):
        pe=[e for e in selected if e['period']==period]
        lineups={t:set(starters[t]) if period==1 and starters else starters_for_period(pe,t) for t in (home,away)}
        start=(period-1)*720 if period<=4 else 2880+(period-5)*300
        end=start+(720 if period<=4 else 300)
        prior=[e for e in selected if e['period']<period]
        hs=prior[-1]['home_score'] if prior else 0
        aws=prior[-1]['away_score'] if prior else 0
        margin0=hs-aws
        points=poss=0.0
        def flush(stop):
            nonlocal start,points,poss
            if stop>start:
                stints.append(dict(period=period,in_game_second=start,out_game_second=stop,
                    stint_seconds=stop-start,home_players=sorted(lineups[home]),away_players=sorted(lineups[away]),
                    margin=points,possessions=max(poss, (stop-start)/2880*100)))
            elif points and stints:
                stints[-1]['margin']+=points
            start=stop
            points=poss=0.0
        for event in pe:
            if event['kind']==8:
                flush(event['second'])
                team=event['t1']
                if team not in lineups or event['p1'] not in lineups[team] or event['p2'] in lineups[team]:
                    raise RotationError('Invalid substitution membership')
                lineups[team].remove(event['p1'])
                lineups[team].add(event['p2'])
            else:
                margin=event['home_score']-event['away_score']
                points+=margin-margin0
                margin0=margin
                poss += .5 if event['kind'] in (1,2,5) else .22 if event['kind']==3 else 0
        flush(end)
    return stints

def validate_minutes(stints, official, tolerance=60):
    totals={}
    for s in stints:
        for p in s['home_players']+s['away_players']:
            totals[p]=totals.get(p,0)+s['stint_seconds']
    if not official:
        raise RotationError('Official minutes unavailable; reconstruction is unvalidated')
    for p in set(official)|set(totals):
        if abs(totals.get(p,0)-official.get(p,0))>tolerance:
            raise RotationError(f'Official minute mismatch for player {p}')
    for side in ('home_players','away_players'):
        total=sum(s['stint_seconds']*len(s[side]) for s in stints if s['period']<=4)
        if abs(total-240*60)>1:
            raise RotationError('Regulation team minutes differ from 240')
    return True

def rapm(observations, cutoff, alpha=2000):
    eligible=[s for s in observations if s.get('completed_at') and strictly_before(s['completed_at'],cutoff) and s.get('validated')]
    ids=sorted({p for s in eligible for p in s['home_players']+s['away_players']})
    if not ids:
        return {}
    index={p:i for i,p in enumerate(ids)}
    rr=[];cc=[];vv=[];y=[];weights=[];minutes=np.zeros(len(ids))
    import pandas as pd
    for i,s in enumerate(eligible):
        age=(pd.Timestamp(cutoff)-pd.Timestamp(s['completed_at'])).total_seconds()/86400
        weight=max(s['possessions'],.1)*2**(-age/365)
        weights.append(weight)
        y.append(100*s['margin']/max(s['possessions'],.1))
        for side,sign in [('home_players',1),('away_players',-1)]:
            for p in s[side]:
                rr.append(i);cc.append(index[p]);vv.append(sign)
                minutes[index[p]]+=s['stint_seconds']/60
    x=csr_matrix((vv,(rr,cc)),shape=(len(eligible),len(ids)))
    model=Ridge(alpha=alpha,solver='lsqr').fit(x,y,sample_weight=weights)
    return {str(p):dict(net_impact=float(model.coef_[j]),sample_minutes=float(minutes[j]),
        reliability=float(minutes[j]/(minutes[j]+1000)),as_of_date=cutoff) for p,j in index.items()}

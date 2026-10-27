"""Prior-only minutes allocation with explicit replacements and bounded totals."""
import numpy as np
from .pit import strictly_before

def allocate(weights, total=240, cap=48):
    weights=np.maximum(np.asarray(weights,dtype=float),0)
    if len(weights)*cap<total or weights.sum()<=0:
        raise ValueError('Insufficient eligible roster to allocate minutes')
    out=np.zeros(len(weights))
    active=weights>0
    for _ in range(len(weights)+1):
        remainder=total-out.sum()
        if remainder<1e-7:
            break
        if not active.any():
            raise ValueError('Insufficient active roster capacity')
        proposed=remainder*weights[active]/weights[active].sum()
        ids=np.flatnonzero(active)
        out[ids]+=np.minimum(proposed,cap-out[ids])
        active=active & (out<cap-1e-8)
    if not np.isclose(out.sum(),total):
        raise ValueError('Minutes failed conservation')
    return out

def status_probabilities(history, cutoff):
    # Empirical categorical rates with neutral Beta(1,1) smoothing; never an ordinal scale.
    counts={s:[1,2] for s in ('AVAILABLE','PROBABLE','QUESTIONABLE','DOUBTFUL','OUT')}
    for h in history:
        if strictly_before(h['completed_at'],cutoff):
            counts[h['status']][0]+=int(h['played'])
            counts[h['status']][1]+=1
    return {s:a/b for s,(a,b) in counts.items()}

def project(history, roster, cutoff, probabilities=None, statuses=None, h1=None):
    probabilities=probabilities or {}
    statuses=statuses or {}
    weights=[]
    for player in roster:
        candidates=history.get(player,[]) if isinstance(history,dict) else history
        past=[r for r in candidates if r['player_id']==player and strictly_before(r['completed_at'],cutoff)]
        values=[r['regulation_minutes'] for r in past[-10:]]
        base=float(np.median(values[-5:])) if values else 12.0
        status=statuses.get(player)
        if status=='OUT':
            probability=0.0
        elif status=='AVAILABLE' or status is None:
            probability=1.0
        else:
            if status not in probabilities:
                raise ValueError('No empirical probability for injury status')
            probability=probabilities[status]
        if h1 is not None:
            base=max(0,base-float(h1.get(player,{}).get('minutes',0)))
        weights.append(base*probability)
    projected=allocate(weights,120 if h1 is not None else 240,24 if h1 is not None else 48)
    return dict(zip(roster,projected.tolist()))

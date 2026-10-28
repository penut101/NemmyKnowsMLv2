"""Season walk-forward evaluation with out-of-season pregame priors."""
import json
import math
import hashlib
import joblib
import numpy as np
import pandas as pd
from scipy.special import ndtr
from sklearn.impute import SimpleImputer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge,LogisticRegression
from sklearn.metrics import mean_absolute_error,mean_squared_error,log_loss,brier_score_loss,accuracy_score
from .config import DATA
from . import db

def regressor():
    return make_pipeline(SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True),StandardScaler(),Ridge(alpha=100))

def classifier():
    return make_pipeline(SimpleImputer(strategy='median',add_indicator=True,keep_empty_features=True),StandardScaler(),LogisticRegression(C=.05,max_iter=1000))

def metrics(actual,predicted,probability,win):
    p=np.clip(probability,1e-6,1-1e-6)
    buckets=[]
    for lo in np.arange(0,1,.1):
        mask=(p>=lo)&(p<lo+.1)
        if mask.any():
            buckets.append({'lower':round(float(lo),1),'n':int(mask.sum()),'mean_probability':float(p[mask].mean()),'win_rate':float(np.asarray(win)[mask].mean())})
    return {'mae':float(mean_absolute_error(actual,predicted)), 'rmse':math.sqrt(mean_squared_error(actual,predicted)),
            'log_loss':float(log_loss(win,p,labels=[0,1])), 'brier':float(brier_score_loss(win,p)),
            'accuracy':float(accuracy_score(win,p>=.5)),'calibration_buckets':buckets,'n':len(actual)}

def pregame_columns(frame):
    base=[k for k in frame if any(k.endswith(s) for s in ('_rest','_b2b','_form','_elo')) or k=='elo_probability']
    team=[k for k in frame if any(s in k for s in ('adjusted_','_season_','_last10_','_last5_','_venue_'))]
    impact=[k for k in frame if k.endswith('_player_impact')]
    personnel=[k for k in frame if any(s in k for s in ('_strength','_missing_','_coverage'))]
    return {'P0':base,'P1':base+team,'P2':base+team+impact,'P3':base+team+impact+personnel}

def halftime_columns(frame):
    base=[k for k in ('h1_margin','h1_total','q1_margin','q2_margin','largest_home_lead','largest_away_lead','lead_changes','ties','q2_last5_margin','time_leading_difference') if k in frame]
    prior=[k for k in frame if k.startswith('prior_')]
    market=[k for k in frame if k.startswith('market_')]
    pace=[k for k in frame if 'pace' in k or k.endswith('_poss')]
    factors=[k for k in frame if any(k.endswith(s) for s in ('_efg','_tov_rate','_orb_rate','_ftr'))]
    people=[k for k in frame if any(s in k for s in ('minutes','_strength','fouls','lineup_count'))]
    regression=[k for k in frame if any(s in k for s in ('deviation','fg3','fg2','ft_rate','paint','fastbreak','secondchance'))]
    groups={};cols=base
    for name,extra in [('H0',[]),('H1',prior),('H2',market),('H3',pace),('H4',factors),('H5',people),('H6',regression)]:
        cols=list(dict.fromkeys(cols+extra));groups[name]=cols.copy()
    return groups

def evaluate():
    rows=json.loads((DATA/'derived/dataset.json').read_text())
    if len({r['season'] for r in rows})<3:
        raise ValueError('At least three seasons required; no random split fallback')
    pre=pd.DataFrame([r['pregame'] for r in rows],dtype=float)
    half=pd.DataFrame([r['halftime'] for r in rows],dtype=float)
    market=pd.DataFrame([{k:v for k,v in r['market'].items() if k.startswith('market_')} for r in rows],dtype=float)
    y=pd.DataFrame([r['targets'] for r in rows]);seasons=np.array([r['season'] for r in rows])
    results=[];prediction_rows=[];oof=np.full((len(rows),3),np.nan)
    groups=pregame_columns(pre)
    for season in sorted(set(seasons))[1:]:
        train=seasons<season;test=seasons==season
        assert seasons[train].max()<seasons[test].min()
        for name,columns in groups.items():
            if name in ('P2','P3') and not pre.loc[train,[c for c in columns if c.endswith('_player_impact')]].notna().any().any():
                results.append({'task':'pregame','group':name,'season':int(season),'status':'no_validated_player_impact_coverage'});continue
            margin=regressor().fit(pre.loc[train,columns],y.loc[train,'final_margin']).predict(pre.loc[test,columns])
            total=regressor().fit(pre.loc[train,columns],y.loc[train,'final_total']).predict(pre.loc[test,columns])
            probability=classifier().fit(pre.loc[train,columns],y.loc[train,'winner']).predict_proba(pre.loc[test,columns])[:,1]
            report=metrics(y.loc[test,'final_margin'],margin,probability,y.loc[test,'winner'])
            report.update(task='pregame',group=name,season=int(season),total_mae=float(mean_absolute_error(y.loc[test,'final_total'],total)),
                          total_rmse=math.sqrt(mean_squared_error(y.loc[test,'final_total'],total)),train_seasons=sorted(map(int,set(seasons[train]))))
            results.append(report)
            if name=='P1':
                oof[test]=np.column_stack([margin,total,probability])
            for i,m,t,p in zip(np.flatnonzero(test),margin,total,probability):
                prediction_rows.append({'game_id':rows[i]['game_id'],'group':name,'task':'pregame','season':int(season),
                    'margin':float(m),'total':float(t),'probability':float(p),'training_max_season':int(seasons[train].max())})
    # Stacked market model trains only on prior-season out-of-fold basketball predictions.
    stack=pd.DataFrame(oof,columns=['prior_margin','prior_total','prior_probability'])
    joined=pd.concat([stack,market],axis=1)
    market_ok=market[['market_spread','market_total','market_probability']].notna().all(axis=1).to_numpy()
    for season in sorted(set(seasons))[2:]:
        train=(seasons<season)&np.isfinite(oof).all(axis=1)&market_ok
        test=(seasons==season)&np.isfinite(oof).all(axis=1)&market_ok
        if train.sum()<30 or test.sum()<10:
            results.append({'task':'pregame','group':'P4','season':int(season),'status':'insufficient_timestamped_market_coverage','train_rows':int(train.sum()),'test_rows':int(test.sum())});continue
        m=regressor().fit(joined.loc[train],y.loc[train,'final_margin']).predict(joined.loc[test])
        t=regressor().fit(joined.loc[train],y.loc[train,'final_total']).predict(joined.loc[test])
        p=classifier().fit(joined.loc[train],y.loc[train,'winner']).predict_proba(joined.loc[test])[:,1]
        results.append(dict(metrics(y.loc[test,'final_margin'],m,p,y.loc[test,'winner']),task='pregame',group='P4',season=int(season),total_mae=float(mean_absolute_error(y.loc[test,'final_total'],t))))
        for i,margin,total,probability in zip(np.flatnonzero(test),m,t,p):
            prediction_rows.append({'game_id':rows[i]['game_id'],'group':'P4','task':'pregame','season':int(season),
                'margin':float(margin),'total':float(total),'probability':float(probability),'training_max_season':int(seasons[train].max())})
        results.append(dict(metrics(y.loc[test,'final_margin'],-market.loc[test,'market_spread'],market.loc[test,'market_probability'],y.loc[test,'winner']),task='market_benchmark',group='available_at_cutoff',season=int(season)))
    half=pd.concat([half,stack,market],axis=1)
    hgroups=halftime_columns(half)
    # Equal cohort for non-market ablations. H2 is separately reported unavailable without quotes.
    ready=np.isfinite(oof).all(axis=1)&np.array([r.get('halftime_eligible',False) for r in rows])
    for season in sorted(set(seasons))[2:]:
        train=(seasons<season)&ready;test=(seasons==season)&ready
        market_available=bool((train&market_ok).sum()>=30 and (test&market_ok).sum()>=10)
        if market_available:
            # Every halftime group uses the same market-covered cohort in this fold.
            train=train&market_ok;test=test&market_ok
        if train.sum()<30 or test.sum()<10:
            results.append({'task':'halftime','group':'all','season':int(season),'status':'insufficient_strict_halftime_coverage','train_rows':int(train.sum()),'test_rows':int(test.sum())})
            continue
        for name,columns in hgroups.items():
            usable=columns if market_available else [c for c in columns if not c.startswith('market_')]
            if name=='H2' and not market_available:
                results.append({'task':'halftime','group':name,'season':int(season),'status':'insufficient_timestamped_market_coverage'});continue
            if name=='H5' and not half.loc[train,[c for c in usable if c.endswith('_h2_strength')]].notna().any().any():
                results.append({'task':'halftime','group':name,'season':int(season),'status':'no_validated_personnel_coverage'});continue
            fit=regressor().fit(half.loc[train,usable],y.loc[train,'h2_margin'])
            margin=fit.predict(half.loc[test,usable])
            total=regressor().fit(half.loc[train,usable],y.loc[train,'h2_total']).predict(half.loc[test,usable])
            # Residual variance is training-only. These Normal probabilities are not claimed calibrated.
            scale=max(float(np.std(y.loc[train,'h2_margin']-fit.predict(half.loc[train,usable]),ddof=1)),1)
            probability=ndtr((half.loc[test,'h1_margin'].to_numpy()+margin)/scale)
            report=metrics(y.loc[test,'h2_margin'],margin,probability,y.loc[test,'winner'])
            report.update(task='halftime',group=name,season=int(season),total_mae=float(mean_absolute_error(y.loc[test,'h2_total'],total)),
                total_rmse=math.sqrt(mean_squared_error(y.loc[test,'h2_total'],total)),market_prior_used=market_available and name not in ('H0','H1'),
                train_seasons=sorted(map(int,set(seasons[train]))),probability_status='training-residual normal approximation; not calibrated')
            results.append(report)
            for i,m,t,p in zip(np.flatnonzero(test),margin,total,probability):
                prediction_rows.append({'game_id':rows[i]['game_id'],'group':name,'task':'halftime','season':int(season),
                    'margin':float(m),'total':float(t),'probability':float(p),'training_max_season':int(seasons[train].max())})
    # Select on earlier evaluation folds only; never choose using the last holdout season.
    selection={}
    last=max(seasons)
    for task,baseline in [('pregame','P0'),('halftime','H0')]:
        prior_reports=[r for r in results if r['task']==task and r['season']<last and 'mae' in r and r['group']!='P4']
        means={group:float(np.mean([r['mae'] for r in prior_reports if r['group']==group])) for group in sorted({r['group'] for r in prior_reports})}
        selection[task]={'selected':min(means,key=means.get) if means else baseline,'selection_fold_limit':int(last)-1,'earlier_fold_mae':means}
    # Export a reproducible last-holdout model, never refit on the evaluation season.
    artifacts=DATA/'artifacts';artifacts.mkdir(exist_ok=True)
    for filename in ('pregame.joblib','pregame.manifest.json','pregame_prior.joblib','pregame_prior.manifest.json','halftime.joblib','halftime.manifest.json','market.joblib','market.manifest.json'):
        (artifacts/filename).unlink(missing_ok=True)
    chosen=selection['pregame']['selected']
    if chosen in groups:
        columns=groups[chosen];train=seasons<last
        bundle={'columns':columns,'group':chosen,'training_max_season':int(seasons[train].max()),
                'margin':regressor().fit(pre.loc[train,columns],y.loc[train,'final_margin']),
                'total':regressor().fit(pre.loc[train,columns],y.loc[train,'final_total']),
                'win':classifier().fit(pre.loc[train,columns],y.loc[train,'winner'])}
        path=artifacts/'pregame.joblib';joblib.dump(bundle,path)
        manifest={'group':chosen,'features':columns,'training_seasons':sorted(map(int,set(seasons[train]))),
                  'holdout_season':int(last),'artifact_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                  'dataset_sha256':hashlib.sha256((DATA/'derived/dataset.json').read_bytes()).hexdigest(),
                  'purpose':'Last-holdout reproduction; load only locally trusted joblib files.'}
        (artifacts/'pregame.manifest.json').write_text(json.dumps(manifest,indent=2))
    # H1 and P4 use P1 priors even when P0 wins standalone margin selection.
    columns=groups['P1'];train=seasons<last
    prior_bundle={'columns':columns,'group':'P1','training_max_season':int(seasons[train].max()),
        'margin':regressor().fit(pre.loc[train,columns],y.loc[train,'final_margin']),
        'total':regressor().fit(pre.loc[train,columns],y.loc[train,'final_total']),
        'win':classifier().fit(pre.loc[train,columns],y.loc[train,'winner'])}
    prior_path=artifacts/'pregame_prior.joblib';joblib.dump(prior_bundle,prior_path)
    (artifacts/'pregame_prior.manifest.json').write_text(json.dumps({'group':'P1','features':columns,
        'training_max_season':prior_bundle['training_max_season'],'holdout_season':int(last),
        'artifact_sha256':hashlib.sha256(prior_path.read_bytes()).hexdigest(),
        'dataset_sha256':hashlib.sha256((DATA/'derived/dataset.json').read_bytes()).hexdigest()},indent=2))
    market_train=(seasons<last)&np.isfinite(oof).all(axis=1)&market_ok
    if market_train.sum()>=30:
        bundle={'columns':list(joined.columns),'group':'P4','training_max_season':int(seasons[market_train].max()),
                'margin':regressor().fit(joined.loc[market_train],y.loc[market_train,'final_margin']),
                'total':regressor().fit(joined.loc[market_train],y.loc[market_train,'final_total']),
                'win':classifier().fit(joined.loc[market_train],y.loc[market_train,'winner'])}
        path=artifacts/'market.joblib';joblib.dump(bundle,path)
        (artifacts/'market.manifest.json').write_text(json.dumps({'group':'P4','features':list(joined.columns),
            'training_max_season':bundle['training_max_season'],'training_rows':int(market_train.sum()),
            'artifact_sha256':hashlib.sha256(path.read_bytes()).hexdigest()},indent=2))
    chosen_half=selection['halftime']['selected']
    train=(seasons<last)&ready
    export_market=(train&market_ok).sum()>=30 and ((seasons==last)&ready&market_ok).sum()>=10
    if export_market:
        train=train&market_ok
    if train.sum()>=30 and chosen_half in hgroups and (chosen_half!='H2' or export_market):
        columns=hgroups[chosen_half] if export_market else [c for c in hgroups[chosen_half] if not c.startswith('market_')]
        margin_fit=regressor().fit(half.loc[train,columns],y.loc[train,'h2_margin'])
        scale=max(float(np.std(y.loc[train,'h2_margin']-margin_fit.predict(half.loc[train,columns]),ddof=1)),1)
        bundle={'columns':columns,'group':chosen_half,'training_max_season':int(seasons[train].max()),
                'margin':margin_fit,'total':regressor().fit(half.loc[train,columns],y.loc[train,'h2_total']),
                'residual_scale':scale,'probability_status':'uncalibrated Normal approximation'}
        path=artifacts/'halftime.joblib';joblib.dump(bundle,path)
        manifest={'group':chosen_half,'features':columns,'training_seasons':sorted(map(int,set(seasons[train]))),
                  'holdout_season':int(last),'strict_training_rows':int(train.sum()),
                  'artifact_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                  'dataset_sha256':hashlib.sha256((DATA/'derived/dataset.json').read_bytes()).hexdigest()}
        (artifacts/'halftime.manifest.json').write_text(json.dumps(manifest,indent=2))
    report={'coverage':{'games':len(rows),'seasons':sorted(map(int,set(seasons))),'timestamped_market_rows':int(market_ok.sum()),
                       'strict_halftime_rows':sum(r.get('halftime_eligible',False) for r in rows)},
        'results':results,'selection':selection,'limitations':['Historical NBA events are reconstructed, not original live receipts.',
        'Halftime H3-H6 omit unavailable market priors; not full H2-conditioned ablations.',
        'H2 probabilities are uncalibrated training-residual approximations.']}
    (DATA/'reports').mkdir(exist_ok=True)
    (DATA/'reports/evaluation.json').write_text(json.dumps(report,indent=2,allow_nan=False))
    pd.DataFrame(prediction_rows).to_parquet(DATA/'reports/predictions.parquet',index=False)
    with db.engine().begin() as conn:
        for table in ('pregame_predictions','halftime_predictions'):
            conn.execute(db.tables[table].delete())
        for r in prediction_rows:
            db.derived(conn,r['task']+'_predictions',r['game_id']+':'+r['group'],r,game_id=r['game_id'])
    return {'coverage':report['coverage'],'selection':selection,'report':str(DATA/'reports/evaluation.json')}

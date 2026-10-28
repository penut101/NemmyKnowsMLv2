"""Validate generated data and serialized models, not just importability."""
import hashlib
import json
import math
from collections import defaultdict
import joblib
import numpy as np
import pandas as pd
from scipy.special import ndtr
from . import db
from .config import DATA
from .pit import strictly_before


def validate_outputs():
    path=DATA/'derived/dataset.json'
    rows=json.loads(path.read_text())
    by_id={r['game_id']:r for r in rows}
    assert len(by_id)==len(rows), 'Duplicate feature game IDs'
    for row in rows:
        assert strictly_before(row['rating_as_of'],row['cutoff']), 'Rating cutoff violation'
        assert row['halftime']['max_feature_period']<=2, 'Post-Q2 input'
        assert row['targets']['winner']==int(row['targets']['final_margin']>0)
    predictions=pd.read_parquet(DATA/'reports/predictions.parquet')
    assert (predictions.training_max_season<predictions.season).all(), 'Future-season training'
    assert np.isfinite(predictions[['margin','total','probability']]).all().all()
    assert predictions.probability.between(0,1).all()
    for gid in predictions.loc[predictions.task.eq('halftime'),'game_id']:
        assert by_id[gid]['halftime_eligible'], 'Ineligible halftime prediction'
    totals=defaultdict(float)
    with db.engine().connect() as conn:
        for record in db.rows(conn,'projected_minutes'):
            payload=record['payload'];stage=payload.get('stage','pregame')
            minutes=payload.get('remaining_regulation_minutes',payload.get('regulation_minutes'))
            assert minutes is not None and 0<=minutes<=(24 if stage=='halftime' else 48)+1e-7
            totals[(record['game_id'],record['team_id'],stage)]+=minutes
        stored=sum(len(db.rows(conn,t)) for t in ('pregame_predictions','halftime_predictions'))
    assert stored==len(predictions), 'Stale or missing database predictions'
    for (_,_,stage),minutes in totals.items():
        assert math.isclose(minutes,120 if stage=='halftime' else 240,abs_tol=1e-6), 'Minute conservation'
    artifact=DATA/'artifacts/pregame.joblib'
    manifest=json.loads((DATA/'artifacts/pregame.manifest.json').read_text())
    assert hashlib.sha256(path.read_bytes()).hexdigest()==manifest['dataset_sha256']
    assert hashlib.sha256(artifact.read_bytes()).hexdigest()==manifest['artifact_sha256']
    bundle=joblib.load(artifact)
    holdout=[r for r in rows if r['season']==manifest['holdout_season']]
    frame=pd.DataFrame([r['pregame'] for r in holdout],dtype=float)
    expected=predictions[(predictions.task=='pregame')&(predictions.group==bundle['group'])&
                         (predictions.season==manifest['holdout_season'])].set_index('game_id')
    expected=expected.loc[[r['game_id'] for r in holdout]]
    np.testing.assert_allclose(bundle['margin'].predict(frame[bundle['columns']]),expected.margin,atol=1e-8)
    np.testing.assert_allclose(bundle['total'].predict(frame[bundle['columns']]),expected.total,atol=1e-8)
    np.testing.assert_allclose(bundle['win'].predict_proba(frame[bundle['columns']])[:,1],expected.probability,atol=1e-8)
    half_verified=False
    if (DATA/'artifacts/halftime.joblib').exists():
        half_bundle=joblib.load(DATA/'artifacts/halftime.joblib')
        prior=joblib.load(DATA/'artifacts/pregame_prior.joblib')
        priors=pd.DataFrame({'prior_margin':prior['margin'].predict(frame[prior['columns']]),
                            'prior_total':prior['total'].predict(frame[prior['columns']]),
                            'prior_probability':prior['win'].predict_proba(frame[prior['columns']])[:,1]},
                           index=[r['game_id'] for r in holdout])
        half_rows=predictions[(predictions.task=='halftime')&(predictions.group==half_bundle['group'])&
                             (predictions.season==manifest['holdout_season'])].set_index('game_id')
        half_frame=pd.DataFrame([{**by_id[gid]['halftime'],**priors.loc[gid].to_dict(),
            **{k:v for k,v in by_id[gid]['market'].items() if k.startswith('market_')}} for gid in half_rows.index],dtype=float)
        x=half_frame[half_bundle['columns']]
        margin=half_bundle['margin'].predict(x)
        np.testing.assert_allclose(margin,half_rows.margin,atol=1e-8)
        np.testing.assert_allclose(half_bundle['total'].predict(x),half_rows.total,atol=1e-8)
        np.testing.assert_allclose(ndtr((half_frame.h1_margin+margin)/half_bundle['residual_scale']),half_rows.probability,atol=1e-8)
        half_verified=True
    report={'status':'passed','games':len(rows),'prediction_rows':len(predictions),'minute_allocations':len(totals),
            'strict_halftime_games':sum(r['halftime_eligible'] for r in rows),
            'saved_model_reproduces_holdout':True,'halftime_model_and_prior_reproduce_holdout':half_verified,
            'dataset_sha256':manifest['dataset_sha256']}
    (DATA/'reports/output_validation.json').write_text(json.dumps(report,indent=2))
    return report

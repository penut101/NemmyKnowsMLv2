import json
import numpy as np
import pandas as pd
import joblib
from src import db,modeling

def test_future_season_poisoning_does_not_change_earlier_predictions(tmp_path,monkeypatch):
    root=tmp_path/'run';(root/'derived').mkdir(parents=True)
    monkeypatch.setattr(modeling,'DATA',root)
    engine=db.engine('sqlite:///'+(root/'eval.sqlite').as_posix())
    db.metadata.create_all(engine)
    monkeypatch.setattr(db,'engine',lambda:engine)
    rng=np.random.default_rng(14);rows=[]
    for season in range(2020,2024):
        for i in range(35):
            margin=float(rng.normal(2,12));h1=float(rng.normal(1,8))
            gid=f'{season}-{i}'
            rows.append({'game_id':gid,'season':season,'halftime_eligible':True,'pregame':{'home_elo':1500+i,'away_elo':1500,'home_rest':2,'away_rest':3,
                'home_adjusted_net':i/10,'away_adjusted_net':0,'home_player_impact':None,'away_player_impact':None},
                'market':{'market_spread':None,'market_total':None,'market_probability':None,'market_book_count':0},
                'halftime':{'h1_margin':h1,'h1_total':105+i%10,'home_h2_strength':None,'away_h2_strength':None},
                'targets':{'final_margin':margin,'final_total':215+i%20,'winner':int(margin>0),'h2_margin':margin-h1,'h2_total':110+i%9}})
            with engine.begin() as c:
                db.put(c,'games',dict(game_id=gid,season=season,start_time=None,completed_at=None,home_team_id=None,away_team_id=None,status='fixture',payload={}))
    (root/'derived/dataset.json').write_text(json.dumps(rows))
    modeling.evaluate()
    before=pd.read_parquet(root/'reports/predictions.parquet')
    bundle=joblib.load(root/'artifacts/pregame.joblib')
    holdout=[r for r in rows if r['season']==2023]
    frame=pd.DataFrame([r['pregame'] for r in holdout],dtype=float)
    expected=before[(before.season==2023)&(before.group==bundle['group'])&(before.task=='pregame')]
    np.testing.assert_allclose(bundle['margin'].predict(frame[bundle['columns']]),expected.margin)
    assert bundle['training_max_season']==2022
    for row in rows:
        if row['season']==2023:
            row['targets']['final_margin']*=100
            row['targets']['h2_margin']*=100
            row['pregame']['home_elo']*=10
    (root/'derived/dataset.json').write_text(json.dumps(rows))
    modeling.evaluate()
    after=pd.read_parquet(root/'reports/predictions.parquet')
    pd.testing.assert_frame_equal(before[before.season<2023].reset_index(drop=True),after[after.season<2023].reset_index(drop=True))
    assert (after.training_max_season<after.season).all()

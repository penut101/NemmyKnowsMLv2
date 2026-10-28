import copy
import numpy as np
import pytest
from src.features import period_state,targets,team_strength
from src.markets import devig,expected_home_margin,consensus
from src.minutes import allocate,project,status_probabilities
from src.rotations import reconstruct,validate_minutes,RotationError,rapm
from src.injuries import eligible_snapshots,normalize_status
from src.storage import RawStore

def event(period,second,home,away,**kwargs):
    return dict(period=period,second=second,home_score=home,away_score=away,kind=13,subtype=0,
                description='',p1=0,p2=0,p3=0,t1=None,t2=None,t3=None,**kwargs)

def test_halftime_ignores_every_second_half_and_overtime_value():
    e=[event(1,720,25,21),event(2,1440,52,49),event(3,2160,75,77),event(4,2880,101,101),event(5,3180,113,109)]
    before=period_state(e,'H','A')
    changed=copy.deepcopy(e)
    for row in changed[2:]:
        row.update(home_score=999,away_score=3,description='3PT DUNK',kind=1,p1=999,t1='H')
    assert period_state(changed,'H','A')==before
    assert targets(e)['h2_margin']==-3
    assert targets(e)['h2_total']==101
    assert targets(e)['winner']==1

def test_moneyline_and_spread_conventions():
    assert expected_home_margin(-4.5)==4.5
    assert expected_home_margin(3)==-3
    p=devig(-150,130)
    assert p['home']+p['away']==pytest.approx(1)
    with pytest.raises(ValueError):devig(0,100)

def test_snapshot_timestamp_and_unknown_time_are_excluded():
    rows=[dict(sportsbook='x',market='spread',side='home',line=-3,available_at='2022-01-01T00:00:00+00:00',period='full',is_live=False)]
    assert consensus(rows,'2021-12-31T00:00:00+00:00')['market_spread'] is None
    assert consensus([{**rows[0],'available_at':None}],'2023-01-01T00:00:00Z')['market_spread'] is None
    assert consensus(rows,'2023-01-01T00:00:00Z')['market_spread']==-3

def test_raw_objects_never_overwrite(tmp_path):
    store=RawStore(tmp_path)
    a,_=store.put(b'one','source','endpoint');b,_=store.put(b'two','source','endpoint')
    assert a!=b and a.read_bytes()==b'one'
    a.write_bytes(b'corrupted')
    with pytest.raises(ValueError):store.put(b'one','source','endpoint')

def test_out_players_zero_and_replacement_minutes_conserved():
    weights=[0,32,30,28,25,20,18,15,10]
    result=allocate(weights)
    assert result[0]==0 and sum(result)==pytest.approx(240) and max(result)<=48
    assert sum(allocate(weights,120,24))==pytest.approx(120)
    with pytest.raises(ValueError):allocate([1,1,1,1])

def test_target_game_minutes_cannot_change_projection():
    roster=list('abcdefgh')
    history=[dict(player_id=p,completed_at='2021-01-01T00:00:00Z',regulation_minutes=30) for p in roster]
    before=project(history,roster,'2022-01-01T00:00:00Z')
    future=history+[dict(player_id='a',completed_at='2022-01-02T00:00:00Z',regulation_minutes=48)]
    assert project(future,roster,'2022-01-01T00:00:00Z')==before

def test_injury_status_not_ordinal_and_future_snapshot_rejected():
    row=dict(game_id='g',player_id='p',report_time='2023-01-02T00:00:00Z',status='OUT')
    assert eligible_snapshots([row],'2023-01-01T00:00:00Z')==[]
    assert normalize_status('Questionable')=='QUESTIONABLE'
    with pytest.raises(ValueError):normalize_status('3')

def test_rotation_missing_box_cannot_be_treated_as_valid():
    with pytest.raises(RotationError):validate_minutes([], {})

def test_rapm_filters_future_and_unvalidated_stints():
    s=dict(home_players=[1,2,3,4,5],away_players=[6,7,8,9,10],possessions=10,margin=5,
           stint_seconds=300,completed_at='2023-01-02T00:00:00Z',validated=True)
    assert rapm([s],'2023-01-01T00:00:00Z')=={}
    assert rapm([{**s,'completed_at':'2022-01-01T00:00:00Z','validated':False}],'2023-01-01T00:00:00Z')=={}

def test_team_ratings_ignore_future_scores():
    assert team_strength([{'completed_at':'2030-01-01T00:00:00Z'}],'2023-01-01T00:00:00Z')=={}


def test_empirical_status_probabilities_use_only_past_outcomes():
    history=[dict(status='QUESTIONABLE',played=True,completed_at='2022-01-01T00:00:00Z'),
             dict(status='QUESTIONABLE',played=False,completed_at='2024-01-01T00:00:00Z')]
    assert status_probabilities(history,'2023-01-01T00:00:00Z')['QUESTIONABLE']==pytest.approx(2/3)

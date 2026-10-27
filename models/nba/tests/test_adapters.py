import pytest
from src.markets import normalize_action,normalize_espn,consensus
from src.pit import known_by,timestamp

def test_timezone_offsets_are_compared_as_instants():
    assert not known_by('2023-01-01T09:00:00-05:00','2023-01-01T12:00:00Z')
    assert known_by('2023-01-01T09:00:00-05:00','2023-01-01T14:00:00Z')
    with pytest.raises(ValueError):timestamp('2023-01-01')

def test_action_books_are_not_automatically_openers():
    payload={'games':[{'id':1,'start_time':'2023-01-02T00:00:00Z','markets':{'15':{'event':{'spread':[
        {'side':'home','value':-3.5,'odds':-110,'period':'event','is_live':False,'is_alt_market':False}]}}}}]}
    receipt={'requested_at':'2023-01-01T00:00:00Z','payload_hash':'abc'}
    rows=normalize_action(payload,{'1':'0022200001'},receipt)
    assert rows[0]['line']==-3.5 and not rows[0]['is_opening']
    assert rows[0]['game_id']=='0022200001'

def test_espn_actual_nested_contract_and_stage_selection():
    payload={'items':[{'provider':{'name':'Book'},'homeTeamOdds':{
        'open':{'pointSpread':{'american':'-2.5'},'spread':{'american':'-110'}},
        'current':{'pointSpread':{'american':'-4'},'spread':{'american':'-110'}}},
        'open':{'total':{'value':220},'over':{'american':'-110'}},
        'current':{'total':{'value':221},'over':{'american':'-110'}}}]}
    receipt={'requested_at':'2023-01-01T00:00:00Z','payload_hash':'abc'}
    rows=normalize_espn(payload,{'game_id':'g','external_id':'x'},receipt)
    c=consensus(rows,'2023-01-01T01:00:00Z')
    assert c['market_opening_spread']==-2.5
    assert c['market_spread']==-4 and c['market_line_movement']==-1.5

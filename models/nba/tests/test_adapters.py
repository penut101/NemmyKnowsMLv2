import pytest
import pandas as pd
from src.sources import normalize_game
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


def test_canonical_identity_and_final_score_reconciliation():
    events=[];cdn=[]
    for period in range(1,5):
        events.append(dict(GAME_ID=22200001,EVENTNUM=period,PERIOD=period,
            PCTIMESTRING='0:00',EVENTMSGTYPE=13,EVENTMSGACTIONTYPE=0,SCORE=f'{20*period} - {21*period}',
            HOMEDESCRIPTION=None,VISITORDESCRIPTION=None,NEUTRALDESCRIPTION=None,
            PERSON1TYPE=4,PERSON2TYPE=5,PERSON3TYPE=0,
            PLAYER1_TEAM_ID=100,PLAYER2_TEAM_ID=200,PLAYER3_TEAM_ID=0,
            PLAYER1_ID=1,PLAYER2_ID=2,PLAYER3_ID=0))
        stamp=f'2023-01-01T0{period}:00:00Z'
        cdn.append(dict(period=period,orderNumber=period,scoreHome=21*period,scoreAway=20*period,
                        timeActual=stamp,edited=stamp,actionType='period',subType='end'))
    frame=pd.DataFrame(events);live=pd.DataFrame(cdn)
    game=normalize_game(frame,live,2022)
    assert game['home_team_id']=='100' and game['away_team_id']=='200'
    bad=live.copy();bad.loc[3,'scoreHome']=999
    with pytest.raises(ValueError,match='score reconciliation'):
        normalize_game(frame,bad,2022)
    frame.loc[1,'PLAYER1_TEAM_ID']=300
    with pytest.raises(ValueError,match='canonical'):
        normalize_game(frame,live,2022)


@pytest.mark.parametrize('compact',[False,True])
def test_injury_headers_support_both_historical_layouts(compact):
    from src.injuries import header_bounds
    labels=['Game Date','Game Time','Matchup','Team','Player Name','Current Status','Reason']
    words=[]
    for index,label in enumerate(labels):
        tokens=[label.replace(' ','')] if compact else label.split()
        words.extend(dict(text=token,x0=index*100+part*25,top=58.0) for part,token in enumerate(tokens))
    assert header_bounds(words)==[index*100-2 for index in range(7)]

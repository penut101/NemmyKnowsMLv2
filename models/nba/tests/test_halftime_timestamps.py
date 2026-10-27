import pandas as pd
from src.sources import halftime_provenance,statistics_available_at
from src.pit import strictly_before

def test_revised_h1_after_halftime_is_not_admitted():
    rows=pd.DataFrame([
        dict(period=1,actionType='shot',subType='made',timeActual='2023-01-01T01:00:00Z',edited='2023-01-01T01:00:00Z'),
        dict(period=2,actionType='period',subType='end',timeActual='2023-01-01T02:00:00Z',edited='2023-01-01T02:00:00Z'),
        dict(period=3,actionType='shot',subType='made',timeActual='2023-01-01T03:00:00Z',edited='2023-01-01T03:00:00Z')])
    assert halftime_provenance(rows)['halftime_eligible']
    rows.loc[0,'edited']='2023-01-01T02:00:01Z'
    assert not halftime_provenance(rows)['halftime_eligible']


def test_full_game_corrections_are_unavailable_until_the_latest_edit():
    rows=pd.DataFrame([dict(timeActual='2023-01-01T03:00:00Z',edited='2023-01-05T12:00:00Z')])
    available=statistics_available_at(rows)
    assert not strictly_before(available,'2023-01-03T00:00:00Z')
    assert strictly_before(available,'2023-01-06T00:00:00Z')
    rows.loc[0,'edited']=None
    assert statistics_available_at(rows) is None

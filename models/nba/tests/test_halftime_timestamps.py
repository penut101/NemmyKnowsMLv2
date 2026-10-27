import pandas as pd
from src.sources import halftime_provenance

def test_revised_h1_after_halftime_is_not_admitted():
    rows=pd.DataFrame([
        dict(period=1,actionType='shot',subType='made',timeActual='2023-01-01T01:00:00Z',edited='2023-01-01T01:00:00Z'),
        dict(period=2,actionType='period',subType='end',timeActual='2023-01-01T02:00:00Z',edited='2023-01-01T02:00:00Z'),
        dict(period=3,actionType='shot',subType='made',timeActual='2023-01-01T03:00:00Z',edited='2023-01-01T03:00:00Z')])
    assert halftime_provenance(rows)['halftime_eligible']
    rows.loc[0,'edited']='2023-01-01T02:00:01Z'
    assert not halftime_provenance(rows)['halftime_eligible']

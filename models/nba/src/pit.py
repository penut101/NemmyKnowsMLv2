"""UTC-only knowledge-time comparisons; never compare arbitrary ISO strings."""
import pandas as pd
from functools import lru_cache

@lru_cache(maxsize=65536)
def timestamp(value):
    result=pd.Timestamp(value)
    if result.tzinfo is None:
        raise ValueError('Point-in-time timestamps must include a timezone')
    return result.tz_convert('UTC')

def known_by(value,cutoff):
    return value is not None and timestamp(value)<=timestamp(cutoff)

def strictly_before(value,cutoff):
    return value is not None and timestamp(value)<timestamp(cutoff)

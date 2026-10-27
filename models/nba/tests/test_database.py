import os
import subprocess
import sys
from pathlib import Path
import pytest
from sqlalchemy import text
from src import db

def test_fresh_migration_and_raw_snapshot_immutability(tmp_path):
    url=os.getenv('NBA_TEST_DATABASE_URL') or 'sqlite:///'+(tmp_path/'test.sqlite').as_posix()
    env={**os.environ,'NBA_DATABASE_URL':url}
    subprocess.run([sys.executable,'-m','src.cli','migrate'],env=env,check=True,capture_output=True)
    e=db.engine(url)
    with e.begin() as c:
        db.put(c,'raw_nba_payloads',dict(id='immutable-test',payload_hash='abc',source='test',endpoint='fixture',requested_at='2023-01-01T00:00:00Z',payload={'fixture':True}),immutable=True)
        db.derived(c,'injury_snapshots','immutable-snapshot-test',{'status':'OUT'})
    for table in ('raw_nba_payloads','injury_snapshots'):
        with pytest.raises(Exception):
            with e.begin() as c:
                c.execute(text(f'UPDATE {table} SET payload=:payload'),{'payload':'{}'})
    e.dispose()

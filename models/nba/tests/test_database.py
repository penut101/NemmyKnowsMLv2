import os
import subprocess
import sys
from pathlib import Path
import pytest
from sqlalchemy import text, inspect
from sqlalchemy.exc import DBAPIError
from src import db

@pytest.mark.parametrize('backend', ['sqlite', 'postgresql'])
def test_fresh_migration_and_raw_snapshot_immutability(tmp_path, backend):
    url = 'sqlite:///'+(tmp_path/'test.sqlite').as_posix()
    if backend == 'postgresql':
        url = os.getenv('NBA_TEST_DATABASE_URL')
        if not url:
            pytest.skip('NBA_TEST_DATABASE_URL must identify a disposable PostgreSQL 17 database')
        from sqlalchemy.engine import make_url
        assert make_url(url).host in ('localhost', '127.0.0.1', '::1')
    env={**os.environ,'NBA_DATABASE_URL':url}
    subprocess.run([sys.executable,'-m','src.cli','migrate'],env=env,check=True,capture_output=True)
    e=db.engine(url)
    schema = 'nba' if backend == 'postgresql' else None
    catalog = inspect(e)
    assert set(catalog.get_table_names(schema=schema)) == set(db.tables) | {'alembic_version'}
    assert catalog.get_foreign_keys('games', schema=schema)
    assert catalog.get_indexes('games', schema=schema)
    if schema:
        assert not (set(catalog.get_table_names(schema='public')) & set(db.tables))
        with e.connect() as c:
            assert c.execute(text('SHOW server_version_num')).scalar().startswith('17')
            assert c.execute(text("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='nba' AND c.relkind='r' AND NOT c.relrowsecurity")).scalar() == 0
    with e.begin() as c:
        db.put(c,'raw_nba_payloads',dict(id='immutable-test',payload_hash='abc',source='test',endpoint='fixture',requested_at='2023-01-01T00:00:00Z',payload={'fixture':True}),immutable=True)
        db.derived(c,'injury_snapshots','immutable-snapshot-test',{'status':'OUT'})
    for table in ('raw_nba_payloads','injury_snapshots'):
        for statement in (f'UPDATE {table} SET payload=:payload', f'DELETE FROM {table}'):
            with pytest.raises(DBAPIError, match='immutable'):
                with e.begin() as c:
                    c.execute(text(statement), {'payload':'{}'})
        if schema:
            with pytest.raises(DBAPIError, match='immutable'):
                with e.begin() as c:
                    c.execute(text(f'TRUNCATE nba.{table}'))
    with pytest.raises(DBAPIError, match='foreign key|FOREIGN KEY'):
        with e.begin() as c:
            db.put(c, 'games', dict(game_id='bad-fk',home_team_id='missing-team',payload={}))
    # An already-migrated database must upgrade again without changing history.
    subprocess.run([sys.executable,'-m','src.cli','migrate'],env=env,check=True,capture_output=True)
    if schema:
        with e.connect() as c:
            assert c.execute(text("SELECT version_num FROM nba.alembic_version")).scalar() == '0005'
    e.dispose()

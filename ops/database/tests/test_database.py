import os
from pathlib import Path
import sys

import psycopg
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from setup import check_target, install


@pytest.fixture
def connection():
    url = os.getenv('PLATFORM_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Requires a fully installed disposable localhost database')
    check_target(url, True, None)
    with psycopg.connect(url) as conn:
        try:
            yield conn
        finally:
            conn.rollback()


def test_untracked_existing_schema_requires_exact_contract(connection):
    connection.execute("DELETE FROM platform_setup.migrations WHERE sport='nfl'")
    install(connection, 'nfl')  # Must verify, not execute the non-idempotent baseline.
    assert connection.execute("SELECT count(*) FROM platform_setup.migrations WHERE sport='nfl'").fetchone()[0] == 0
    connection.execute('ALTER TABLE nfl.teams ADD COLUMN unexplained_drift text')
    with pytest.raises(ValueError, match='refusing baseline replay'):
        install(connection, 'nfl')


def test_changed_migration_checksum_refuses_replay(connection):
    connection.execute("UPDATE platform_setup.migrations SET sha256='changed' WHERE sport='cfb'")
    with pytest.raises(ValueError, match='Applied migration changed'):
        install(connection, 'cfb')

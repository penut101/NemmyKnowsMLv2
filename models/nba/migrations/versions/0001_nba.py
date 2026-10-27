"""NBA V1 catalog and immutable raw history."""
from alembic import op
from src.db import metadata

revision = '0001'
down_revision = None

def upgrade():
    conn = op.get_bind()
    metadata.create_all(conn)
    for table in ('raw_nba_payloads','raw_injury_reports','raw_market_payloads'):
        if conn.dialect.name == 'sqlite':
            for action in ('UPDATE','DELETE'):
                conn.exec_driver_sql(f"CREATE TRIGGER {table}_{action.lower()} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'raw data is immutable'); END")
        else:
            conn.exec_driver_sql("CREATE OR REPLACE FUNCTION nba_reject_raw_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'raw data is immutable'; END $$")
            conn.exec_driver_sql(f'CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON {table} FOR EACH STATEMENT EXECUTE FUNCTION nba_reject_raw_mutation()')

def downgrade():
    raise RuntimeError('Raw history must not be destroyed by downgrade')

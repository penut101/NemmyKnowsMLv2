"""Secure the PostgreSQL catalog; SQLite remains a local research database."""
from alembic import op
from sqlalchemy import text

revision = '0004'
down_revision = '0003'


def upgrade():
    conn = op.get_bind()
    if conn.dialect.name != 'postgresql':
        return
    conn.exec_driver_sql('ALTER FUNCTION nba.nba_reject_raw_mutation() SET search_path = pg_catalog')
    conn.exec_driver_sql('REVOKE ALL ON SCHEMA nba FROM PUBLIC')
    conn.exec_driver_sql('REVOKE ALL ON ALL TABLES IN SCHEMA nba FROM PUBLIC')
    conn.exec_driver_sql('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nba FROM PUBLIC')
    conn.execute(text("""DO $$ DECLARE t record; r text; BEGIN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'nba' LOOP
        EXECUTE format('ALTER TABLE nba.%I ENABLE ROW LEVEL SECURITY', t.tablename);
      END LOOP;
      FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT FROM pg_roles WHERE rolname=r) THEN
          EXECUTE format('REVOKE ALL ON SCHEMA nba FROM %I', r);
          EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA nba FROM %I', r);
          EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nba FROM %I', r);
        END IF;
      END LOOP;
    END $$"""))


def downgrade():
    raise RuntimeError('Do not reopen private research data through downgrade')

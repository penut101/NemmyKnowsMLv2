"""Prevent mutation of historical injury, lineup, and market observations."""
from alembic import op

revision='0002'
down_revision='0001'

def upgrade():
    conn=op.get_bind()
    for table in ('injury_snapshots','market_snapshots','lineup_snapshots'):
        if conn.dialect.name=='sqlite':
            for action in ('UPDATE','DELETE'):
                conn.exec_driver_sql(f"CREATE TRIGGER {table}_{action.lower()} BEFORE {action} ON {table} BEGIN SELECT RAISE(ABORT, 'snapshots are immutable'); END")
        else:
            conn.exec_driver_sql(f'CREATE TRIGGER {table}_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON {table} FOR EACH STATEMENT EXECUTE FUNCTION nba_reject_raw_mutation()')

def downgrade():
    raise RuntimeError('Snapshot history cannot be discarded by downgrade')

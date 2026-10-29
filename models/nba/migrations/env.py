from alembic import context
from src.db import metadata, engine
from sqlalchemy import text

with engine().connect() as connection:
    postgres = connection.dialect.name == 'postgresql'
    if postgres:
        # Do not silently strand a legacy public NBA installation or mistake
        # another application's Alembic ledger for this application's history.
        if connection.execute(text("SELECT to_regclass('public.raw_nba_payloads')")).scalar():
            raise RuntimeError('Legacy public NBA tables require an explicit reviewed schema move before migration')
        connection.execute(text('CREATE SCHEMA IF NOT EXISTS nba'))
        connection.commit()
    context.configure(connection=connection, target_metadata=metadata,
                      version_table_schema='nba' if postgres else None)
    with context.begin_transaction():
        context.run_migrations()

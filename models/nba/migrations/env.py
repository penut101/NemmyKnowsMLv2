from alembic import context
from src.db import metadata, engine

with engine().connect() as connection:
    context.configure(connection=connection, target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()

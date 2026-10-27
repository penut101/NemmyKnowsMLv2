"""Store lineup observations once instead of repeating arrays per player."""
from alembic import op
from src.db import tables

revision='0003'
down_revision='0002'

def upgrade():
    tables['lineup_stints'].create(op.get_bind(),checkfirst=True)

def downgrade():
    raise RuntimeError('Use an explicit derived-data rebuild migration')

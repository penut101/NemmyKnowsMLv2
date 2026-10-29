"""Cover team and source mapping references for joins and FK checks."""
from alembic import op
from src.db import tables

revision = '0005'
down_revision = '0004'


def upgrade():
    for name, column in [('games', 'home_team_id'), ('games', 'away_team_id'),
                         ('source_game_mappings', 'game_id')]:
        index = next(i for i in tables[name].indexes if list(i.columns.keys()) == [column])
        index.create(op.get_bind(), checkfirst=True)


def downgrade():
    raise RuntimeError('Remove indexes only after a reviewed workload analysis')

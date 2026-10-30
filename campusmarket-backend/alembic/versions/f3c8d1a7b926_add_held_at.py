"""add held_at to listings and resources (auto-hold after a pile-up of reports)

Revision ID: f3c8d1a7b926
Revises: e9a4c6b2f053
Create Date: 2026-11-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3c8d1a7b926'
down_revision: Union[str, Sequence[str], None] = 'e9a4c6b2f053'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('held_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_listings_held_at'), 'listings', ['held_at'])
    op.add_column('resources', sa.Column('held_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_resources_held_at'), 'resources', ['held_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_resources_held_at'), table_name='resources')
    op.drop_column('resources', 'held_at')
    op.drop_index(op.f('ix_listings_held_at'), table_name='listings')
    op.drop_column('listings', 'held_at')

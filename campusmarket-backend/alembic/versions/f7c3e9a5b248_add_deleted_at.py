"""add deleted_at to listings and resources (24h restore from the Deleted tab)

Revision ID: f7c3e9a5b248
Revises: e6b2d8f4a137
Create Date: 2026-10-23 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f7c3e9a5b248'
down_revision: Union[str, Sequence[str], None] = 'e6b2d8f4a137'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_listings_deleted_at'), 'listings', ['deleted_at'])
    op.add_column('resources', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_resources_deleted_at'), 'resources', ['deleted_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_resources_deleted_at'), table_name='resources')
    op.drop_column('resources', 'deleted_at')
    op.drop_index(op.f('ix_listings_deleted_at'), table_name='listings')
    op.drop_column('listings', 'deleted_at')

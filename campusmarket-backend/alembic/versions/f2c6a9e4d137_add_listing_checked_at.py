"""add listings.checked_at (when the seller last said an old listing is still available)

Revision ID: f2c6a9e4d137
Revises: e7b3d5a1c824
Create Date: 2026-11-15 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f2c6a9e4d137'
down_revision: Union[str, Sequence[str], None] = 'e7b3d5a1c824'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('checked_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('listings', 'checked_at')

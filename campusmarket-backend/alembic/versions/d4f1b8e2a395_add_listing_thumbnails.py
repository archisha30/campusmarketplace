"""add listings.thumbnails (small copies of photos for listing cards)

Revision ID: d4f1b8e2a395
Revises: c9a2e6f4b731
Create Date: 2026-11-13 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd4f1b8e2a395'
down_revision: Union[str, Sequence[str], None] = 'c9a2e6f4b731'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('thumbnails', sa.JSON(), nullable=False, server_default='{}'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('listings', 'thumbnails')

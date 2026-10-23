"""add listings.mrp (original price shown slashed)

Revision ID: e6b2d8f4a137
Revises: d5a1c7e3f926
Create Date: 2026-10-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e6b2d8f4a137'
down_revision: Union[str, Sequence[str], None] = 'd5a1c7e3f926'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('mrp', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('listings', 'mrp')

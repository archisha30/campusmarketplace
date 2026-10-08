"""add F&B fields to listings

Revision ID: e3f7a1c9b582
Revises: d9b2e6c4a371
Create Date: 2026-10-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e3f7a1c9b582'
down_revision: Union[str, Sequence[str], None] = 'd9b2e6c4a371'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('food_temp', sa.String(length=4), nullable=True))
    op.add_column('listings', sa.Column('expiry_date', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('listings', 'expiry_date')
    op.drop_column('listings', 'food_temp')

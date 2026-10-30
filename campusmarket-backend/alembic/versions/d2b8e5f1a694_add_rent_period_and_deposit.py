"""add rental period and security deposit to listings

Revision ID: d2b8e5f1a694
Revises: c7f2a9d4e318
Create Date: 2026-10-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd2b8e5f1a694'
down_revision: Union[str, Sequence[str], None] = 'c7f2a9d4e318'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('listings', sa.Column('rent_days', sa.Integer(), nullable=True))
    op.add_column('listings', sa.Column('security_deposit', sa.Float(), nullable=True))
    # Rentals listed before periods existed: call them a month, the most common choice.
    op.execute("UPDATE listings SET rent_days = 30 WHERE listing_type = 'rent'")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('listings', 'security_deposit')
    op.drop_column('listings', 'rent_days')

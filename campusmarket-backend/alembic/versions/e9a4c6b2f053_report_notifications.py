"""report notifications: held-back serious reports, grouped report counts, longer notes

Revision ID: e9a4c6b2f053
Revises: d2b8e5f1a694
Create Date: 2026-10-30 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e9a4c6b2f053'
down_revision: Union[str, Sequence[str], None] = 'd2b8e5f1a694'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('reports', sa.Column('owner_notified', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('notifications', sa.Column('count', sa.Integer(), nullable=False, server_default='1'))
    # Removal reasons written by admins can be longer than report reasons.
    op.alter_column('notifications', 'note', type_=sa.String(length=300), existing_type=sa.String(length=200))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('notifications', 'note', type_=sa.String(length=200), existing_type=sa.String(length=300))
    op.drop_column('notifications', 'count')
    op.drop_column('reports', 'owner_notified')

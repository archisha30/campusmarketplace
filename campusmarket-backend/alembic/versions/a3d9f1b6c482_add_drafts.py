"""add drafts (saved Sell / Post a Resource forms)

Revision ID: a3d9f1b6c482
Revises: f7c3e9a5b248
Create Date: 2026-10-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3d9f1b6c482'
down_revision: Union[str, Sequence[str], None] = 'f7c3e9a5b248'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'drafts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_drafts_user_updated', 'drafts', ['user_id', 'updated_at'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_drafts_user_updated', table_name='drafts')
    op.drop_table('drafts')

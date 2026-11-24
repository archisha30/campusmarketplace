"""add otp_failures (daily cap on wrong codes per email)

Revision ID: b9d4e1f6a258
Revises: a8e5c2f7b913
Create Date: 2026-11-21 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b9d4e1f6a258'
down_revision: Union[str, Sequence[str], None] = 'a8e5c2f7b913'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'otp_failures',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_otp_failures_email'), 'otp_failures', ['email'])
    op.create_index(op.f('ix_otp_failures_created_at'), 'otp_failures', ['created_at'])
    # Locked away from Supabase's Data API like every other table (see c7f2a9d4e318).
    op.execute('ALTER TABLE public."otp_failures" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_otp_failures_created_at'), table_name='otp_failures')
    op.drop_index(op.f('ix_otp_failures_email'), table_name='otp_failures')
    op.drop_table('otp_failures')

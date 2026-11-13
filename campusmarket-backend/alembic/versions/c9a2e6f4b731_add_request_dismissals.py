"""add request_dismissals (sellers hiding a "Looking for" request from their feed)

Revision ID: c9a2e6f4b731
Revises: b2e7c4a9d168
Create Date: 2026-11-13 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9a2e6f4b731'
down_revision: Union[str, Sequence[str], None] = 'b2e7c4a9d168'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'request_dismissals',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['request_id'], ['product_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'request_id'),
    )
    op.create_index(op.f('ix_request_dismissals_request_id'), 'request_dismissals', ['request_id'])
    # Locked away from Supabase's Data API like every other table (see c7f2a9d4e318).
    op.execute('ALTER TABLE public."request_dismissals" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_request_dismissals_request_id'), table_name='request_dismissals')
    op.drop_table('request_dismissals')

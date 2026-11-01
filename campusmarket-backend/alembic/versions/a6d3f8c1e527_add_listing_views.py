"""add listing_views (which students opened which listing, for the landing page's popular items)

Revision ID: a6d3f8c1e527
Revises: f3c8d1a7b926
Create Date: 2026-11-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a6d3f8c1e527'
down_revision: Union[str, Sequence[str], None] = 'f3c8d1a7b926'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'listing_views',
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('listing_id', 'user_id'),
    )
    op.create_index(op.f('ix_listing_views_listing_id'), 'listing_views', ['listing_id'])
    # Locked away from Supabase's Data API like every other table (see c7f2a9d4e318).
    op.execute('ALTER TABLE public."listing_views" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_listing_views_listing_id'), table_name='listing_views')
    op.drop_table('listing_views')

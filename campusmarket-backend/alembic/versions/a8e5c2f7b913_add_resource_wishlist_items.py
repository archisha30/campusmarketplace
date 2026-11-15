"""add resource_wishlist_items (saving Resource Hub items to the wishlist)

Revision ID: a8e5c2f7b913
Revises: f2c6a9e4d137
Create Date: 2026-11-15 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a8e5c2f7b913'
down_revision: Union[str, Sequence[str], None] = 'f2c6a9e4d137'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'resource_wishlist_items',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resource_id'], ['resources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'resource_id'),
    )
    op.create_index(op.f('ix_resource_wishlist_items_resource_id'), 'resource_wishlist_items', ['resource_id'])
    # Locked away from Supabase's Data API like every other table (see c7f2a9d4e318).
    op.execute('ALTER TABLE public."resource_wishlist_items" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_resource_wishlist_items_resource_id'), table_name='resource_wishlist_items')
    op.drop_table('resource_wishlist_items')

"""add account suspension, banned emails and server-side wishlists

Revision ID: b8e4c2f7d915
Revises: a3d9f1b6c482
Create Date: 2026-10-25 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b8e4c2f7d915'
down_revision: Union[str, Sequence[str], None] = 'a3d9f1b6c482'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('suspended_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('suspension_reason', sa.String(length=300), nullable=True))
    op.create_table(
        'banned_emails',
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('reason', sa.String(length=300), nullable=False),
        sa.Column('banned_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['banned_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('email'),
    )
    op.create_table(
        'wishlist_items',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('listing_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['listing_id'], ['listings.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'listing_id'),
    )
    op.create_index(op.f('ix_wishlist_items_listing_id'), 'wishlist_items', ['listing_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_wishlist_items_listing_id'), table_name='wishlist_items')
    op.drop_table('wishlist_items')
    op.drop_table('banned_emails')
    op.drop_column('users', 'suspension_reason')
    op.drop_column('users', 'suspended_at')

"""Looking For requests: found_at ("Found it"), and descriptions up to 200 characters

Revision ID: b2e7c4a9d168
Revises: a6d3f8c1e527
Create Date: 2026-11-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2e7c4a9d168'
down_revision: Union[str, Sequence[str], None] = 'a6d3f8c1e527'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('product_requests', sa.Column('found_at', sa.DateTime(), nullable=True))
    op.alter_column('product_requests', 'description', type_=sa.String(200), existing_type=sa.String(70), existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("UPDATE product_requests SET description = LEFT(description, 70)")
    op.alter_column('product_requests', 'description', type_=sa.String(70), existing_type=sa.String(200), existing_nullable=True)
    op.drop_column('product_requests', 'found_at')

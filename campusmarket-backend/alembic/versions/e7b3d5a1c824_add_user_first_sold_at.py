"""add users.first_sold_at (sellers who've made a sale can't switch back to buyer)

Filled in for sellers who already have a sold listing or an approved paid resource request.

Revision ID: e7b3d5a1c824
Revises: d4f1b8e2a395
Create Date: 2026-11-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e7b3d5a1c824'
down_revision: Union[str, Sequence[str], None] = 'd4f1b8e2a395'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('first_sold_at', sa.DateTime(), nullable=True))
    op.execute("""
        UPDATE users SET first_sold_at = now() AT TIME ZONE 'utc'
        WHERE id IN (SELECT owner_id FROM listings WHERE status = 'sold')
           OR id IN (SELECT r.owner_id FROM resources r JOIN resource_access a ON a.resource_id = r.id
                     WHERE a.status = 'approved' AND r.offer_type = 'sale')
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'first_sold_at')

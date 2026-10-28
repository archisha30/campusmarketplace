"""lock tables away from Supabase's Data API (row level security on, anon/authenticated revoked)

The app talks to Postgres directly as the table owner (`postgres`), which isn't affected by
RLS. Supabase also exposes the public schema over its REST/GraphQL Data API to the `anon` and
`authenticated` roles; CampusMarket doesn't use that, so those roles get nothing: RLS is on
with no policies, and their privileges are revoked, now and for tables created later.

Revision ID: c7f2a9d4e318
Revises: b8e4c2f7d915
Create Date: 2026-10-28 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c7f2a9d4e318'
down_revision: Union[str, Sequence[str], None] = 'b8e4c2f7d915'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

API_ROLES = ("anon", "authenticated")


def _supabase_roles_exist() -> list[str]:
    # Plain Postgres (e.g. a local database) has no anon/authenticated roles.
    rows = op.get_bind().exec_driver_sql(
        "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')"
    ).fetchall()
    return [r[0] for r in rows]


def _public_tables() -> list[str]:
    rows = op.get_bind().exec_driver_sql(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    ).fetchall()
    return [r[0] for r in rows]


def upgrade() -> None:
    """Upgrade schema."""
    for table in _public_tables():
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY')
    roles = _supabase_roles_exist()
    if roles:
        who = ", ".join(roles)
        op.execute(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {who}")
        op.execute(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {who}")
        # Tables and sequences that future migrations create (as postgres) start locked too.
        op.execute(f"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM {who}")
        op.execute(f"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {who}")


def downgrade() -> None:
    """Downgrade schema."""
    roles = _supabase_roles_exist()
    if roles:
        who = ", ".join(roles)
        op.execute(f"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO {who}")
        op.execute(f"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO {who}")
        op.execute(f"GRANT ALL ON ALL TABLES IN SCHEMA public TO {who}")
        op.execute(f"GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO {who}")
    for table in _public_tables():
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY')

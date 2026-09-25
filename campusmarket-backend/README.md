# CampusMarket — Backend (scaffold)

FastAPI + SQLAlchemy, connected to Supabase Postgres. No business API routes yet on purpose,
this is just the foundation: app boots, connects to the database, and has a `/health` endpoint
to prove it. Auth and the listings/resources/reports endpoints get added on top of this next.

## Setup

```bash
uv sync
cp .env.example .env
```

Fill in `DATABASE_URL` in `.env` with your Supabase connection string (see the comment
in `.env.example` for exactly where to find it in the Supabase dashboard).

## Run it

```bash
uv run uvicorn app.main:app --reload
```

Then check http://localhost:8000/health — if it returns `{"status": "ok", ...}` your
FastAPI app is actually talking to Supabase, not just running.

## Structure

```
app/
  main.py           FastAPI app, CORS, /health check, routers get included here later
  core/
    config.py       Settings loaded from .env (DATABASE_URL, CORS_ORIGINS, etc.)
  db/
    base.py         Declarative Base — every future model inherits from this
    session.py      Engine + SessionLocal + get_db() dependency
```

## Migrations (once you have your first model)

```bash
uv run alembic init alembic
```

Then in the generated `alembic/env.py`, point `target_metadata` at `app.db.base.Base.metadata`
and load `DATABASE_URL` from `app.core.config.settings` instead of `alembic.ini`, so migrations
use the same connection string as the app.

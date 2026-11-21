from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Sized to the web server: FastAPI runs sync endpoints on a pool of 40 threads, so up to 40
# requests can want a connection at once. With SQLAlchemy's default (5 + 10 overflow), a burst
# of traffic left most of those threads queueing for a connection until they timed out with
# 500s (seen in load testing at 500 concurrent students). 20 + 20 covers every thread, and is
# well inside Supabase's pooler client limit. pool_timeout fails a stuck request after 10s
# instead of 30s, so a spike drains quickly instead of piling up.
# pool_pre_ping avoids "server closed the connection" errors on idle Supabase connections;
# pool_recycle replaces connections before the pooler drops them as idle.
_in_memory = settings.DATABASE_URL in ("sqlite://", "sqlite:///:memory:")  # tests: a single shared connection
_pool = {} if _in_memory else dict(
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=10,
    pool_recycle=300,
)
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, **_pool)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

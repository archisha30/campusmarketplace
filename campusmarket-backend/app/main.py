import asyncio
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.contact import router as contact_router
from app.api.routes.drafts import router as drafts_router
from app.api.routes.listings import router as listings_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.reports import router as reports_router
from app.api.routes.requests import router as requests_router
from app.api.routes.resources import router as resources_router
from app.api.routes.sellers import router as sellers_router
from app.api.routes.trash import router as trash_router
from app.api.routes.wishlist import router as wishlist_router
from app.core.config import settings
from app.core.email import EmailError
from app.core.storage import StorageError
from app.db.session import engine

# The app's own log lines (campusmarket.*: errors, rate limits, admin actions) go to stdout,
# which Render keeps in its Logs tab. uvicorn only sets up its own loggers, so without this the
# INFO-level admin audit lines would be dropped.
_log = logging.getLogger("campusmarket")
if not _log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    _log.addHandler(_handler)
    _log.setLevel(logging.INFO)
    _log.propagate = False

_prod = settings.ENVIRONMENT.lower() == "production"
# The interactive API docs are handy locally but just a map for attackers in production.
app = FastAPI(
    title=settings.APP_NAME,
    docs_url=None if _prod else "/docs",
    redoc_url=None if _prod else "/redoc",
    openapi_url=None if _prod else "/openapi.json",
)


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    """The session is a cookie, so another website could try to make a student's browser send
    a form to our API. Every state-changing request authenticated by the cookie must carry a
    custom header, which other sites can't add to a form post (and SameSite=Lax blocks their
    background requests). Requests using an explicit Bearer token don't need it."""
    if (
        request.method not in SAFE_METHODS
        and settings.SESSION_COOKIE_NAME in request.cookies
        and "authorization" not in request.headers
        and request.headers.get(settings.CSRF_HEADER) != settings.CSRF_HEADER_VALUE
    ):
        return JSONResponse(status_code=403, content={"detail": "Request blocked (missing security header). Refresh the page and try again."})
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response

app.include_router(auth_router)
app.include_router(contact_router)
app.include_router(drafts_router)
app.include_router(admin_router)
app.include_router(listings_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(requests_router)
app.include_router(resources_router)
app.include_router(sellers_router)
app.include_router(trash_router)
app.include_router(wishlist_router)

# Local file storage, and files uploaded before cloud storage was turned on. See core/storage.py.
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.middleware("http")
async def unhandled_errors(request: Request, call_next):
    """A bug anywhere becomes a plain JSON 500 with no internals in it (the details go to the
    log). Added before CORS, so CORS wraps it and the browser can read the error: without this,
    crashes skipped the CORS headers and showed up as a vague network failure in the app."""
    try:
        return await call_next(request)
    except Exception:
        logging.getLogger("campusmarket.errors").exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Try again in a minute."})


# At most this many requests are worked on at once: one per database connection (db/session.py).
# Each request takes its connection while checking who's logged in, then waits for a worker
# thread to run the endpoint, still holding it. Letting hundreds in at once (a load test at 500
# students) left every connection held by a request stuck waiting for a thread, and every thread
# waiting for a connection: 500s, and a server that stayed jammed after the spike. Requests over
# the limit now wait here instead, holding nothing, and get a quick "busy" after BUSY_WAIT_SECONDS.
_IN_FLIGHT_MAX = settings.DB_POOL_SIZE + settings.DB_MAX_OVERFLOW
_in_flight: asyncio.Semaphore | None = None
BUSY_WAIT_SECONDS = 15


@app.middleware("http")
async def limit_in_flight(request: Request, call_next):
    global _in_flight
    if _in_flight is None:
        _in_flight = asyncio.Semaphore(_IN_FLIGHT_MAX)
    try:
        await asyncio.wait_for(_in_flight.acquire(), timeout=BUSY_WAIT_SECONDS)
    except asyncio.TimeoutError:
        logging.getLogger("campusmarket.load").warning("Busy: turned away %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=503,
            content={"detail": "CampusMarket is very busy right now. Try again in a few seconds."},
            headers={"Retry-After": "5"},
        )
    try:
        return await call_next(request)
    finally:
        _in_flight.release()


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StorageError)
def storage_error(request: Request, exc: StorageError):
    # Handled here (not a bare 500) so the response still carries CORS headers and a readable message.
    logging.getLogger("campusmarket.storage").error("Storage error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=502, content={"detail": "File storage is unavailable right now. Try again in a minute."})


@app.exception_handler(EmailError)
def email_error(request: Request, exc: EmailError):
    logging.getLogger("campusmarket.email").error("Email error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(status_code=502, content={"detail": "We couldn't send the code right now. Try again in a minute."})


@app.get("/health")
def health_check():
    """Confirms the API is up and can actually reach the database. Says nothing else: which
    environment, storage or email provider is in use is a map for attackers, not for uptime checks."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok"}

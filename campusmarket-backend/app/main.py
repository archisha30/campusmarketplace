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
from app.api.routes.trash import router as trash_router
from app.api.routes.wishlist import router as wishlist_router
from app.core.config import settings
from app.core.email import EmailError
from app.core.storage import StorageError, storage
from app.db.session import engine

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
app.include_router(trash_router)
app.include_router(wishlist_router)

# Local file storage, and files uploaded before cloud storage was turned on. See core/storage.py.
UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

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
    """Confirms the API is up and can actually reach the Supabase database."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "storage": storage.name,
        "email": "brevo" if settings.BREVO_API_KEY else "smtp",
    }

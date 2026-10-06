import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.routes.auth import router as auth_router
from app.api.routes.listings import router as listings_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.requests import router as requests_router
from app.api.routes.resources import router as resources_router
from app.core.config import settings
from app.core.email import EmailError
from app.core.storage import StorageError, storage
from app.db.session import engine

app = FastAPI(title=settings.APP_NAME)

app.include_router(auth_router)
app.include_router(listings_router)
app.include_router(notifications_router)
app.include_router(requests_router)
app.include_router(resources_router)

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

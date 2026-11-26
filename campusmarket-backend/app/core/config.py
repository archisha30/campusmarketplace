from urllib.parse import urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings

# Secrets shorter than this are refused in production (Render's generateValue makes far longer ones).
MIN_JWT_SECRET = 32
MIN_OTP_PEPPER = 16

# The live site's Supabase project (not secret: it's in every public photo URL). Only a server with
# ENVIRONMENT=production may use it. Go by this ID, not the name shown in Supabase.
PRODUCTION_PROJECT_REF = "kqtetojwpbbbiznlvpck"


class Settings(BaseSettings):
    APP_NAME: str = "CampusMarket API"
    ENVIRONMENT: str = "development"

    # Full Postgres connection string from Supabase (see .env.example for where to get it)
    DATABASE_URL: str
    # Lets a non-production machine use the live project on purpose. Set it for one command only,
    # never in .env:  ALLOW_PRODUCTION_DB=true uv run ...
    ALLOW_PRODUCTION_DB: bool = False

    # Database connections kept open per server process (see db/session.py for why 20 + 20).
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 20

    # Comma-separated list of frontend origins allowed to call this API
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # --- JWT ---
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    # Sessions are renewed each time the app opens (POST /auth/refresh), so people who use the
    # site at least once a month stay logged in. Changing the password still ends old sessions.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days
    # The session lives in an HttpOnly cookie (page scripts can't read it, so it can't be stolen
    # by injected JavaScript). Secure everywhere except local development over http.
    SESSION_COOKIE_NAME: str = "cm_session"
    CSRF_HEADER: str = "X-Requested-With"  # every state-changing request must send it (see main.py)
    CSRF_HEADER_VALUE: str = "CampusMarket"

    # --- OTP ---
    OTP_EXPIRE_MINUTES: int = 10
    OTP_PEPPER: str  # extra secret mixed into the OTP hash
    OTP_MAX_ATTEMPTS: int = 5  # wrong guesses before a code is thrown away
    # Wrong codes per email per 24 hours, across ALL its codes. Without this, asking for a fresh
    # code every minute gave 5 new guesses each time (~7,000 a day at one account's reset code).
    # Kept in the database (otp_failures), so a restart or deploy doesn't wipe the count.
    OTP_DAILY_FAILURE_LIMIT: int = 15

    # --- Password login ---
    LOGIN_MAX_FAILURES: int = 5  # wrong passwords in a row before the account is locked
    LOGIN_LOCK_MINUTES: int = 15
    LOGIN_IP_LIMIT: int = 20  # password attempts per IP address...
    LOGIN_IP_WINDOW_MINUTES: int = 15  # ...within this window
    # Per address that connects to Render. Normal traffic all arrives from Vercel's servers,
    # so this is high; it only stops someone calling Render directly with faked addresses.
    # See client_ips in core/ratelimit.py.
    LOGIN_EDGE_LIMIT: int = 200
    # How many X-Forwarded-For entries Render's own proxies append (only those can be trusted):
    # the connecting address, Cloudflare, and Render's load balancer.
    # On Vultr only Caddy appends one, so its .env sets 1 (deploy/vultr/README.md).
    PROXY_HOPS: int = 3

    # --- Contact details (phone/email) shown one person at a time, per student ---
    CONTACT_REVEALS_PER_HOUR: int = 15
    CONTACT_REVEALS_PER_DAY: int = 40

    # --- Posting limits per account (stop one account filling storage or spamming notifications) ---
    # Counted from the database, so deleting and re-posting still counts.
    LISTINGS_PER_HOUR: int = 10
    LISTINGS_PER_DAY: int = 30
    RESOURCES_PER_HOUR: int = 10
    RESOURCES_PER_DAY: int = 30
    PHOTO_UPLOADS_PER_HOUR: int = 60  # listing photos and resource PDFs, each file counts once
    AVATAR_UPLOADS_PER_HOUR: int = 10

    # --- Code emails (signup / login code / password reset) ---
    CODE_EMAIL_COOLDOWN_SECONDS: int = 60  # one code per address per minute
    CODE_IP_LIMIT: int = 10  # codes per IP address...
    CODE_IP_WINDOW_MINUTES: int = 15  # ...within this window
    CODE_EDGE_LIMIT: int = 100  # codes per address that connects to Render (see LOGIN_EDGE_LIMIT)

    # --- Allowed college domains for signup ---
    ALLOWED_EMAIL_DOMAINS: list[str] = ["medhaviskillsuniversity.edu.in"]

    # --- Email (Gmail SMTP) ---
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_FROM: str
    # Optional: send through Brevo's HTTPS API instead of SMTP (needed where SMTP is blocked,
    # e.g. Render's free plan). SMTP_FROM must be a sender verified in Brevo.
    BREVO_API_KEY: str | None = None
    EMAIL_FROM_NAME: str = "CampusMarket"
    # Linked from emails (footer, "Log in" button).
    SITE_URL: str = "https://campusmarketplace-nine.vercel.app"

    # --- File storage (listing photos, avatars, resource previews + PDFs) ---
    # "auto" uses Supabase Storage when SUPABASE_SERVICE_ROLE_KEY is set, otherwise local disk.
    STORAGE_BACKEND: str = "auto"  # auto | supabase | local
    SUPABASE_URL: str | None = None  # derived from DATABASE_URL when blank
    SUPABASE_SERVICE_ROLE_KEY: str | None = None  # secret, backend only
    SUPABASE_PUBLIC_BUCKET: str = "campusmarket-public"
    SUPABASE_PRIVATE_BUCKET: str = "campusmarket-private"

    # --- Google sign-in ---
    # OAuth Client ID from Google Cloud (not secret). Blank = the Google button is off.
    GOOGLE_CLIENT_ID: str | None = None

    # --- Error tracking (core/monitoring.py) ---
    # Sentry project DSN (Sentry -> Project Settings -> Client Keys). Blank = off.
    SENTRY_DSN: str | None = None
    # Share of requests timed for Sentry's performance view (0 = errors only, which fits the free plan).
    SENTRY_TRACES_SAMPLE_RATE: float = 0.0

    # --- Admin ---
    # Owners always have admin access and are the only ones who can approve or remove other
    # admins (users whose role is "admin"). JSON list, e.g. ["you@college.edu.in"].
    OWNER_EMAILS: list[str] = []

    class Config:
        env_file = ".env"
        # A failed check would otherwise print the settings themselves (passwords, keys) to the log.
        hide_input_in_errors = True

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def safe_for_production(self):
        """Refuse to start in production with settings that would quietly weaken security.
        (A missing required variable already stops startup with pydantic naming it.)"""
        if not self.is_production:
            return self
        problems = []
        if len(self.JWT_SECRET_KEY) < MIN_JWT_SECRET:
            problems.append(f"JWT_SECRET_KEY must be at least {MIN_JWT_SECRET} characters")
        if len(self.OTP_PEPPER) < MIN_OTP_PEPPER:
            problems.append(f"OTP_PEPPER must be at least {MIN_OTP_PEPPER} characters")
        if not self.CORS_ORIGINS:
            problems.append('CORS_ORIGINS is empty; set it to the frontend URL, e.g. ["https://your-app.vercel.app"]')
        for origin in self.CORS_ORIGINS:
            parsed = urlparse(origin)
            if origin.strip() == "*" or "*" in origin:
                problems.append("CORS_ORIGINS can't contain '*' (sessions are cookies; any site could use them)")
            elif parsed.scheme != "https" or not parsed.hostname:
                problems.append(f"CORS_ORIGINS entry {origin!r} must be a full https:// origin in production")
        if problems:
            raise ValueError("Unsafe production settings:\n  - " + "\n  - ".join(problems))
        return self

    @model_validator(mode="after")
    def not_the_live_project(self):
        """Refuse to start outside production when .env points at the live database or file storage,
        so local test posts, deletions and migrations can't reach real students' data."""
        if self.is_production or self.ALLOW_PRODUCTION_DB:
            return self
        live = [name for name in ("DATABASE_URL", "SUPABASE_URL")
                if PRODUCTION_PROJECT_REF in (getattr(self, name) or "").lower()]
        if live:
            raise ValueError(
                f"{' and '.join(live)} in .env points at the PRODUCTION Supabase project, the one the live site "
                "uses. Put the dev project's values in campusmarket-backend/.env (DEPLOY.md, Step 1)."
            )
        return self


settings = Settings()
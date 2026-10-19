from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "CampusMarket API"
    ENVIRONMENT: str = "development"

    # Full Postgres connection string from Supabase (see .env.example for where to get it)
    DATABASE_URL: str

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

    # --- Password login ---
    LOGIN_MAX_FAILURES: int = 5  # wrong passwords in a row before the account is locked
    LOGIN_LOCK_MINUTES: int = 15
    LOGIN_IP_LIMIT: int = 20  # password attempts per IP address...
    LOGIN_IP_WINDOW_MINUTES: int = 15  # ...within this window

    # --- Contact details (phone/email) shown one person at a time, per student ---
    CONTACT_REVEALS_PER_HOUR: int = 15
    CONTACT_REVEALS_PER_DAY: int = 40

    # --- Code emails (signup / login code / password reset) ---
    CODE_EMAIL_COOLDOWN_SECONDS: int = 60  # one code per address per minute
    CODE_IP_LIMIT: int = 10  # codes per IP address...
    CODE_IP_WINDOW_MINUTES: int = 15  # ...within this window

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

    # --- Admin ---
    # Owners always have admin access and are the only ones who can approve or remove other
    # admins (users whose role is "admin"). JSON list, e.g. ["you@college.edu.in"].
    OWNER_EMAILS: list[str] = []

    class Config:
        env_file = ".env"


settings = Settings()
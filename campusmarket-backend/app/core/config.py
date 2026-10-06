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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # --- OTP ---
    OTP_EXPIRE_MINUTES: int = 10
    OTP_PEPPER: str  # extra secret mixed into the OTP hash

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

    class Config:
        env_file = ".env"


settings = Settings()
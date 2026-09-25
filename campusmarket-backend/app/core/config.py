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
    ALLOWED_EMAIL_DOMAINS: list[str] = ["polaris.edu"]

    # --- Email (Gmail SMTP) ---
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    SMTP_FROM: str

    class Config:
        env_file = ".env"


settings = Settings()

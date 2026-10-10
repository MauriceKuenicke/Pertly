import logging
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Runtime configuration, read from environment variables (or a local `.env`).
    Every variable is optional; the defaults run Pertly locally without any setup.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_path: Path = Path("data/pertly.db")
    log_level: str = "INFO"

    # Self-service registration. The very first account can always register
    # (and becomes admin) so a fresh install is never locked out.
    allow_registration: bool = True

    # Sessions
    session_cookie_name: str = "pertly_session"
    session_ttl_days: int = 30
    # Set to true when Pertly is served over HTTPS. Browsers drop `Secure`
    # cookies on plain-HTTP origins (except localhost), which would make
    # login silently fail on an internal http:// host.
    cookie_secure: bool = False

    # Optional bootstrap admin, created on startup only if no user exists yet.
    admin_email: str | None = None
    admin_password: str | None = None
    admin_first_name: str = "Admin"
    admin_last_name: str = "User"

    # Upper bounds for stored documents and PDF payloads.
    max_document_bytes: int = 512 * 1024
    max_pdf_html_bytes: int = 2 * 1024 * 1024
    pdf_render_timeout_seconds: float = 20.0
    pdf_max_concurrent_renders: int = 2

    @property
    def database_url(self) -> str:
        """SQLAlchemy-style URL; used by Alembic only."""
        return f"sqlite:///{self.database_path}"


settings = Settings()

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("pertly")

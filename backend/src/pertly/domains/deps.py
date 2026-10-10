import sqlite3
from collections.abc import Iterator

from fastapi import Cookie, Depends, HTTPException, Request, status

from pertly.common.config import settings
from pertly.common.db import connect
from pertly.domains.auth.service import AuthService
from pertly.domains.proposal.service import PdfRenderer
from pertly.domains.user.model import User

CLIENT_HEADER_NAME = "X-Pertly-Client"
_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_main_db() -> Iterator[sqlite3.Connection]:
    """One SQLite connection per request, closed when the response is done."""
    connection = connect()
    try:
        yield connection
    finally:
        connection.close()


def verify_client_header(request: Request) -> None:
    """
    CSRF guard. Every state-changing request must carry a custom header. Browsers only
    let same-origin scripts set custom headers (there is no CORS policy allowing others),
    so a forged cross-site form or request cannot pass this check.
    """
    if request.method in _SAFE_METHODS:
        return
    if request.headers.get(CLIENT_HEADER_NAME) != "1":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "CLIENT_HEADER_MISSING",
                "message": f"Missing {CLIENT_HEADER_NAME} header.",
            },
        )


def get_session_token(
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> str | None:
    return session_token


def get_current_user(
    request: Request,
    session_token: str | None = Depends(get_session_token),
    db: sqlite3.Connection = Depends(get_main_db),
) -> User:
    session = AuthService(db_session=db).resolve_session(session_token) if session_token else None
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "User is not authenticated.",
            },
        )
    if session.extended:
        # Picked up by `refresh_session_cookie` in pertly.main, which re-issues the cookie so
        # the browser's expiry slides together with the server-side one.
        request.state.extended_session_token = session_token
    return session.user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": "Administrator privileges required.",
            },
        )
    return user


def get_pdf_renderer(request: Request) -> PdfRenderer:
    """The application's shared PDF renderer, created in the lifespan (see `pertly.main`)."""
    return request.app.state.pdf_renderer

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from pertly.common.config import logger
from pertly.common.db import connect, prepare_database
from pertly.domains import deps
from pertly.domains.auth.cookies import set_session_cookie
from pertly.domains.auth.router import router as auth_router
from pertly.domains.estimate.router import router as estimate_router
from pertly.domains.health.router import router as health_router
from pertly.domains.proposal.router import router as proposal_router
from pertly.domains.proposal.service import PdfRenderer
from pertly.domains.settings.router import router as settings_router
from pertly.domains.user.bootstrap import ensure_bootstrap_admin
from pertly.domains.user.router import router as user_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    prepare_database()
    connection = connect()
    try:
        ensure_bootstrap_admin(connection)
    finally:
        connection.close()
    app.state.pdf_renderer = PdfRenderer()
    logger.info("Pertly backend started")
    yield
    await app.state.pdf_renderer.shutdown()


async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Give request validation errors the same `{code, message}` shape as every other API error."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "detail": {
                "code": "VALIDATION_ERROR",
                "message": "Request data is invalid.",
                "errors": jsonable_encoder(exc.errors()),
            }
        },
    )


async def refresh_session_cookie(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """
    Re-issue the session cookie when `deps.get_current_user` extended the session. Done here
    rather than in the dependency so it also applies to endpoints that return a Response directly.
    """
    response = await call_next(request)
    extended_session_token = getattr(request.state, "extended_session_token", None)
    if extended_session_token and response.status_code < 400:
        set_session_cookie(response, extended_session_token)
    return response


def create_app() -> FastAPI:
    app = FastAPI(
        title="Pertly",
        version="2.0.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        dependencies=[Depends(deps.verify_client_header)],
    )
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.middleware("http")(refresh_session_cookie)

    app.include_router(health_router, prefix="/api/health", tags=["health"])
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    app.include_router(user_router, prefix="/api/users", tags=["users"])
    app.include_router(estimate_router, prefix="/api/estimates", tags=["estimates"])
    app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
    app.include_router(proposal_router, prefix="/api/proposals", tags=["proposals"])
    return app


app = create_app()

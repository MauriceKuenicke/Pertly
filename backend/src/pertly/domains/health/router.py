from fastapi import APIRouter

from .model import HealthStatus

router = APIRouter()


@router.get("", summary="Liveness probe.", status_code=200, deprecated=False, response_model=HealthStatus)
def get_health() -> HealthStatus:
    """
    Used by the Docker healthcheck. Does not touch the database.
    """
    return HealthStatus(status="ok")

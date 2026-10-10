import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status

from pertly.common.documents import document_is_too_large, serialize_document
from pertly.domains import deps
from pertly.domains.user.model import User

from .model import ESTIMATE_ID_PATTERN, EstimateDocument, missing_estimate_keys
from .service import EstimateService

router = APIRouter()


@router.get(
    "",
    summary="List the current user's estimates.",
    status_code=200,
    deprecated=False,
    response_model=list[dict[str, Any]],
)
def list_estimates(
    user: User = Depends(deps.get_current_user), db: sqlite3.Connection = Depends(deps.get_main_db)
) -> list[dict[str, Any]]:
    """
    Return all estimates of the signed-in user, most recently added first.
    """
    return EstimateService(db_session=db).list_estimates(user_id=user.id)


@router.put(
    "/{estimate_id}",
    summary="Create or replace an estimate.",
    status_code=200,
    deprecated=False,
    response_model=dict[str, Any],
)
def put_estimate(
    estimate: EstimateDocument,
    estimate_id: str = Path(pattern=ESTIMATE_ID_PATTERN),
    user: User = Depends(deps.get_current_user),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> dict[str, Any]:
    """
    Store an estimate document. The first PUT for an id adds it to the top of the list;
    later PUTs replace it without changing its position.
    """
    document = estimate.root
    missing_keys = missing_estimate_keys(document)
    if missing_keys:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "INVALID_ESTIMATE",
                "message": f"Estimate is missing required fields: {', '.join(missing_keys)}.",
            },
        )
    if document["id"] != estimate_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "ID_MISMATCH",
                "message": "Estimate id in the body does not match the URL.",
            },
        )
    serialized = serialize_document(document)
    if document_is_too_large(serialized):
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={
                "code": "DOCUMENT_TOO_LARGE",
                "message": "Estimate is too large to store.",
            },
        )

    EstimateService(db_session=db).upsert_estimate(user_id=user.id, estimate_id=estimate_id, document=serialized)
    return document


@router.delete("/{estimate_id}", summary="Delete an estimate.", status_code=204, deprecated=False)
def delete_estimate(
    estimate_id: str = Path(pattern=ESTIMATE_ID_PATTERN),
    user: User = Depends(deps.get_current_user),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> Response:
    """
    Permanently delete one of the current user's estimates.
    """
    if not EstimateService(db_session=db).delete_estimate(user_id=user.id, estimate_id=estimate_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "ESTIMATE_NOT_FOUND",
                "message": "Estimate does not exist.",
            },
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

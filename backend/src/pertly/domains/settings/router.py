import sqlite3
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from pertly.common.documents import document_is_too_large, serialize_document
from pertly.domains import deps
from pertly.domains.user.model import User

from .model import SettingsDocument
from .service import SettingsService

router = APIRouter()


@router.get(
    "",
    summary="Get the current user's default settings.",
    status_code=200,
    deprecated=False,
    response_model=dict[str, Any],
)
def get_settings(
    user: User = Depends(deps.get_current_user), db: sqlite3.Connection = Depends(deps.get_main_db)
) -> dict[str, Any]:
    """
    Return the stored settings, or an empty object if the user never changed any
    (the frontend then falls back to its built-in defaults).
    """
    return SettingsService(db_session=db).get_settings(user_id=user.id) or {}


@router.put(
    "",
    summary="Save the current user's default settings.",
    status_code=200,
    deprecated=False,
    response_model=dict[str, Any],
)
def put_settings(
    user_settings: SettingsDocument,
    user: User = Depends(deps.get_current_user),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> dict[str, Any]:
    """
    Replace the user's settings document.
    """
    serialized = serialize_document(user_settings.root)
    if document_is_too_large(serialized):
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={
                "code": "DOCUMENT_TOO_LARGE",
                "message": "Settings are too large to store.",
            },
        )
    SettingsService(db_session=db).save_settings(user_id=user.id, document=serialized)
    return user_settings.root

import sqlite3

from pertly.common.config import logger, settings

from .model import UserCreate
from .service import UserService, email_is_valid, password_is_valid


def ensure_bootstrap_admin(db_session: sqlite3.Connection) -> None:
    """
    Create the admin configured via ADMIN_EMAIL / ADMIN_PASSWORD, but only on an empty
    instance. Once any account exists the variables are ignored, so changing them later
    can never overwrite or re-create users.
    """
    if not settings.admin_email or not settings.admin_password:
        return
    user_service = UserService(db_session=db_session)
    if user_service.count_users() > 0:
        return
    if not email_is_valid(settings.admin_email) or not password_is_valid(settings.admin_password):
        logger.error("ADMIN_EMAIL / ADMIN_PASSWORD are invalid; bootstrap admin was not created.")
        return
    user_service.create_new_user(
        UserCreate(
            first_name=settings.admin_first_name,
            last_name=settings.admin_last_name,
            email=settings.admin_email,
            password=settings.admin_password,
            is_admin=True,
        )
    )
    logger.info(f"Bootstrap admin {settings.admin_email} created")

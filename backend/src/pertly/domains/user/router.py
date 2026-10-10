import sqlite3

from fastapi import APIRouter, Depends, Form, HTTPException, Response, status

from pertly.common.config import logger
from pertly.common.db import transaction
from pertly.domains import deps
from pertly.domains.auth.service import AuthService

from . import validation
from .model import User, UserCreate, UserRead, UserUpdate
from .service import LastAdminError, UserService

router = APIRouter()


def user_not_found_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "USER_NOT_FOUND",
            "message": "User does not exist.",
        },
    )


def last_admin_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "LAST_ADMIN",
            "message": "Pertly needs at least one active administrator.",
        },
    )


def ensure_not_self(admin: User, user_id: str) -> None:
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CANNOT_MODIFY_SELF",
                "message": "Administrators cannot change or delete their own account here.",
            },
        )


@router.get(
    "/me", summary="Query current user information.", status_code=200, deprecated=False, response_model=UserRead
)
def get_current_user_information(user: User = Depends(deps.get_current_user)) -> User:
    """
    Return the signed-in user.
    """
    return user


@router.put("/me/password", summary="Change the current user's password.", status_code=204, deprecated=False)
def change_own_password(
    current_password: str = Form(),
    new_password: str = Form(),
    confirm_password: str = Form(),
    session_token: str | None = Depends(deps.get_session_token),
    user: User = Depends(deps.get_current_user),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> Response:
    """
    Change the password after confirming the current one. Every other session of the user is signed out.
    """
    user_service = UserService(db_session=db)
    if not user_service.user_password_is_valid(user_id=user.id, password=current_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Current password is incorrect.",
            },
        )
    validation.ensure_passwords_match(new_password, confirm_password)
    validation.ensure_valid_password(new_password)

    with transaction(db):
        user_service.set_password(user_id=user.id, new_password=new_password)
        AuthService(db_session=db).delete_all_sessions_of_user(user_id=user.id, except_token=session_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("", summary="List all users.", status_code=200, deprecated=False, response_model=list[UserRead])
def list_users(
    _admin: User = Depends(deps.get_current_admin), db: sqlite3.Connection = Depends(deps.get_main_db)
) -> list[User]:
    """
    List every account of this Pertly instance (admin only).
    """
    return UserService(db_session=db).list_users()


@router.post("", summary="Create a user.", status_code=201, deprecated=False, response_model=UserRead)
def create_user(
    first_name: str = Form(),
    last_name: str = Form(),
    email: str = Form(),
    password: str = Form(),
    is_admin: bool = Form(default=False),
    admin: User = Depends(deps.get_current_admin),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> User:
    """
    Create an account on someone's behalf (admin only). Works even when self-registration is disabled.
    """
    validation.ensure_valid_name(first_name, last_name)
    validation.ensure_valid_email(email)
    validation.ensure_valid_password(password)
    user_service = UserService(db_session=db)
    if user_service.user_mail_exist_already(mail=email):
        raise validation.email_in_use_error()

    new_user = UserCreate(first_name=first_name, last_name=last_name, email=email, password=password, is_admin=is_admin)
    try:
        user = user_service.create_new_user(user_in=new_user)
    except sqlite3.IntegrityError:
        raise validation.email_in_use_error() from None
    logger.info(f"Admin {admin.id} created user {user.id}")
    return user


@router.patch(
    "/{user_id}",
    summary="Activate/deactivate a user or change their role.",
    status_code=200,
    deprecated=False,
    response_model=UserRead,
)
def update_user(
    user_id: str,
    changes: UserUpdate,
    admin: User = Depends(deps.get_current_admin),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> User:
    """
    Change a user's `is_active` / `is_admin` flags (admin only). Deactivating signs the user out everywhere.
    """
    ensure_not_self(admin, user_id)
    try:
        user = UserService(db_session=db).update_user_flags(user_id=user_id, changes=changes)
    except LastAdminError:
        raise last_admin_error() from None
    if not user:
        raise user_not_found_error()
    if not user.is_active:
        # Sessions of inactive users are already rejected; revoking them just tidies up.
        AuthService(db_session=db).delete_all_sessions_of_user(user_id=user_id)
    return user


@router.delete("/{user_id}", summary="Delete a user and all their data.", status_code=204, deprecated=False)
def delete_user(
    user_id: str, admin: User = Depends(deps.get_current_admin), db: sqlite3.Connection = Depends(deps.get_main_db)
) -> Response:
    """
    Permanently delete an account together with its estimates and settings (admin only).
    """
    ensure_not_self(admin, user_id)
    try:
        deleted = UserService(db_session=db).delete_user(user_id=user_id)
    except LastAdminError:
        raise last_admin_error() from None
    if not deleted:
        raise user_not_found_error()
    logger.info(f"Admin {admin.id} deleted user {user_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{user_id}/password", summary="Set a new password for a user.", status_code=204, deprecated=False)
def reset_user_password(
    user_id: str,
    new_password: str = Form(),
    admin: User = Depends(deps.get_current_admin),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> Response:
    """
    Reset a user's password (admin only) and sign them out everywhere. There is no email flow;
    the admin hands the new password over directly. Admins change their own password under /me.
    """
    ensure_not_self(admin, user_id)
    user_service = UserService(db_session=db)
    if not user_service.get_user_by_id(user_id):
        raise user_not_found_error()
    validation.ensure_valid_password(new_password)

    with transaction(db):
        user_service.set_password(user_id=user_id, new_password=new_password)
        AuthService(db_session=db).delete_all_sessions_of_user(user_id=user_id)
    logger.info(f"Admin {admin.id} reset the password of user {user_id}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

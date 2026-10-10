import sqlite3

from fastapi import APIRouter, Depends, Form, HTTPException, Response, status

from pertly.common.config import logger, settings
from pertly.domains import deps
from pertly.domains.user import validation
from pertly.domains.user.model import User, UserCreate, UserRead
from pertly.domains.user.service import UserService

from .cookies import clear_session_cookie, set_session_cookie
from .model import AuthConfig
from .service import AuthService

router = APIRouter()


def registration_is_open(user_service: UserService) -> bool:
    return settings.allow_registration or user_service.count_users() == 0


@router.get(
    "/config", summary="Public authentication settings.", status_code=200, deprecated=False, response_model=AuthConfig
)
def get_auth_config(db: sqlite3.Connection = Depends(deps.get_main_db)) -> AuthConfig:
    """
    Tell the login screen whether self-registration is currently possible.
    """
    return AuthConfig(registration_open=registration_is_open(UserService(db_session=db)))


@router.post("/register", summary="Register a new user.", status_code=201, deprecated=False, response_model=UserRead)
def register_new_user(
    response: Response,
    first_name: str = Form(),
    last_name: str = Form(),
    email: str = Form(),
    password: str = Form(),
    confirm_password: str = Form(),
    db: sqlite3.Connection = Depends(deps.get_main_db),
) -> User:
    """
    Register a new user and sign them in. The first account of a fresh instance becomes admin.
    """
    user_service = UserService(db_session=db)
    if not registration_is_open(user_service):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "REGISTRATION_DISABLED",
                "message": "Registration is disabled. Ask an administrator for an account.",
            },
        )
    validation.ensure_valid_name(first_name, last_name)
    validation.ensure_valid_email(email)
    validation.ensure_passwords_match(password, confirm_password)
    validation.ensure_valid_password(password)
    if user_service.user_mail_exist_already(mail=email):
        raise validation.email_in_use_error()

    new_user = UserCreate(first_name=first_name, last_name=last_name, email=email, password=password)
    try:
        user = user_service.create_first_or_regular_user(user_in=new_user)
    except sqlite3.IntegrityError:
        # Lost a race against a concurrent registration with the same email.
        raise validation.email_in_use_error() from None

    session_token = AuthService(db_session=db).create_session(user_id=user.id)
    set_session_cookie(response, session_token)
    return user


@router.post(
    "/login", summary="Sign in with email and password.", status_code=200, deprecated=False, response_model=UserRead
)
def login(
    response: Response, email: str = Form(), password: str = Form(), db: sqlite3.Connection = Depends(deps.get_main_db)
) -> User:
    """
    Verify the credentials and start a session (HttpOnly cookie).
    """
    user = UserService(db_session=db).authenticate(mail=email, password=password)
    if not user:
        logger.info("Login failed: invalid credentials.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Email or password is incorrect.",
            },
        )
    if not user.is_active:
        logger.info(f"Login refused for deactivated user {user.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "USER_INACTIVE",
                "message": "This account has been deactivated.",
            },
        )

    auth_service = AuthService(db_session=db)
    auth_service.delete_expired_sessions()
    session_token = auth_service.create_session(user_id=user.id)
    set_session_cookie(response, session_token)
    logger.info(f"User {user.id} signed in")
    return user


@router.post("/logout", summary="Sign out the current session.", status_code=204, deprecated=False)
def logout(
    session_token: str | None = Depends(deps.get_session_token), db: sqlite3.Connection = Depends(deps.get_main_db)
) -> Response:
    """
    End the current session. Succeeds even if the session is already gone.
    """
    if session_token:
        AuthService(db_session=db).delete_session(session_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response)
    return response

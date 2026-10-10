from fastapi import HTTPException, status

from .service import email_is_valid, password_is_valid


def ensure_valid_name(first_name: str, last_name: str) -> None:
    if not first_name.strip() or not last_name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "NAME_REQUIRED",
                "message": "First and last name are required.",
            },
        )


def ensure_valid_email(email: str) -> None:
    if not email_is_valid(email.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "INVALID_MAIL",
                "message": "Invalid email format.",
            },
        )


def ensure_passwords_match(password: str, confirm_password: str) -> None:
    if password != confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PASSWORD_MISMATCH",
                "message": "Passwords do not match. Try again.",
            },
        )


def ensure_valid_password(password: str) -> None:
    if not password_is_valid(password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "PASSWORD_REQUIREMENT",
                "message": "Password needs at least 8 characters, a digit, a lower-case and an upper-case letter.",
            },
        )


def email_in_use_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "ALREADY_IN_USE",
            "message": "User mail already in use.",
        },
    )

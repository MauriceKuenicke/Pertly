import re
import sqlite3
import uuid

from pertly.common import crypto
from pertly.common.config import logger
from pertly.common.db import transaction, utc_now

from .model import User, UserCreate, UserUpdate

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

_USER_COLUMNS = "id, email, first_name, last_name, is_admin, is_active, created_at, updated_at"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def email_is_valid(email: str) -> bool:
    return EMAIL_REGEX.match(email) is not None


def password_is_valid(passwd: str) -> bool:
    """
    Check the password against a series of conditions and return a boolean flag on the result.
    :param passwd: Incoming password string to check.
    :return: Check successful
    """
    has_number_regex = re.compile(r"\d")  # Number
    has_upper_case_regex = re.compile(r"[A-Z]")  # Upper Case
    has_lower_case_regex = re.compile(r"[a-z]")  # Lower Case
    has_length_regex = re.compile(r".{8,}")  # Length

    validation_object = {
        "Has_Number": has_number_regex.search(passwd),
        "Has_Upper_Case": has_upper_case_regex.search(passwd),
        "Has_Lower_Case": has_lower_case_regex.search(passwd),
        "Has_Length": has_length_regex.search(passwd),
    }
    if not all(validation_object.values()):
        failed = [check for check, result in validation_object.items() if not result]
        logger.info(f"Password validation failed: {failed}")
        return False
    return True


class LastAdminError(Exception):
    """Raised when a change would leave the instance without an active admin."""


class UserService:
    def __init__(self, db_session: sqlite3.Connection):
        self._db_session = db_session

    def count_users(self) -> int:
        return self._db_session.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    def create_new_user(self, user_in: UserCreate) -> User:
        user_id = str(uuid.uuid4())
        now = utc_now()
        self._db_session.execute(
            """
            INSERT INTO users (id, email, first_name, last_name, password_hash, is_admin, is_active,
                               created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                user_id,
                normalize_email(user_in.email),
                user_in.first_name.strip(),
                user_in.last_name.strip(),
                crypto.hash_password(user_in.password),
                int(user_in.is_admin),
                now,
                now,
            ),
        )
        user = self.get_user_by_id(user_id)
        logger.info(f"New user created: {user.id} (admin={user.is_admin})")
        return user

    def create_first_or_regular_user(self, user_in: UserCreate) -> User:
        """
        Create a self-registered user. The very first account of an instance becomes
        admin; the check and the insert share one write transaction so two concurrent
        first registrations cannot both become admin.
        """
        with transaction(self._db_session):
            is_first_user = self.count_users() == 0
            return self.create_new_user(user_in.model_copy(update={"is_admin": is_first_user}))

    def get_user_by_id(self, user_id: str) -> User | None:
        row = self._db_session.execute(f"SELECT {_USER_COLUMNS} FROM users WHERE id = ?", (user_id,)).fetchone()
        return User.from_row(row) if row else None

    def get_user_by_mail(self, mail: str) -> User | None:
        row = self._db_session.execute(
            f"SELECT {_USER_COLUMNS} FROM users WHERE email = ?", (normalize_email(mail),)
        ).fetchone()
        return User.from_row(row) if row else None

    def user_mail_exist_already(self, mail: str) -> bool:
        row = self._db_session.execute("SELECT 1 FROM users WHERE email = ?", (normalize_email(mail),)).fetchone()
        return row is not None

    def list_users(self) -> list[User]:
        rows = self._db_session.execute(f"SELECT {_USER_COLUMNS} FROM users ORDER BY created_at, email").fetchall()
        return [User.from_row(row) for row in rows]

    def authenticate(self, mail: str, password: str) -> User | None:
        """
        Return the user if the credentials match (regardless of `is_active`), otherwise None.
        Unknown emails still pay for a hash verification so response time does not reveal
        which accounts exist.
        """
        row = self._db_session.execute(
            f"SELECT {_USER_COLUMNS}, password_hash FROM users WHERE email = ?", (normalize_email(mail),)
        ).fetchone()
        if row is None:
            crypto.burn_password_check(password)
            return None
        if not crypto.verify_password(password, row["password_hash"]):
            return None
        if crypto.password_needs_rehash(row["password_hash"]):
            self._store_password_hash(row["id"], crypto.hash_password(password))
        return User.from_row(row)

    def user_password_is_valid(self, user_id: str, password: str) -> bool:
        row = self._db_session.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            return False
        return crypto.verify_password(password, row["password_hash"])

    def set_password(self, user_id: str, new_password: str) -> None:
        self._store_password_hash(user_id, crypto.hash_password(new_password))
        logger.info(f"Password changed for user {user_id}")

    def update_user_flags(self, user_id: str, changes: UserUpdate) -> User | None:
        """
        Apply admin flag changes and return the updated user (None if it does not exist).
        Raises LastAdminError if the change would leave no active admin.
        """
        with transaction(self._db_session):
            user = self.get_user_by_id(user_id)
            if user is None:
                return None
            is_admin = user.is_admin if changes.is_admin is None else changes.is_admin
            is_active = user.is_active if changes.is_active is None else changes.is_active
            loses_admin_power = user.is_admin and user.is_active and not (is_admin and is_active)
            if loses_admin_power and self._count_active_admins() <= 1:
                raise LastAdminError()
            self._db_session.execute(
                "UPDATE users SET is_admin = ?, is_active = ?, updated_at = ? WHERE id = ?",
                (int(is_admin), int(is_active), utc_now(), user_id),
            )
        logger.info(f"User {user_id} updated: is_admin={is_admin}, is_active={is_active}")
        return self.get_user_by_id(user_id)

    def delete_user(self, user_id: str) -> bool:
        """
        Delete a user and, via ON DELETE CASCADE, their sessions, estimates and settings.
        Returns False if the user does not exist. Raises LastAdminError when deleting the last active admin.
        """
        with transaction(self._db_session):
            user = self.get_user_by_id(user_id)
            if user is None:
                return False
            if user.is_admin and user.is_active and self._count_active_admins() <= 1:
                raise LastAdminError()
            self._db_session.execute("DELETE FROM users WHERE id = ?", (user_id,))
        logger.info(f"User {user_id} deleted")
        return True

    def _count_active_admins(self) -> int:
        return self._db_session.execute("SELECT COUNT(*) FROM users WHERE is_admin = 1 AND is_active = 1").fetchone()[0]

    def _store_password_hash(self, user_id: str, password_hash: str) -> None:
        self._db_session.execute(
            "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
            (password_hash, utc_now(), user_id),
        )

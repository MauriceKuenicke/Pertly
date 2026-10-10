import sqlite3
from datetime import UTC, datetime, timedelta

from pertly.common import crypto
from pertly.common.config import logger, settings
from pertly.common.db import to_iso, utc_now
from pertly.domains.user.model import User

from .model import ActiveSession

# `last_seen_at` / `expires_at` are only rewritten when they are older than this,
# so an active user does not cause a database write on every single request.
_SESSION_TOUCH_INTERVAL = timedelta(minutes=5)


def _session_ttl() -> timedelta:
    return timedelta(days=settings.session_ttl_days)


class AuthService:
    """Server-side sessions. The raw token only ever lives in the user's cookie; the database stores its hash."""

    def __init__(self, db_session: sqlite3.Connection):
        self._db_session = db_session

    def create_session(self, user_id: str) -> str:
        token = crypto.generate_session_token()
        now = datetime.now(UTC)
        self._db_session.execute(
            """
            INSERT INTO user_sessions (token_hash, user_id, created_at, last_seen_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                crypto.hash_session_token(token),
                user_id,
                to_iso(now),
                to_iso(now),
                to_iso(now + _session_ttl()),
            ),
        )
        logger.info(f"Session created for user {user_id}")
        return token

    def resolve_session(self, session_token: str) -> ActiveSession | None:
        """
        Resolve a session token to its user. Expired sessions and sessions of deactivated
        users resolve to None. Valid sessions are extended (sliding expiry).
        """
        token_hash = crypto.hash_session_token(session_token)
        row = self._db_session.execute(
            """
            SELECT u.id, u.email, u.first_name, u.last_name, u.is_admin, u.is_active, u.created_at, u.updated_at,
                   s.last_seen_at, s.expires_at
            FROM user_sessions AS s
            JOIN users AS u ON u.id = s.user_id
            WHERE s.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if row is None or not row["is_active"]:
            return None

        now = datetime.now(UTC)
        if datetime.fromisoformat(row["expires_at"]) <= now:
            self.delete_session(session_token)
            return None
        extended = now - datetime.fromisoformat(row["last_seen_at"]) >= _SESSION_TOUCH_INTERVAL
        if extended:
            self._db_session.execute(
                "UPDATE user_sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?",
                (to_iso(now), to_iso(now + _session_ttl()), token_hash),
            )
        return ActiveSession(user=User.from_row(row), extended=extended)

    def delete_session(self, session_token: str) -> None:
        self._db_session.execute(
            "DELETE FROM user_sessions WHERE token_hash = ?", (crypto.hash_session_token(session_token),)
        )

    def delete_all_sessions_of_user(self, user_id: str, except_token: str | None = None) -> None:
        if except_token is None:
            self._db_session.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
        else:
            self._db_session.execute(
                "DELETE FROM user_sessions WHERE user_id = ? AND token_hash <> ?",
                (user_id, crypto.hash_session_token(except_token)),
            )
        logger.info(f"Sessions revoked for user {user_id} (kept current: {except_token is not None})")

    def delete_expired_sessions(self) -> int:
        cursor = self._db_session.execute("DELETE FROM user_sessions WHERE expires_at <= ?", (utc_now(),))
        return cursor.rowcount

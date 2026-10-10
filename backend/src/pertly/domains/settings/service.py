import json
import sqlite3
from typing import Any

from pertly.common.db import utc_now


class SettingsService:
    """Per-user defaults that seed new estimates (day rate, overhead, roles, ...)."""

    def __init__(self, db_session: sqlite3.Connection):
        self._db_session = db_session

    def get_settings(self, user_id: str) -> dict[str, Any] | None:
        row = self._db_session.execute("SELECT document FROM user_settings WHERE user_id = ?", (user_id,)).fetchone()
        return json.loads(row["document"]) if row else None

    def save_settings(self, user_id: str, document: str) -> None:
        self._db_session.execute(
            """
            INSERT INTO user_settings (user_id, document, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                document = excluded.document,
                updated_at = excluded.updated_at
            """,
            (user_id, document, utc_now()),
        )

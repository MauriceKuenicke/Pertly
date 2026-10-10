import json
import sqlite3
from typing import Any

from pertly.common.config import logger
from pertly.common.db import utc_now


class EstimateService:
    """Per-user storage of estimate documents. Every query is scoped by `user_id`."""

    def __init__(self, db_session: sqlite3.Connection):
        self._db_session = db_session

    def list_estimates(self, user_id: str) -> list[dict[str, Any]]:
        """Newest first-stored estimate first, matching how the list has always been ordered."""
        rows = self._db_session.execute(
            "SELECT document FROM estimates WHERE user_id = ? ORDER BY seq DESC", (user_id,)
        ).fetchall()
        return [json.loads(row["document"]) for row in rows]

    def estimate_exists(self, user_id: str, estimate_id: str) -> bool:
        row = self._db_session.execute(
            "SELECT 1 FROM estimates WHERE user_id = ? AND id = ?", (user_id, estimate_id)
        ).fetchone()
        return row is not None

    def upsert_estimate(self, user_id: str, estimate_id: str, document: str) -> None:
        """
        Insert a new estimate on top of the list, or replace an existing one in place.
        `seq` is untouched by the update branch, so editing never reorders the list.
        """
        now = utc_now()
        self._db_session.execute(
            """
            INSERT INTO estimates (id, user_id, document, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (user_id, id) DO UPDATE SET
                document = excluded.document,
                updated_at = excluded.updated_at
            """,
            (estimate_id, user_id, document, now, now),
        )

    def delete_estimate(self, user_id: str, estimate_id: str) -> bool:
        cursor = self._db_session.execute("DELETE FROM estimates WHERE user_id = ? AND id = ?", (user_id, estimate_id))
        if cursor.rowcount:
            logger.info(f"Estimate {estimate_id} of user {user_id} deleted")
        return cursor.rowcount > 0

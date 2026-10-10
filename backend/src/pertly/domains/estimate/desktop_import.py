import sqlite3
from typing import Any

from pertly.common.config import logger
from pertly.common.db import transaction
from pertly.common.documents import document_is_too_large, serialize_document
from pertly.domains.settings.service import SettingsService

from .model import DesktopImportResult, estimate_id_is_valid, missing_estimate_keys
from .service import EstimateService


class DesktopImportService:
    """Brings the content of a Pertly Desktop `estimates.json` into one user's account."""

    def __init__(self, db_session: sqlite3.Connection):
        self._db_session = db_session
        self._estimate_service = EstimateService(db_session=db_session)
        self._settings_service = SettingsService(db_session=db_session)

    def import_store(self, user_id: str, store: dict[str, Any], replace_settings: bool = False) -> DesktopImportResult:
        """
        - Estimates keep the desktop list order (the file's first estimate ends up on top).
        - Nothing existing is overwritten: estimates whose id the user already has are skipped,
          as are entries the API itself would reject (bad id, missing fields, too large).
        - Settings are imported when the user has none yet, or when `replace_settings` is set.
        The frontend's `normalizeEstimate` backfills any fields older files are missing.
        """
        estimates = store.get("estimates") or []
        imported = skipped = 0

        with transaction(self._db_session):
            # Inserted oldest-first so the newest-first listing reproduces the file's order.
            for estimate in reversed(estimates):
                document = self._importable_document(user_id, estimate)
                if document is None:
                    skipped += 1
                    continue
                self._estimate_service.upsert_estimate(user_id=user_id, estimate_id=estimate["id"], document=document)
                imported += 1

            desktop_settings = store.get("settings")
            settings_imported = isinstance(desktop_settings, dict) and (
                replace_settings or self._settings_service.get_settings(user_id) is None
            )
            if settings_imported:
                self._settings_service.save_settings(user_id=user_id, document=serialize_document(desktop_settings))

        logger.info(
            f"Desktop import for user {user_id}: {imported} imported, {skipped} skipped, "
            f"settings imported: {settings_imported}"
        )
        return DesktopImportResult(imported=imported, skipped=skipped, settings_imported=settings_imported)

    def _importable_document(self, user_id: str, estimate: Any) -> str | None:
        """The serialized estimate if it can be stored exactly like a regular PUT would, else None."""
        if not isinstance(estimate, dict) or missing_estimate_keys(estimate):
            return None
        if not estimate_id_is_valid(estimate["id"]):
            return None
        if self._estimate_service.estimate_exists(user_id, estimate["id"]):
            return None
        document = serialize_document(estimate)
        return None if document_is_too_large(document) else document

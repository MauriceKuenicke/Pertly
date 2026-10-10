import re
from typing import Any

from pydantic import BaseModel, RootModel

# The top-level keys every estimate document must have. Everything below them
# is owned by the frontend (`frontend/src/types/estimate.ts`); its
# `normalizeEstimate` backfills fields added over time.
REQUIRED_ESTIMATE_KEYS = ("id", "status", "pricingMethod", "createdAt", "updatedAt")

ESTIMATE_ID_PATTERN = r"^[A-Za-z0-9_-]{1,64}$"
_ESTIMATE_ID_REGEX = re.compile(ESTIMATE_ID_PATTERN)


def estimate_id_is_valid(estimate_id: Any) -> bool:
    return isinstance(estimate_id, str) and _ESTIMATE_ID_REGEX.match(estimate_id) is not None


def missing_estimate_keys(document: dict[str, Any]) -> list[str]:
    return [key for key in REQUIRED_ESTIMATE_KEYS if key not in document]


class EstimateDocument(RootModel[dict[str, Any]]):
    """An estimate exactly as the frontend stores it, kept as an opaque JSON object."""


class DesktopImportResult(BaseModel):
    imported: int
    skipped: int
    settings_imported: bool

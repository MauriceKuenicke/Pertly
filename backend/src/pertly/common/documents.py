import json
from typing import Any

from pertly.common.config import settings


def serialize_document(document: Any) -> str:
    """Compact JSON as stored in the `document` columns."""
    return json.dumps(document, ensure_ascii=False, separators=(",", ":"))


def document_is_too_large(serialized: str) -> bool:
    return len(serialized.encode("utf-8")) > settings.max_document_bytes

from typing import Any

from pydantic import RootModel


class SettingsDocument(RootModel[dict[str, Any]]):
    """A user's default settings exactly as the frontend stores them (`Settings` in `types/estimate.ts`)."""

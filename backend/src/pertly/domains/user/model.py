import sqlite3

from pydantic import BaseModel, ConfigDict


class User(BaseModel):
    """A Pertly account as stored in the `users` table (without its password hash)."""

    id: str
    email: str
    first_name: str
    last_name: str
    is_admin: bool
    is_active: bool
    created_at: str
    updated_at: str

    @classmethod
    def from_row(cls, row: sqlite3.Row) -> "User":
        return cls(
            id=row["id"],
            email=row["email"],
            first_name=row["first_name"],
            last_name=row["last_name"],
            is_admin=bool(row["is_admin"]),
            is_active=bool(row["is_active"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    is_admin: bool = False


class UserRead(BaseModel):
    """Public representation of a user, returned by every user endpoint."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    first_name: str
    last_name: str
    is_admin: bool
    is_active: bool
    created_at: str


class UserUpdate(BaseModel):
    """Admin-editable account flags. Omitted fields stay unchanged."""

    is_active: bool | None = None
    is_admin: bool | None = None

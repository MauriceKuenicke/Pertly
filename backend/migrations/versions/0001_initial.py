"""Initial schema: users, sessions, estimates and per-user settings.

Revision ID: 0001
Revises:
Create Date: 2026-10-10
"""

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Estimates and settings are stored as JSON documents with exactly the shape
# the frontend works with. The pricing logic (and the backfill of fields added
# over time) lives in the frontend, so the database deliberately does not
# mirror the estimate structure column by column.
#
# `estimates.seq` is the list position: assigned on first insert and never
# touched by later updates, so `ORDER BY seq DESC` reproduces the desktop
# app's "new estimates go on top" ordering.
UPGRADE_STATEMENTS = [
    """
    CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        first_name    TEXT NOT NULL,
        last_name     TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_admin      INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
        is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE user_sessions (
        token_hash   TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at   TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at   TEXT NOT NULL
    )
    """,
    "CREATE INDEX ix_user_sessions_user_id ON user_sessions (user_id)",
    """
    CREATE TABLE estimates (
        seq        INTEGER PRIMARY KEY,
        id         TEXT NOT NULL,
        user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        document   TEXT NOT NULL CHECK (json_valid(document)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, id)
    )
    """,
    """
    CREATE TABLE user_settings (
        user_id    TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        document   TEXT NOT NULL CHECK (json_valid(document)),
        updated_at TEXT NOT NULL
    )
    """,
]

DOWNGRADE_STATEMENTS = [
    "DROP TABLE user_settings",
    "DROP TABLE estimates",
    "DROP INDEX ix_user_sessions_user_id",
    "DROP TABLE user_sessions",
    "DROP TABLE users",
]


def upgrade() -> None:
    for statement in UPGRADE_STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE_STATEMENTS:
        op.execute(statement)

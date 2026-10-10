import sqlite3
from pathlib import Path

from alembic import command

from tests.conftest import alembic_config


def table_names(database_path: Path) -> set[str]:
    connection = sqlite3.connect(database_path)
    try:
        rows = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    finally:
        connection.close()
    return {row[0] for row in rows}


def test_upgrade_creates_schema(database_path: Path) -> None:
    assert {"users", "user_sessions", "estimates", "user_settings"} <= table_names(database_path)


def test_downgrade_and_upgrade_roundtrip(database_path: Path) -> None:
    config = alembic_config(database_path)
    command.downgrade(config, "base")
    assert table_names(database_path) == {"alembic_version"}
    command.upgrade(config, "head")
    assert {"users", "user_sessions", "estimates", "user_settings"} <= table_names(database_path)


def test_estimate_documents_must_be_valid_json(database_path: Path) -> None:
    connection = sqlite3.connect(database_path)
    try:
        connection.execute(
            "INSERT INTO users (id, email, first_name, last_name, password_hash, created_at, updated_at) "
            "VALUES ('u1', 'a@b.co', 'A', 'B', 'x', 'now', 'now')"
        )
        try:
            connection.execute(
                "INSERT INTO estimates (id, user_id, document, created_at, updated_at) "
                "VALUES ('e1', 'u1', 'not json', 'now', 'now')"
            )
            raise AssertionError("CHECK (json_valid(document)) did not reject invalid JSON")
        except sqlite3.IntegrityError:
            pass
    finally:
        connection.close()

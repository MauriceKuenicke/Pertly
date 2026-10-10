import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from pertly.common.config import logger, settings


def connect(database_path: Path | None = None) -> sqlite3.Connection:
    """
    Open a new SQLite connection configured for Pertly.

    - Autocommit mode (`isolation_level=None`): writes that must be atomic go
      through `transaction()`, which issues an explicit `BEGIN IMMEDIATE`.
    - `check_same_thread=False`: FastAPI may run a sync dependency's setup and
      teardown on different threadpool threads. Each connection still belongs
      to exactly one request, so it is never used concurrently.
    """
    path = database_path or settings.database_path
    connection = sqlite3.connect(path, isolation_level=None, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    connection.execute("PRAGMA synchronous = NORMAL")
    return connection


def prepare_database(database_path: Path | None = None) -> None:
    """
    Create the database directory and switch the file to WAL journaling once.
    WAL is persistent per database file and cannot be set inside a transaction,
    so it lives here instead of in a migration.
    """
    path = database_path or settings.database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = connect(path)
    try:
        mode = connection.execute("PRAGMA journal_mode = WAL").fetchone()[0]
        logger.info(f"Database ready at {path} (journal_mode={mode})")
    finally:
        connection.close()


@contextmanager
def transaction(connection: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """
    Run a block atomically. `BEGIN IMMEDIATE` takes the write lock up front, so a
    read-then-write sequence waits on `busy_timeout` instead of failing with
    SQLITE_BUSY halfway through.
    """
    connection.execute("BEGIN IMMEDIATE")
    try:
        yield connection
    except BaseException:
        connection.execute("ROLLBACK")
        raise
    connection.execute("COMMIT")


def to_iso(moment: datetime) -> str:
    """
    The storage format for every timestamp column. Fixed precision keeps the strings
    lexicographically comparable in SQL (e.g. `expires_at <= ?`).
    """
    return moment.astimezone(UTC).isoformat(timespec="microseconds")


def utc_now() -> str:
    return to_iso(datetime.now(UTC))

"""
Alembic environment for Pertly.

Pertly uses no ORM: there is no SQLAlchemy metadata to autogenerate from, and
every migration is a list of hand-written SQL statements run through
`op.execute`. SQLAlchemy is present only because Alembic needs it to talk to
the database.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from pertly.common.config import settings
from pertly.common.db import prepare_database

config = context.config

if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)


def database_url() -> str:
    # Tests (and tooling) can inject a URL; otherwise use the app's settings.
    return config.get_main_option("sqlalchemy.url") or settings.database_url


def run_migrations_offline() -> None:
    """Emit the SQL to stdout instead of executing it (`alembic upgrade head --sql`)."""
    context.configure(url=database_url(), target_metadata=None, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = database_url()
    if url == settings.database_url:
        prepare_database()
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

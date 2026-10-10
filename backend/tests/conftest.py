from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from pertly.common.config import settings
from pertly.main import create_app

BACKEND_DIR = Path(__file__).resolve().parents[1]
STRONG_PASSWORD = "Sup3rSecret"


def alembic_config(database_path: Path) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path}")
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "pertly-test.db"
    monkeypatch.setattr(settings, "database_path", path)
    monkeypatch.setattr(settings, "allow_registration", True)
    monkeypatch.setattr(settings, "admin_email", None)
    monkeypatch.setattr(settings, "admin_password", None)
    command.upgrade(alembic_config(path), "head")
    return path


@pytest.fixture
def make_client(database_path: Path) -> Iterator[Callable[[], TestClient]]:
    """
    Factory for independent clients, each with its own cookie jar (= its own browser).
    Every client gets its own app instance: a TestClient runs the app lifespan on its own
    event loop, and resources created there (the PDF renderer) must not be shared across loops.
    All instances use the same database file.
    """
    clients: list[TestClient] = []

    def factory() -> TestClient:
        client = TestClient(create_app(), headers={"X-Pertly-Client": "1"})
        client.__enter__()
        clients.append(client)
        return client

    yield factory
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def client(make_client: Callable[[], TestClient]) -> TestClient:
    return make_client()


def register(
    client: TestClient,
    email: str,
    password: str = STRONG_PASSWORD,
    first_name: str = "Ada",
    last_name: str = "Lovelace",
):
    return client.post(
        "/api/auth/register",
        data={
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "password": password,
            "confirm_password": password,
        },
    )


def login(client: TestClient, email: str, password: str = STRONG_PASSWORD):
    return client.post("/api/auth/login", data={"email": email, "password": password})


@pytest.fixture
def admin_client(make_client: Callable[[], TestClient]) -> TestClient:
    """Signed in as the instance's first user, who is therefore admin."""
    client = make_client()
    assert register(client, "admin@example.com").status_code == 201
    return client


@pytest.fixture
def user_client(make_client: Callable[[], TestClient], admin_client: TestClient) -> TestClient:
    """A regular (non-admin) user, registered after the admin."""
    client = make_client()
    assert register(client, "user@example.com", first_name="Grace", last_name="Hopper").status_code == 201
    return client

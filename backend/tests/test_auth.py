from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from pertly.common.config import settings
from tests.conftest import STRONG_PASSWORD, login, register


def test_first_registered_user_becomes_admin_and_is_signed_in(client: TestClient) -> None:
    response = register(client, "First@Example.com")

    assert response.status_code == 201
    body = response.json()
    assert body["is_admin"] is True
    assert body["email"] == "first@example.com"
    assert "password" not in body and "password_hash" not in body
    assert client.get("/api/users/me").json()["id"] == body["id"]


def test_second_user_is_not_admin(admin_client: TestClient, make_client: Callable[[], TestClient]) -> None:
    response = register(make_client(), "second@example.com")

    assert response.status_code == 201
    assert response.json()["is_admin"] is False


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"email": "not-an-email"}, "INVALID_MAIL"),
        ({"confirm_password": "Different1"}, "PASSWORD_MISMATCH"),
        ({"password": "short1A", "confirm_password": "short1A"}, "PASSWORD_REQUIREMENT"),
        ({"password": "alllowercase1", "confirm_password": "alllowercase1"}, "PASSWORD_REQUIREMENT"),
        ({"first_name": "   "}, "NAME_REQUIRED"),
    ],
)
def test_register_rejects_invalid_input(client: TestClient, overrides: dict, code: str) -> None:
    data = {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada@example.com",
        "password": STRONG_PASSWORD,
        "confirm_password": STRONG_PASSWORD,
    } | overrides

    response = client.post("/api/auth/register", data=data)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == code


def test_register_rejects_duplicate_email_case_insensitively(
    admin_client: TestClient, make_client: Callable[[], TestClient]
) -> None:
    response = register(make_client(), "ADMIN@example.com")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "ALREADY_IN_USE"


def test_registration_can_be_disabled_except_for_the_first_user(
    make_client: Callable[[], TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "allow_registration", False)
    first = make_client()
    assert first.get("/api/auth/config").json() == {"registration_open": True}
    assert register(first, "admin@example.com").status_code == 201

    second = make_client()
    assert second.get("/api/auth/config").json() == {"registration_open": False}
    response = register(second, "late@example.com")
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "REGISTRATION_DISABLED"


def test_login_and_logout(admin_client: TestClient, make_client: Callable[[], TestClient]) -> None:
    browser = make_client()

    response = login(browser, "admin@example.com")
    assert response.status_code == 200
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    assert browser.get("/api/users/me").status_code == 200

    assert browser.post("/api/auth/logout").status_code == 204
    assert browser.get("/api/users/me").status_code == 401
    # The other session of the same user is unaffected.
    assert admin_client.get("/api/users/me").status_code == 200


def test_login_with_wrong_password_or_unknown_email(
    admin_client: TestClient, make_client: Callable[[], TestClient]
) -> None:
    browser = make_client()
    for email, password in [("admin@example.com", "Wrong1234"), ("nobody@example.com", STRONG_PASSWORD)]:
        response = login(browser, email, password)
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "INVALID_CREDENTIALS"


def test_logout_without_session_succeeds(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 204


def test_unauthenticated_requests_are_rejected(client: TestClient) -> None:
    for method, path in [("get", "/api/users/me"), ("get", "/api/estimates"), ("get", "/api/settings")]:
        response = getattr(client, method)(path)
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "UNAUTHORIZED"


def test_unsafe_requests_need_the_client_header(make_client: Callable[[], TestClient]) -> None:
    client = make_client()
    client.headers.pop("X-Pertly-Client")

    response = register(client, "csrf@example.com")

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "CLIENT_HEADER_MISSING"
    assert client.get("/api/health").status_code == 200


def test_expired_session_is_rejected(admin_client: TestClient, database_path) -> None:
    import sqlite3

    connection = sqlite3.connect(database_path)
    connection.execute("UPDATE user_sessions SET expires_at = '2000-01-01T00:00:00.000000+00:00'")
    connection.commit()
    connection.close()

    assert admin_client.get("/api/users/me").status_code == 401


def test_validation_errors_use_the_common_error_shape(client: TestClient) -> None:
    response = client.post("/api/auth/login", data={"email": "x@example.com"})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"


def test_bootstrap_admin_is_created_on_empty_instance(database_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from pertly.main import create_app

    monkeypatch.setattr(settings, "admin_email", "boot@example.com")
    monkeypatch.setattr(settings, "admin_password", STRONG_PASSWORD)
    with TestClient(create_app(), headers={"X-Pertly-Client": "1"}) as client:
        response = login(client, "boot@example.com")
        assert response.status_code == 200
        assert response.json()["is_admin"] is True


def test_active_sessions_slide_and_refresh_the_cookie(admin_client: TestClient, database_path) -> None:
    import sqlite3

    assert "set-cookie" not in admin_client.get("/api/users/me").headers

    connection = sqlite3.connect(database_path)
    connection.execute(
        "UPDATE user_sessions SET last_seen_at = '2000-01-01T00:00:00.000000+00:00', "
        "expires_at = '2999-01-01T00:00:00.000000+00:00'"
    )
    connection.commit()
    response = admin_client.get("/api/users/me")
    expires_at = connection.execute("SELECT expires_at FROM user_sessions").fetchone()[0]
    connection.close()

    assert response.status_code == 200
    assert "pertly_session=" in response.headers["set-cookie"]
    assert expires_at < "2999"


def test_sliding_cookie_is_also_set_on_responses_returned_directly(admin_client: TestClient, database_path) -> None:
    import sqlite3

    connection = sqlite3.connect(database_path)
    connection.execute("UPDATE user_sessions SET last_seen_at = '2000-01-01T00:00:00.000000+00:00'")
    connection.commit()
    connection.close()
    admin_client.put(
        "/api/estimates/x",
        json={"id": "x", "status": "draft", "pricingMethod": "time-materials", "createdAt": "a", "updatedAt": "b"},
    )

    connection = sqlite3.connect(database_path)
    connection.execute("UPDATE user_sessions SET last_seen_at = '2000-01-01T00:00:00.000000+00:00'")
    connection.commit()
    connection.close()
    response = admin_client.delete("/api/estimates/x")

    assert response.status_code == 204
    assert "pertly_session=" in response.headers.get("set-cookie", "")

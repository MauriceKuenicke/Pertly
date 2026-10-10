from fastapi.testclient import TestClient

from tests.conftest import STRONG_PASSWORD, login


def user_id_by_email(admin_client: TestClient, email: str) -> str:
    return next(user["id"] for user in admin_client.get("/api/users").json() if user["email"] == email)


def test_change_own_password_revokes_other_sessions(user_client: TestClient, make_client) -> None:
    other_browser = make_client()
    assert login(other_browser, "user@example.com").status_code == 200

    response = user_client.put(
        "/api/users/me/password",
        data={"current_password": STRONG_PASSWORD, "new_password": "N3wPassword", "confirm_password": "N3wPassword"},
    )

    assert response.status_code == 204
    assert user_client.get("/api/users/me").status_code == 200
    assert other_browser.get("/api/users/me").status_code == 401
    assert login(make_client(), "user@example.com", "N3wPassword").status_code == 200


def test_change_own_password_requires_current_password(user_client: TestClient) -> None:
    response = user_client.put(
        "/api/users/me/password",
        data={"current_password": "Wrong1234", "new_password": "N3wPassword", "confirm_password": "N3wPassword"},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "INVALID_CREDENTIALS"


def test_admin_endpoints_are_forbidden_for_regular_users(user_client: TestClient) -> None:
    response = user_client.get("/api/users")

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "FORBIDDEN"


def test_admin_lists_and_creates_users(admin_client: TestClient, make_client) -> None:
    response = admin_client.post(
        "/api/users",
        data={"first_name": "Linus", "last_name": "T", "email": "linus@example.com", "password": STRONG_PASSWORD},
    )

    assert response.status_code == 201
    assert response.json()["is_admin"] is False
    emails = [user["email"] for user in admin_client.get("/api/users").json()]
    assert emails == ["admin@example.com", "linus@example.com"]
    assert login(make_client(), "linus@example.com").status_code == 200


def test_deactivating_a_user_ends_their_sessions_and_blocks_login(
    admin_client: TestClient, user_client: TestClient, make_client
) -> None:
    user_id = user_id_by_email(admin_client, "user@example.com")

    response = admin_client.patch(f"/api/users/{user_id}", json={"is_active": False})

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert user_client.get("/api/users/me").status_code == 401
    login_response = login(make_client(), "user@example.com")
    assert login_response.status_code == 403
    assert login_response.json()["detail"]["code"] == "USER_INACTIVE"


def test_admin_can_promote_a_user(admin_client: TestClient, user_client: TestClient) -> None:
    user_id = user_id_by_email(admin_client, "user@example.com")

    assert admin_client.patch(f"/api/users/{user_id}", json={"is_admin": True}).json()["is_admin"] is True
    assert user_client.get("/api/users").status_code == 200


def test_admin_cannot_modify_or_delete_themselves(admin_client: TestClient) -> None:
    admin_id = admin_client.get("/api/users/me").json()["id"]

    for response in [
        admin_client.patch(f"/api/users/{admin_id}", json={"is_admin": False}),
        admin_client.delete(f"/api/users/{admin_id}"),
        admin_client.post(f"/api/users/{admin_id}/password", data={"new_password": "N3wPassword"}),
    ]:
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "CANNOT_MODIFY_SELF"


def test_last_active_admin_is_protected(admin_client: TestClient, database_path) -> None:
    # Through the API the acting admin always counts as an active admin, so this guard
    # protects against races and future code paths; exercise it on the service directly.
    import pytest

    from pertly.common.db import connect
    from pertly.domains.user.model import UserUpdate
    from pertly.domains.user.service import LastAdminError, UserService

    admin_id = admin_client.get("/api/users/me").json()["id"]
    connection = connect(database_path)
    try:
        user_service = UserService(db_session=connection)
        with pytest.raises(LastAdminError):
            user_service.update_user_flags(admin_id, UserUpdate(is_admin=False))
        with pytest.raises(LastAdminError):
            user_service.update_user_flags(admin_id, UserUpdate(is_active=False))
        with pytest.raises(LastAdminError):
            user_service.delete_user(admin_id)
        assert user_service.get_user_by_id(admin_id).is_admin is True
    finally:
        connection.close()


def test_admin_can_demote_another_admin(admin_client: TestClient, user_client: TestClient) -> None:
    user_id = user_id_by_email(admin_client, "user@example.com")
    admin_client.patch(f"/api/users/{user_id}", json={"is_admin": True})

    response = admin_client.patch(f"/api/users/{user_id}", json={"is_admin": False})

    assert response.status_code == 200
    assert user_client.get("/api/users").status_code == 403


def test_admin_resets_password_and_revokes_sessions(
    admin_client: TestClient, user_client: TestClient, make_client
) -> None:
    user_id = user_id_by_email(admin_client, "user@example.com")

    response = admin_client.post(f"/api/users/{user_id}/password", data={"new_password": "Res3tPassword"})

    assert response.status_code == 204
    assert user_client.get("/api/users/me").status_code == 401
    assert login(make_client(), "user@example.com", "Res3tPassword").status_code == 200


def test_deleting_a_user_removes_their_data(admin_client: TestClient, user_client: TestClient) -> None:
    user_client.put("/api/settings", json={"dayRate": 1000})
    user_id = user_id_by_email(admin_client, "user@example.com")

    assert admin_client.delete(f"/api/users/{user_id}").status_code == 204
    assert user_client.get("/api/users/me").status_code == 401
    assert [user["email"] for user in admin_client.get("/api/users").json()] == ["admin@example.com"]


def test_unknown_user_returns_404(admin_client: TestClient) -> None:
    for response in [
        admin_client.patch("/api/users/missing", json={"is_active": False}),
        admin_client.delete("/api/users/missing"),
        admin_client.post("/api/users/missing/password", data={"new_password": STRONG_PASSWORD}),
    ]:
        assert response.status_code == 404
        assert response.json()["detail"]["code"] == "USER_NOT_FOUND"

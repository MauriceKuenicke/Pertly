from fastapi.testclient import TestClient


def test_settings_default_to_empty_object(user_client: TestClient) -> None:
    assert user_client.get("/api/settings").json() == {}


def test_settings_roundtrip_and_privacy(admin_client: TestClient, user_client: TestClient) -> None:
    document = {"dayRate": 1200, "currency": "CHF", "roles": [{"id": "r1", "name": "Dev", "dayRate": 950}]}

    assert user_client.put("/api/settings", json=document).json() == document
    assert user_client.put("/api/settings", json=document | {"dayRate": 1300}).status_code == 200

    assert user_client.get("/api/settings").json() == document | {"dayRate": 1300}
    assert admin_client.get("/api/settings").json() == {}


def test_settings_must_be_an_object(user_client: TestClient) -> None:
    response = user_client.put("/api/settings", json="nope")

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "VALIDATION_ERROR"

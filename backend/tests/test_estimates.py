from typing import Any

from fastapi.testclient import TestClient


def make_estimate(estimate_id: str, name: str = "Website relaunch", **overrides: Any) -> dict[str, Any]:
    return {
        "id": estimate_id,
        "status": "draft",
        "createdAt": "2026-10-01T10:00:00.000Z",
        "updatedAt": "2026-10-01T10:00:00.000Z",
        "currentStep": 2,
        "furthestStep": 2,
        "pricingMethod": "time-materials",
        "projectDetails": {"estimateName": name, "clientName": "Ünïcødé GmbH", "currency": "EUR", "preparerName": ""},
        "timeMaterials": {"workPackages": [{"id": "wp1", "name": "Design", "optimisticDays": 1}]},
    } | overrides


def test_new_estimates_are_listed_newest_first_and_updates_keep_position(user_client: TestClient) -> None:
    for estimate_id in ["first", "second", "third"]:
        assert user_client.put(f"/api/estimates/{estimate_id}", json=make_estimate(estimate_id)).status_code == 200

    updated = make_estimate("first", name="Renamed", status="done")
    assert user_client.put("/api/estimates/first", json=updated).json() == updated

    listed = user_client.get("/api/estimates").json()
    assert [estimate["id"] for estimate in listed] == ["third", "second", "first"]
    assert listed[2] == updated


def test_documents_roundtrip_unchanged(user_client: TestClient) -> None:
    estimate = make_estimate("roundtrip", extraFieldFromTheFuture={"nested": [1, 2.5, None, True]})

    user_client.put("/api/estimates/roundtrip", json=estimate)

    assert user_client.get("/api/estimates").json() == [estimate]


def test_delete_estimate(user_client: TestClient) -> None:
    user_client.put("/api/estimates/gone", json=make_estimate("gone"))

    assert user_client.delete("/api/estimates/gone").status_code == 204
    assert user_client.get("/api/estimates").json() == []
    response = user_client.delete("/api/estimates/gone")
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ESTIMATE_NOT_FOUND"


def test_estimates_are_private_per_user(admin_client: TestClient, user_client: TestClient) -> None:
    admin_client.put("/api/estimates/shared-id", json=make_estimate("shared-id", name="Admin's"))

    assert user_client.get("/api/estimates").json() == []
    assert user_client.delete("/api/estimates/shared-id").status_code == 404

    # The same id in another account is a separate estimate and never overwrites the first.
    user_client.put("/api/estimates/shared-id", json=make_estimate("shared-id", name="User's"))
    assert admin_client.get("/api/estimates").json()[0]["projectDetails"]["estimateName"] == "Admin's"
    assert user_client.get("/api/estimates").json()[0]["projectDetails"]["estimateName"] == "User's"


def test_put_rejects_mismatched_id(user_client: TestClient) -> None:
    response = user_client.put("/api/estimates/one", json=make_estimate("other"))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "ID_MISMATCH"


def test_put_rejects_documents_without_required_fields(user_client: TestClient) -> None:
    response = user_client.put("/api/estimates/x", json={"id": "x"})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_ESTIMATE"


def test_put_rejects_non_objects_and_bad_ids(user_client: TestClient) -> None:
    assert user_client.put("/api/estimates/x", json=[1, 2]).json()["detail"]["code"] == "VALIDATION_ERROR"
    assert user_client.put("/api/estimates/bad%20id", json=make_estimate("bad id")).status_code == 422


def test_put_rejects_oversized_documents(user_client: TestClient, monkeypatch) -> None:
    from pertly.common.config import settings

    monkeypatch.setattr(settings, "max_document_bytes", 200)

    response = user_client.put("/api/estimates/big", json=make_estimate("big", notes="x" * 500))

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "DOCUMENT_TOO_LARGE"

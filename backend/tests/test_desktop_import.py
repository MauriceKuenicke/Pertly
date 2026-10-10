import json
from pathlib import Path

from fastapi.testclient import TestClient

from pertly.cli import main as cli_main
from tests.conftest import STRONG_PASSWORD
from tests.test_estimates import make_estimate


def test_import_json_keeps_order_skips_existing_and_imports_settings(user_client: TestClient, tmp_path: Path) -> None:
    user_client.put("/api/estimates/b", json=make_estimate("b", name="Already here"))
    desktop_file = tmp_path / "estimates.json"
    desktop_file.write_text(
        json.dumps(
            {
                "estimates": [
                    make_estimate("a"),
                    make_estimate("b", name="From desktop"),
                    make_estimate("c"),
                    {"broken": True},
                    make_estimate("bad.id"),
                    make_estimate(5),
                ],
                "settings": {"dayRate": 777},
            }
        )
    )

    cli_main(["import-json", "--file", str(desktop_file), "--email", "user@example.com"])

    listed = user_client.get("/api/estimates").json()
    assert [estimate["id"] for estimate in listed] == ["a", "c", "b"]
    assert listed[2]["projectDetails"]["estimateName"] == "Already here"
    assert user_client.get("/api/settings").json() == {"dayRate": 777}


def test_import_json_keeps_existing_settings_unless_replace(user_client: TestClient, tmp_path: Path) -> None:
    user_client.put("/api/settings", json={"dayRate": 1})
    desktop_file = tmp_path / "estimates.json"
    desktop_file.write_text(json.dumps({"estimates": [], "settings": {"dayRate": 2}}))

    cli_main(["import-json", "--file", str(desktop_file), "--email", "user@example.com"])
    assert user_client.get("/api/settings").json() == {"dayRate": 1}

    cli_main(["import-json", "--file", str(desktop_file), "--email", "user@example.com", "--replace-settings"])
    assert user_client.get("/api/settings").json() == {"dayRate": 2}


def test_create_admin_and_backup(client: TestClient, tmp_path: Path) -> None:
    cli_main(["create-admin", "--email", "ops@example.com", "--password", STRONG_PASSWORD])
    response = client.post("/api/auth/login", data={"email": "ops@example.com", "password": STRONG_PASSWORD})
    assert response.json()["is_admin"] is True

    backup_file = tmp_path / "backup" / "pertly.db"
    cli_main(["backup", "--out", str(backup_file)])
    assert backup_file.stat().st_size > 0

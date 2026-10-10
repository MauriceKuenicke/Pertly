import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest
from fastapi.testclient import TestClient

from pertly.domains.proposal.service import safe_pdf_filename


def chromium_available() -> bool:
    # Probed in a subprocess: starting Playwright in the test process itself would leave
    # its event-loop machinery behind and interfere with the app's own async renderer.
    probe = "from playwright.sync_api import sync_playwright\nwith sync_playwright() as p: p.chromium.launch().close()"
    try:
        return subprocess.run([sys.executable, "-c", probe], capture_output=True, timeout=60).returncode == 0
    except subprocess.TimeoutExpired:
        return False


requires_chromium = pytest.mark.skipif(not chromium_available(), reason="Chromium not installed")

PROPOSAL_HTML = "<!doctype html><html><head><title>t</title></head><body><h1>Proposal 🔒</h1></body></html>"


def test_safe_pdf_filename() -> None:
    assert safe_pdf_filename("Website-Relaunch-Estimate.pdf") == "Website-Relaunch-Estimate.pdf"
    assert safe_pdf_filename('evil"\r\nname') == "evil-name.pdf"
    assert safe_pdf_filename("///") == "proposal.pdf"


def test_pdf_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/proposals/pdf", json={"html": PROPOSAL_HTML, "filename": "a.pdf"})

    assert response.status_code == 401


def test_pdf_rejects_oversized_html(user_client: TestClient, monkeypatch) -> None:
    from pertly.common.config import settings

    monkeypatch.setattr(settings, "max_pdf_html_bytes", 10)

    response = user_client.post("/api/proposals/pdf", json={"html": PROPOSAL_HTML, "filename": "a.pdf"})

    assert response.status_code == 413


@requires_chromium
def test_pdf_is_rendered(user_client: TestClient) -> None:
    response = user_client.post("/api/proposals/pdf", json={"html": PROPOSAL_HTML, "filename": "My Estimate.pdf"})

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == 'attachment; filename="My-Estimate.pdf"'
    assert response.content.startswith(b"%PDF")


@requires_chromium
def test_pdf_render_never_fetches_anything(user_client: TestClient) -> None:
    """
    End-to-end check that rendering stays offline. Note: Chromium's own private-network
    protections also block loopback requests from the render origin, so this documents the
    combined behaviour rather than isolating Pertly's layers (JS off, routing, CSP header).
    """
    hits: list[str] = []

    class Recorder(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 (http.server naming)
            hits.append(self.path)
            self.send_response(204)
            self.end_headers()

        def log_message(self, *args) -> None:
            pass

    server = HTTPServer(("127.0.0.1", 0), Recorder)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}"
    # Markup placed before <head> as well, which a meta-tag CSP would not cover.
    html = (
        f"<img src='{base}/before-head.png'><html><head><link rel='stylesheet' href='{base}/style.css'></head>"
        f"<body><img src='{base}/tracker.png'><iframe src='{base}/frame'></iframe>"
        f"<script>fetch('{base}/script')</script>ok</body></html>"
    )
    try:
        response = user_client.post("/api/proposals/pdf", json={"html": html, "filename": "x.pdf"})
    finally:
        server.shutdown()

    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    assert hits == []

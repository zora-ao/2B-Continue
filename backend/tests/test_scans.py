from io import BytesIO

from PIL import Image

from app.blueprints.scans.gemini import ScanError, validate_result
from app.blueprints.scans import services
from .conftest import csrf_headers, register, start_guest


RESULT = {"name": "Fan", "type": "fan", "watts": 45}


def photo():
    image = BytesIO()
    Image.new("RGB", (80, 80)).save(image, "JPEG")
    image.seek(0)
    return {"photo": (image, "label.jpg")}


def test_guest_identity_upload_and_qr_handoff(client, monkeypatch):
    monkeypatch.setitem(client.application.config, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("app.blueprints.scans.routes.read_rating_label", lambda _: RESULT)
    assert client.post("/api/scans/read", data=photo()).status_code == 401
    assert start_guest(client).status_code in (200, 201)
    headers = csrf_headers(client)
    direct = client.post("/api/scans/read", data=photo(), headers=headers)
    assert direct.status_code == 200
    assert direct.json == RESULT

    invalid = client.post("/api/scans/read", data={"photo": (BytesIO(b"text"), "label.jpg")},
                          headers=headers)
    assert invalid.status_code == 400

    started = client.post("/api/scan-sessions", headers=headers)
    assert started.status_code == 201
    poll = f"/api/scan-sessions/{started.json['code']}"
    phone = client.application.test_client()
    outsider = client.application.test_client()
    assert register(outsider).status_code == 201
    assert phone.get(poll).status_code == 401
    assert outsider.get(poll).json == {"status": "expired"}
    assert client.get(poll).json == {"status": "waiting"}

    def unreadable(_photo):
        raise ScanError("Unreadable", 422)

    monkeypatch.setattr(services, "read_rating_label", unreadable)
    assert phone.post(f"{poll}/photo", data=photo()).status_code == 422
    assert client.get(poll).json == {"status": "waiting"}
    monkeypatch.setattr(services, "read_rating_label", lambda _: RESULT)
    assert phone.post(f"{poll}/photo", data=photo()).status_code == 204
    assert client.get(poll).json == {"status": "done", "result": RESULT}
    assert outsider.get(poll).json == {"status": "expired"}
    assert phone.post(f"{poll}/photo", data=photo()).status_code == 409

    now = services.time()
    monkeypatch.setattr(services, "time", lambda: now + services.SESSION_SECONDS + 1)
    assert client.get(poll).json == {"status": "expired"}
    assert phone.post(f"{poll}/photo", data=photo()).status_code == 410


def test_watts_require_matching_label_evidence():
    assert validate_result({**RESULT, "label_text": "Rated input: 45 W"}) == RESULT
    assert validate_result({**RESULT, "label_text": "120 V, 0.5 A"})["watts"] is None
    assert validate_result({**RESULT, "label_text": "45 W / 60 W"})["watts"] is None

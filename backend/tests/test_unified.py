from io import BytesIO
from urllib.parse import parse_qs, urlsplit

from fastapi.testclient import TestClient

import main


def test_unified_routes(tmp_path, monkeypatch):
    monkeypatch.setenv("ANSEONG_DB_PATH", str(tmp_path / "places.db"))
    monkeypatch.setenv("SIGNAL_DB_PATH", str(tmp_path / "signals.db"))
    monkeypatch.delenv("TRAFFIC_SIGNAL_API_URL", raising=False)
    monkeypatch.delenv("TRAFFIC_SIGNAL_API_KEY", raising=False)
    monkeypatch.delenv("COMMERCIAL_SERVICE_KEY", raising=False)
    monkeypatch.setattr(main, "FRONTEND_DIST", tmp_path, raising=False)
    (tmp_path / "index.html").write_text("<html>Vite build</html>", encoding="utf-8")
    with TestClient(main.app) as client:
        for path in ("/", "/traffic", "/signals", "/commercial"):
            response = client.get(path)
            assert response.status_code == 200
            assert response.text == "<html>Vite build</html>"
        assert client.get("/api/places").json() == []
        assert (
            client.get("/api/traffic/overview?mode=sample").json()["dataStatus"]
            == "sample"
        )
        assert client.get("/api/missing").json() == {"detail": "Not Found"}
        assert client.get("/assets/missing.js").status_code == 404

        response = client.options(
            "/api/places",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert (
            response.headers["access-control-allow-origin"] == "http://localhost:5173"
        )

        response = client.get("/api/traffic-signals", params={"q": "안성", "limit": 1})
        payload = response.json()
        assert payload["total"] > 1
        assert payload["source"] == "mock"
        signal = payload["items"][0]
        detail = client.get(f"/api/traffic-signals/{signal['id']}").json()
        assert detail["signal"] == signal
        assert any(item["label"] == "서쪽 직진" for item in detail["history"])

        assert (
            client.put(
                "/api/signals/1",
                json={
                    "status": "yellow",
                    "remaining_seconds": 7,
                },
            ).status_code
            == 200
        )
        assert client.get("/api/signals/1").json()["signal"]["status"] == "yellow"

        rows = [
            {
                "crsrdId": "test-1",
                "lclgvNm": "안성",
                "totDt": "2026-11-24 10:00:00",
                "ntStsgSttsNm": "protected-Movement-Allowed",
                "ntStsgRmndCs": "250",
                "wtStsgRmndCs": "9900",
            }
        ]
        assert (
            client.post("/api/traffic-signals/sync", json={"rows": rows}).json()[
                "saved"
            ]
            == 1
        )
        synced = client.get("/api/traffic-signals", params={"status": "green"}).json()
        assert synced["source"] == "live"
        assert [item["intersection_id"] for item in synced["items"]] == ["test-1"]
        synced_detail = client.get(f"/api/signals/{synced['items'][0]['id']}").json()
        assert synced_detail["signal"]["remaining_seconds"] == 2
        assert synced_detail["signal"]["phase_times"]["red"] == 0
        assert [item["label"] for item in synced_detail["history"]] == ["북쪽 직진"]

        commercial_url = "/api/commercial-service/storeListInRadius"
        params = {"radius": 500, "cx": 127.27, "cy": 37.0}
        assert client.get(commercial_url, params=params).status_code == 503

        def upstream(url, *, timeout):
            assert urlsplit(url).hostname == "apis.data.go.kr"
            assert parse_qs(urlsplit(url).query)["serviceKey"] == ["test+key"]
            return BytesIO(b'{"response":{"body":{"items":[]}}}')

        monkeypatch.setenv("COMMERCIAL_SERVICE_KEY", "test%2Bkey")
        monkeypatch.setattr(main.commercial, "urlopen", upstream)
        assert (
            client.get(commercial_url, params=params).json()["response"]["body"][
                "items"
            ]
            == []
        )

        monkeypatch.setenv("ANSEONG_ALLOW_WRITES", "0")
        assert client.delete("/api/places").status_code == 403
        assert (
            client.post("/api/traffic-signals/sync", json={"rows": rows}).status_code
            == 403
        )
        assert client.get("/api/traffic-signals").status_code == 200

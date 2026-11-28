import json
from datetime import UTC, datetime, timedelta
from http.client import IncompleteRead
from io import BytesIO
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

import main
import signal_provider as provider
import signals


@pytest.fixture
def feed(tmp_path, monkeypatch):
    monkeypatch.setenv("ANSEONG_DB_PATH", str(tmp_path / "places.db"))
    monkeypatch.setenv("SIGNAL_DB_PATH", str(tmp_path / "signals.db"))
    monkeypatch.delenv("TRAFFIC_SIGNAL_API_KEY", raising=False)
    return provider.SignalFeed("test-key", signals.get_db)


def signal_row(identifier, observed_at):
    return {
        "stdgCd": "4155000000",
        "crsrdId": identifier,
        "totDt": observed_at.isoformat(),
        "etStsgSttsNm": "protected-Movement-Allowed",
        "etStsgRmndCs": "275",
        "neStsgSttsNm": "stop-And-Remain",
        "neStsgRmndCs": "",
    }


def response(rows, total=None, code="00"):
    return BytesIO(
        json.dumps(
            {
                "response": {
                    "header": {"resultCode": code},
                    "body": {
                        "items": {"item": rows},
                        "totalCount": len(rows) if total is None else total,
                    },
                },
            }
        ).encode()
    )


def test_cached_anseong_signals_and_details(feed, monkeypatch):
    now = datetime.now(UTC).replace(microsecond=0)
    signals_data = [
        signal_row("B", now),
        {**signal_row("A", now - timedelta(minutes=8)), "etStsgRmndCs": "60"},
        signal_row("A", now),
        {**signal_row("C", now), "stdgCd": "1100000000"},
    ]
    queries = []

    def upstream(url, *, timeout):
        parts = urlsplit(url)
        query = parse_qs(parts.query)
        queries.append((parts.path, query))
        assert timeout == 5
        if parts.path.endswith("/crsrd_map_info"):
            return response(
                [
                    {
                        "stdgCd": "4155011800",
                        "crsrdId": "A",
                        "crsrdNm": "안성시청 사거리",
                        "mapCtptIntLat": "37.008",
                        "mapCtptIntLot": "127.279",
                    }
                ]
            )
        return response(signals_data)

    monkeypatch.setattr(provider, "urlopen", upstream)
    with TestClient(main.app) as client:
        main.app.state.signal_feed = feed
        first = client.get("/api/traffic-signals").json()
        assert first["source"] == "mock"
        assert first["observation"]["state"] == "sample"

        feed.refresh()
        live = client.get("/api/traffic-signals").json()
        assert live["source"] == "live"
        assert live["observation"]["state"] == "fresh"
        assert live["total"] == 2
        item = client.get("/api/signals", params={"q": "안성시청"}).json()["items"][0]
        assert (item["name"], item["latitude"], item["longitude"]) == (
            "안성시청 사거리",
            37.008,
            127.279,
        )
        assert item["status"] == "green"
        assert item["remaining_seconds"] == 2
        assert item["movement_label"] == "동쪽 직진"
        detail_path = f"/api/traffic-signals/{item['id']}"
        detail = client.get(detail_path).json()
        assert detail["signal"] == item
        assert [direction["label"] for direction in detail["history"]] == [
            "동쪽 직진",
            "북동쪽 직진",
        ]
        assert detail["history"][1]["remaining_seconds"] is None
        assert (
            client.get("/api/traffic-signals", params={"status": "red"}).json()["total"]
            == 0
        )
        assert (
            client.get("/api/traffic-signals", params={"limit": 1, "offset": 1}).json()[
                "total"
            ]
            == 2
        )
        assert len(queries) == 2
        assert all(
            query["stdgCd"] == ["4155000000"] and query["type"] == ["JSON"]
            for _, query in queries
        )

        signals_data.reverse()
        feed.refresh()
        assert client.get(detail_path).json()["signal"]["intersection_id"] == "A"
        assert len(queries) == 3  # 교차로 맵은 매번 수집하지 않는다.

        def interrupted(url, *, timeout):
            raise IncompleteRead(b"partial")

        monkeypatch.setattr(provider, "urlopen", interrupted)
        feed.refresh()
        assert (
            client.get("/api/traffic-signals").json()["observation"]["state"] == "stale"
        )
        monkeypatch.setattr(provider, "urlopen", upstream)
        feed.refresh()
        assert (
            client.get("/api/traffic-signals").json()["observation"]["state"] == "fresh"
        )

        signals_data.clear()
        feed.refresh()
        assert (
            client.get("/api/traffic-signals").json()["observation"]["state"] == "stale"
        )
        assert client.get(detail_path).json()["signal"]["observation_status"] == "stale"


def test_old_observation_and_xml_map(feed, monkeypatch):
    old = datetime.now(UTC) - timedelta(minutes=6)

    def upstream(url, *, timeout):
        if "/crsrd_map_info?" in url:
            return BytesIO(b"""<response><header><resultCode>00</resultCode></header><body>
                <items><item><stdgCd>4155000000</stdgCd><crsrdId>A</crsrdId>
                <mapCtptIntLat>999</mapCtptIntLat><mapCtptIntLot>127.25</mapCtptIntLot>
                </item></items><totalCount>1</totalCount></body></response>""")
        return response([signal_row("A", old)])

    monkeypatch.setattr(provider, "urlopen", upstream)
    with TestClient(main.app) as client:
        main.app.state.signal_feed = feed
        feed.refresh()
        data = client.get("/api/traffic-signals").json()
        assert data["observation"]["state"] == "stale"
        item = data["items"][0]
        assert item["latitude"] is None and item["longitude"] is None


def test_incomplete_observation_is_not_published(feed, monkeypatch):
    now = datetime.now(UTC)
    queried = []

    def upstream(url, *, timeout):
        parts = urlsplit(url)
        query = parse_qs(parts.query)
        if parts.path.endswith("/crsrd_map_info"):
            return response([])
        queried.append(query["pageNo"][0])
        return response([signal_row("A", now)], total=1000)

    monkeypatch.setattr(provider, "urlopen", upstream)
    with TestClient(main.app) as client:
        main.app.state.signal_feed = feed
        feed.refresh()
        data = client.get("/api/traffic-signals").json()
        assert data["source"] == "mock"
        assert data["observation"]["state"] == "sample"
    assert queried == ["1"]  # 5페이지를 초과하는 응답은 더 요청하지 않는다.

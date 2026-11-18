import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main
import traffic


client = TestClient(main.app)
endpoint = "/traffic/overview"
sample_path = Path(__file__).resolve().parents[1] / "data" / "traffic-sample.json"


def test_sample_overview():
    response = client.get(endpoint)
    assert response.status_code == 200
    overview = response.json()
    assert overview["source"] == "안성시 도로 구간 예시"
    assert overview["dataStatus"] == "sample"
    assert overview["generatedAt"] == "2026-11-18T08:05:00+09:00"
    assert overview["hourlyTraffic"] is None
    assert overview["summary"] is None
    segment = overview["intersections"][0]
    assert segment["position"] == [37.007, 127.279]
    assert segment["observedAt"] == "2026-11-18T08:00:00+09:00"
    assert segment["trafficVolume"] == 24
    assert segment["trafficVolumeUnit"] == "vehicles/interval"
    assert segment["aggregationIntervalSeconds"] == 300
    assert segment["averageWait"] is None
    assert segment["greenRatio"] is None
    assert segment["directions"] is None


def test_empty_overview(tmp_path, monkeypatch):
    data = json.loads(sample_path.read_text(encoding="utf-8"))
    data["intersections"] = []
    path = tmp_path / "empty.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(traffic, "SAMPLE_PATH", path)

    response = client.get(endpoint)
    assert response.status_code == 200
    assert response.json()["intersections"] == []


@pytest.mark.parametrize("content", [None, "{", "{}"])
def test_unavailable_overview(content, tmp_path, monkeypatch):
    path = tmp_path / "bad.json"
    if content is not None:
        path.write_text(content, encoding="utf-8")
    monkeypatch.setattr(traffic, "SAMPLE_PATH", path)

    response = client.get(endpoint)
    assert response.status_code == 503
    assert response.json() == {"detail": "교통 데이터를 불러올 수 없습니다."}


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("position", [127.279, 37.007]),
        ("observedAt", "2026-11-18T08:00:00"),
        ("trafficVolumeUnit", None),
        ("aggregationIntervalSeconds", 0),
    ],
)
def test_invalid_segment(field, value, tmp_path, monkeypatch):
    data = json.loads(sample_path.read_text(encoding="utf-8"))
    data["intersections"][0][field] = value
    path = tmp_path / "invalid-segment.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    monkeypatch.setattr(traffic, "SAMPLE_PATH", path)

    assert client.get(endpoint).status_code == 503

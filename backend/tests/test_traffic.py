import json
from pathlib import Path

import pytest

import traffic


ENDPOINT = "/api/traffic/overview"
SAMPLE_PATH = traffic.SAMPLE_PATH


@pytest.fixture
def sample_data() -> dict:
    return json.loads(SAMPLE_PATH.read_bytes())


@pytest.fixture
def sample_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "traffic.json"
    monkeypatch.setattr(traffic, "SAMPLE_PATH", path)
    return path


def test_sample_overview(client):
    response = client.get(ENDPOINT)
    assert response.status_code == 200
    overview = response.json()
    assert overview["source"] == "안성시 도로 구간 예시"
    assert overview["dataStatus"] == "sample"
    assert overview["generatedAt"] == "2026-11-18T20:05:00+09:00"
    assert len(overview["hourlyTraffic"]) == 15
    assert overview["summary"] == {
        "count": 6, "congested": 2, "averageWait": 55.6, "averageSpeed": 26.2,
    }
    segment = overview["intersections"][0]
    assert segment["position"] == [37.007, 127.279]
    assert segment["observedAt"] == "2026-11-18T08:00:00+09:00"
    assert segment["trafficVolume"] == 24
    assert segment["trafficVolumeUnit"] == "vehicles/interval"
    assert segment["aggregationIntervalSeconds"] == 300
    assert segment["averageWait"] is None
    assert segment["greenRatio"] is None
    assert segment["directions"] is None


@pytest.mark.parametrize(("score", "wait", "green", "speed", "level"), [
    (75, 30, 0.5, 25, "개선 검토 필요"),
    (45, 60, 0.5, 25, "개선 검토 필요"),
    (45, 30, 0.38, 25, "개선 검토 필요"),
    (50, 30, 0.5, 25, "관찰 필요"),
    (0, 0, 0.5, 20, "관찰 필요"),
    (0, 0, 0.5, 25, "양호"),
    (None, None, None, 25, "자료 부족"),
])
def test_signal_diagnosis(sample_data, score, wait, green, speed, level):
    row = sample_data["intersections"][0]
    row.update(congestion=score, averageWait=wait, greenRatio=green, averageSpeed=speed)
    result = traffic.TrafficSegment.model_validate(row).diagnosis
    assert result.level == level
    assert result.findings and result.actions


def test_empty_overview(client, sample_data, sample_file):
    sample_data["intersections"] = []
    sample_file.write_text(json.dumps(sample_data), encoding="utf-8")

    response = client.get(ENDPOINT)
    assert response.status_code == 200
    overview = response.json()
    assert overview["intersections"] == []
    assert overview["summary"] == {
        "count": 0, "congested": None, "averageWait": None, "averageSpeed": None,
    }


def test_summary_includes_zero_measurements(sample_data):
    row = sample_data["intersections"][0]
    row.update(congestion=0, averageWait=0, averageSpeed=0)
    sample_data["intersections"] = [row]
    assert traffic.TrafficOverview.model_validate(sample_data).summary == {
        "count": 1, "congested": 0, "averageWait": 0, "averageSpeed": 0,
    }


@pytest.mark.parametrize("content", [None, "{", "{}"])
def test_unavailable_overview(client, content, sample_file):
    if content is not None:
        sample_file.write_text(content, encoding="utf-8")

    response = client.get(ENDPOINT)
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
def test_invalid_segment(client, field, value, sample_data, sample_file):
    sample_data["intersections"][0][field] = value
    sample_file.write_text(json.dumps(sample_data), encoding="utf-8")

    assert client.get(ENDPOINT).status_code == 503

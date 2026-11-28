import pytest
from fastapi.testclient import TestClient

import traffic


OBSERVED_ENDPOINT = "/api/traffic/overview?mode=observed"


@pytest.fixture
def observed_client(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("GITS_SERVICE_KEY", "test-key")
    monkeypatch.setenv("ANSEONG_LINK_ID", "test-link")
    monkeypatch.setenv("ANSEONG_LINK_POSITION", "37.01,127.27")
    return client


def payload(*items: str, code: str = "0", item_count: int | None = None) -> bytes:
    count = len(items) if item_count is None else item_count
    return (
        f"<serviceResult><msgHeader><headerCd>{code}</headerCd>"
        f"<itemCount>{count}</itemCount></msgHeader>"
        f"<msgBody>{''.join(items)}</msgBody></serviceResult>"
    ).encode()


def test_observed_segment(observed_client, monkeypatch):
    row = (
        "<itemlist><linkid>test-link</linkid><routenm>시험 도로</routenm>"
        "<colldate>2021-06-25 09:44:00.0</colldate><spd>32</spd>"
        "<vol>41</vol></itemlist>"
    )

    def fetch(key: str, link_id: str) -> bytes:
        assert (key, link_id) == ("test-key", "test-link")
        return payload(row, row.replace("test-link", "elsewhere"))

    monkeypatch.setattr(traffic, "fetch_link_xml", fetch)
    response = observed_client.get(OBSERVED_ENDPOINT)
    assert response.status_code == 200
    result = response.json()
    assert result["dataStatus"] == "observed"
    segment, = result["intersections"]
    assert segment["averageSpeed"] == 32
    assert segment["position"] == [37.01, 127.27]
    assert segment["observedAt"] == "2021-06-25T09:44:00+09:00"
    assert segment["trafficVolume"] is None
    assert segment["diagnosis"]["level"] == "자료 부족"
    assert result["summary"] == {
        "count": 1, "congested": None, "averageWait": None, "averageSpeed": 32,
    }


@pytest.mark.parametrize(("body", "status"), [
    (payload(code="4"), 200), (payload(code="6"), 503), (b"bad xml", 502),
    (b"<unexpected/>", 502), (payload("<itemList/>"), 502), (payload(item_count=1), 502),
])
def test_provider_result(observed_client, monkeypatch, body, status):
    monkeypatch.setattr(traffic, "fetch_link_xml", lambda *_: body)
    response = observed_client.get(OBSERVED_ENDPOINT)
    assert response.status_code == status
    if status == 200:
        assert response.json()["intersections"] == []


def test_timeout(observed_client, monkeypatch):
    def timeout(*_) -> bytes:
        raise TimeoutError()

    monkeypatch.setattr(traffic, "fetch_link_xml", timeout)
    assert observed_client.get(OBSERVED_ENDPOINT).status_code == 503


def test_missing_key(observed_client, monkeypatch):
    monkeypatch.delenv("GITS_SERVICE_KEY")
    assert observed_client.get(OBSERVED_ENDPOINT).status_code == 503


def test_switch_default_source_without_changing_url(observed_client, monkeypatch):
    monkeypatch.setenv("TRAFFIC_DATA_SOURCE", "observed")
    monkeypatch.setattr(traffic, "fetch_link_xml", lambda *_: payload(code="4"))
    assert observed_client.get("/api/traffic/overview").json()["dataStatus"] == "observed"
    assert observed_client.get("/api/traffic/overview?mode=sample").json()["dataStatus"] == "sample"

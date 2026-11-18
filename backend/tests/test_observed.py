import pytest
from fastapi.testclient import TestClient

import main
import traffic


@pytest.fixture
def observed(monkeypatch):
    monkeypatch.setenv("GITS_SERVICE_KEY", "test-key")
    monkeypatch.setenv("ANSEONG_LINK_ID", "test-link")
    monkeypatch.setenv("ANSEONG_LINK_POSITION", "37.01,127.27")
    return lambda: TestClient(main.app).get("/traffic/overview?mode=observed")


def payload(code="0", items=""):
    return (
        f"<serviceresult><msgheader><headercd>{code}</headercd>"
        f"<itemcount>{items.count('<itemlist>')}</itemcount></msgheader>"
        f"<msgbody>{items}</msgbody></serviceresult>"
    ).encode()


def test_observed_segment(observed, monkeypatch):
    row = (
        "<itemlist><linkid>test-link</linkid><routenm>시험 도로</routenm>"
        "<colldate>2021-06-25 09:44:00.0</colldate><spd>32</spd>"
        "<vol>41</vol></itemlist>"
    )
    def fetch(key, link_id):
        assert (key, link_id) == ("test-key", "test-link")
        return payload(items=row + row.replace("test-link", "elsewhere"))

    monkeypatch.setattr(traffic, "fetch_link_xml", fetch, raising=False)
    response = observed()
    assert response.status_code == 200
    result = response.json()
    assert result["dataStatus"] == "observed"
    segment, = result["intersections"]
    assert segment["averageSpeed"] == 32
    assert segment["position"] == [37.01, 127.27]
    assert segment["observedAt"] == "2021-06-25T09:44:00+09:00"
    assert segment["trafficVolume"] is None


@pytest.mark.parametrize(("body", "status"), [
    (payload("4"), 200), (payload("6"), 503), (b"bad xml", 502),
    (b"<unexpected/>", 502), (payload(items="<itemlist/>"), 502),
])
def test_provider_result(observed, monkeypatch, body, status):
    monkeypatch.setattr(traffic, "fetch_link_xml", lambda *_: body, raising=False)
    response = observed()
    assert response.status_code == status
    if status == 200:
        assert response.json()["intersections"] == []


def test_timeout(observed, monkeypatch):
    def timeout(*_):
        raise TimeoutError()
    monkeypatch.setattr(traffic, "fetch_link_xml", timeout, raising=False)
    assert observed().status_code == 503


def test_missing_key(observed, monkeypatch):
    monkeypatch.delenv("GITS_SERVICE_KEY")
    assert observed().status_code == 503


def test_switch_default_source_without_changing_url(observed, monkeypatch):
    monkeypatch.setenv("TRAFFIC_DATA_SOURCE", "observed")
    monkeypatch.setattr(traffic, "fetch_link_xml", lambda *_: payload("4"))
    client = TestClient(main.app)
    assert client.get("/traffic/overview").json()["dataStatus"] == "observed"
    assert client.get("/traffic/overview?mode=sample").json()["dataStatus"] == "sample"

import pytest
from fastapi.testclient import TestClient

import main


client = TestClient(main.app)
place = {"name": "안성시청", "position": [37.008, 127.279]}


@pytest.fixture(autouse=True)
def reset_places():
    main.places.clear()
    yield
    main.places.clear()


def test_register_read_and_delete_places():
    assert client.get("/places").json() == []
    response = client.post("/places", json=[place])
    assert response.status_code == 200
    assert response.json() == {"message": "장소 등록 성공", "places": [place]}
    assert client.get("/places").json() == [place]
    assert client.post("/places", json=[]).json()["places"] == [place]
    response = client.delete("/places")
    assert response.status_code == 200
    assert response.json() == {"message": "장소 삭제 성공", "places": []}
    assert client.get("/places").json() == []
    assert client.delete("/places").json()["places"] == []


@pytest.mark.parametrize("invalid", [
    {},
    {"position": [37, 127]},
    {"name": "안성시청"},
    {"name": "   ", "position": [37, 127]},
    {"name": 123, "position": [37, 127]},
    {"name": "안성시청", "position": [91, 127]},
    {"name": "안성시청", "position": [-91, 127]},
    {"name": "안성시청", "position": [37, 181]},
    {"name": "안성시청", "position": [37, -181]},
    {"name": "안성시청", "position": [37]},
    {"name": "안성시청", "position": [37, 127, 1]},
    {"name": "안성시청", "position": [True, 127]},
    {"name": "안성시청", "position": ["37", 127]},
    {"name": "안성시청", "position": [None, 127]},
    {"name": "안성시청", "position": [37, 127], "unexpected": "value"},
])
def test_invalid_batch_leaves_existing_places_unchanged(invalid):
    client.post("/places", json=[place])
    response = client.post("/places", json=[place, invalid])
    assert response.status_code == 422
    assert client.get("/places").json() == [place]


@pytest.mark.parametrize("payload", [None, {}, "invalid", [None]])
def test_rejects_non_place_array(payload):
    assert client.post("/places", json=payload).status_code == 422
    assert client.get("/places").json() == []


def test_trims_name_and_accepts_coordinate_boundaries():
    payload = [{"name": "  경계  ", "position": [-90, 180]},
               {"name": "경계2", "position": [90, -180]}]
    response = client.post("/places", json=payload)
    assert response.status_code == 200
    assert response.json()["places"] == [
        {"name": "경계", "position": [-90, 180]},
        {"name": "경계2", "position": [90, -180]},
    ]


def test_places_contract_is_in_openapi():
    schema = client.get("/openapi.json").json()
    item = schema["paths"]["/places"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["items"]
    assert item["$ref"].endswith("/Place")
    for method in ("get", "post", "delete"):
        assert "재시작" in schema["paths"]["/places"][method]["description"]

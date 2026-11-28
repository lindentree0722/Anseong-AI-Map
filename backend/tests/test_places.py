import sqlite3
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing

import pytest
from fastapi.testclient import TestClient

import main


place = {"name": "안성시청", "position": [37.008, 127.279]}


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "data" / "places.db"
    monkeypatch.setenv("ANSEONG_DB_PATH", str(path))
    return path


@pytest.fixture
def client(db_path):
    with TestClient(main.app) as test_client:
        yield test_client


def test_register_read_and_delete_places(client):
    assert client.get("/api/places").json() == []
    response = client.post("/api/places", json=[place])
    assert response.status_code == 200
    assert response.json() == {"message": "장소 등록 성공", "places": [place]}
    assert client.get("/api/places").json() == [place]
    assert client.post("/api/places", json=[]).json()["places"] == [place]
    response = client.delete("/api/places")
    assert response.status_code == 200
    assert response.json() == {"message": "장소 삭제 성공", "places": []}
    assert client.get("/api/places").json() == []
    assert client.delete("/api/places").json()["places"] == []


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
def test_invalid_batch_leaves_existing_places_unchanged(client, invalid):
    client.post("/api/places", json=[place])
    response = client.post("/api/places", json=[place, invalid])
    assert response.status_code == 422
    assert client.get("/api/places").json() == [place]


@pytest.mark.parametrize("payload", [None, {}, "invalid", [None]])
def test_rejects_non_place_array(client, payload):
    assert client.post("/api/places", json=payload).status_code == 422
    assert client.get("/api/places").json() == []


def test_trims_name_and_accepts_coordinate_boundaries(client):
    payload = [{"name": "  경계  ", "position": [-90, 180]},
               {"name": "경계2", "position": [90, -180]}]
    response = client.post("/api/places", json=payload)
    assert response.status_code == 200
    assert response.json()["places"] == [
        {"name": "경계", "position": [-90, 180]},
        {"name": "경계2", "position": [90, -180]},
    ]


def test_places_contract_is_in_openapi(client):
    schema = client.get("/api/openapi.json").json()
    item = schema["paths"]["/api/places"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["items"]
    assert item["$ref"].endswith("/Place")
    for method in ("get", "post", "delete"):
        assert "재시작" in schema["paths"]["/api/places"][method]["description"]


def test_places_are_committed_and_survive_app_restart(db_path):
    with TestClient(main.app) as client:
        assert client.post("/api/places", json=[place]).status_code == 200
    assert db_path.is_file()
    with closing(sqlite3.connect(db_path)) as connection:
        assert connection.execute("SELECT name, latitude, longitude FROM places").fetchall() == [
            ("안성시청", 37.008, 127.279),
        ]
    with TestClient(main.app) as client:
        assert client.get("/api/places").json() == [place]
        assert client.delete("/api/places").status_code == 200
    with TestClient(main.app) as client:
        assert client.get("/api/places").json() == []


def test_keeps_order_duplicates_and_sql_characters(client):
    quoted = {"name": "'); DROP TABLE places; --", "position": [0, 0]}
    payload = [quoted, place, quoted]
    assert client.post("/api/places", json=payload).json()["places"] == payload
    assert client.get("/api/places").json() == payload


def test_name_with_leading_null_keeps_existing_validation_contract(client):
    payload = [{"name": "\u0000example", "position": [0, 0]}]
    response = client.post("/api/places", json=payload)
    assert response.status_code == 200
    assert client.get("/api/places").json() == payload


def test_failed_insert_rolls_back_whole_batch(client, db_path):
    assert db_path.is_file()
    client.post("/api/places", json=[place])
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute("""
            CREATE TRIGGER reject_insert BEFORE INSERT ON places
            WHEN NEW.name = '실패'
            BEGIN SELECT RAISE(ABORT, 'private database error'); END
        """)
    response = client.post("/api/places", json=[place, {"name": "실패", "position": [0, 0]}])
    assert response.status_code == 503
    assert "private" not in response.text
    assert str(db_path) not in response.text
    assert client.get("/api/places").json() == [place]


@pytest.mark.parametrize("method", ["post", "delete"])
def test_locked_database_returns_503_without_changes(client, db_path, method):
    assert db_path.is_file()
    client.post("/api/places", json=[place])
    with closing(sqlite3.connect(db_path)) as connection:
        connection.execute("BEGIN EXCLUSIVE")
        response = client.request(method, "/api/places", **({"json": [place]} if method == "post" else {}))
        assert response.status_code == 503
        assert str(db_path) not in response.text
        connection.rollback()
    assert client.get("/api/places").json() == [place]


def test_unusable_database_path_fails_at_startup(tmp_path, monkeypatch):
    monkeypatch.setenv("ANSEONG_DB_PATH", str(tmp_path))
    with pytest.raises(sqlite3.OperationalError):
        with TestClient(main.app):
            pass


def test_database_constraints_reject_invalid_rows(client, db_path):
    assert db_path.is_file()
    with closing(sqlite3.connect(db_path)) as connection:
        for row in [(None, 0, 0), ("", 0, 0), ("x", None, 0), ("x", 91, 0), ("x", 0, -181)]:
            with pytest.raises(sqlite3.IntegrityError):
                connection.execute("INSERT INTO places(name, latitude, longitude) VALUES (?, ?, ?)", row)
            connection.rollback()
    assert client.get("/api/places").json() == []


@pytest.mark.parametrize("configured", [None, "custom/places.db"])
def test_database_path_does_not_depend_on_working_directory(tmp_path, monkeypatch, configured):
    backend_dir = tmp_path / "backend"
    monkeypatch.setattr(main.database, "BACKEND_DIR", backend_dir)
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("ANSEONG_DB_PATH", raising=False)
    if configured is not None:
        monkeypatch.setenv("ANSEONG_DB_PATH", configured)
    with TestClient(main.app) as client:
        assert client.get("/api/places").json() == []
    assert (backend_dir / (configured or "data/anseong-ai-map.db")).is_file()


def test_concurrent_batches_are_not_lost(client):
    payloads = [[{"name": f"장소 {i}", "position": [0, 0]}] for i in range(5)]
    with ThreadPoolExecutor(max_workers=5) as pool:
        responses = list(pool.map(lambda payload: client.post("/api/places", json=payload), payloads))
    assert all(response.status_code == 200 for response in responses)
    assert sorted(len(response.json()["places"]) for response in responses) == [1, 2, 3, 4, 5]
    assert sorted(item["name"] for item in client.get("/api/places").json()) == [f"장소 {i}" for i in range(5)]


def test_commit_failure_rolls_back_and_returns_503(client, db_path):
    client.post("/api/places", json=[place])
    with closing(sqlite3.connect(db_path)) as reader:
        reader.execute("BEGIN")
        reader.execute("SELECT * FROM places").fetchall()
        response = client.post("/api/places", json=[place])
        assert response.status_code == 503
        reader.rollback()
    assert client.get("/api/places").json() == [place]


def test_failed_delete_preserves_places(client, db_path):
    client.post("/api/places", json=[place, place])
    with closing(sqlite3.connect(db_path)) as connection, connection:
        connection.execute("""
            CREATE TRIGGER reject_delete BEFORE DELETE ON places
            WHEN OLD.id = 2
            BEGIN SELECT RAISE(ABORT, 'private delete error'); END
        """)
    response = client.delete("/api/places")
    assert response.status_code == 503
    assert "private" not in response.text
    assert client.get("/api/places").json() == [place, place]

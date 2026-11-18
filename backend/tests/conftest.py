from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.delenv("TRAFFIC_DATA_SOURCE", raising=False)
    with TestClient(app) as client:
        yield client

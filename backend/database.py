import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent


def database_path() -> Path:
    path = Path(os.environ.get("ANSEONG_DB_PATH", "data/anseong-ai-map.db"))
    return (BACKEND_DIR / path).resolve()


@contextmanager
def transaction(path: Path) -> Iterator[sqlite3.Connection]:
    with closing(sqlite3.connect(path, timeout=5, autocommit=False)) as connection:
        with connection:
            yield connection


def initialize(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with transaction(path) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS places (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL CHECK (trim(name) <> ''),
                latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
                longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180)
            )
        """)

import os
import socket
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path

import httpx


@contextmanager
def running_server(db_path):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    process = subprocess.Popen(
        [sys.executable, "-B", "-m", "uvicorn", "main:app", "--host", "127.0.0.1",
         "--port", str(port), "--log-level", "error"],
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ, "ANSEONG_DB_PATH": str(db_path)},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=1, trust_env=False) as client:
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise AssertionError(process.communicate()[0].decode(errors="replace"))
                try:
                    if client.get("/places").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                time.sleep(0.05)
            else:
                raise AssertionError("SQLite test server did not become ready")
            yield client
    finally:
        process.terminate()
        try:
            process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()


def test_places_survive_server_process_restart(tmp_path):
    db_path = tmp_path / "restart.db"
    place = {"name": "재시작 검증", "position": [37, 127]}
    with running_server(db_path) as client:
        assert client.get("/places").json() == []
        assert client.post("/places", json=[place]).status_code == 200
    with running_server(db_path) as client:
        assert client.get("/places").json() == [place]
        assert client.delete("/places").status_code == 200
    with running_server(db_path) as client:
        assert client.get("/places").json() == []

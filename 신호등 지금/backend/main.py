import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta
from typing import Any, Optional
from urllib.parse import urlencode
from urllib.request import urlopen
from xml.etree import ElementTree
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
DB_PATH = "/workspace/data/app.db"
DATA_API_URL = os.getenv("TRAFFIC_SIGNAL_API_URL", "")
DATA_API_KEY = os.getenv("TRAFFIC_SIGNAL_API_KEY", "")
COLUMNS = [
    "header", "resultCode", "resultMsg", "body", "totalCount", "pageNo", "numOfRows", "items", "item", "totDt", "stdgCd", "lclgvNm", "crsrdId", "regId", "regDt",
    "ntBssgRmndCs", "ntBcsgRmndCs", "ntLtsgRmndCs", "ntPdsgRmndCs", "ntStsgRmndCs", "ntUtsgRmndCs", "ntBssgSttsNm", "ntBcsgSttsNm", "ntLtsgSttsNm", "ntPdsgSttsNm", "ntStsgSttsNm", "ntUtsgSttsNm",
    "etBssgRmndCs", "etBcsgRmndCs", "etLtsgRmndCs", "etPdsgRmndCs", "etStsgRmndCs", "etUtsgRmndCs", "etBssgSttsNm", "etBcsgSttsNm", "etLtsgSttsNm", "etPdsgSttsNm", "etStsgSttsNm", "etUtsgSttsNm",
    "stBssgRmndCs", "stBcsgRmndCs", "stLtsgRmndCs", "stPdsgRmndCs", "stStsgRmndCs", "stUtsgRmndCs", "stBssgSttsNm", "stBcsgSttsNm", "stLtsgSttsNm", "stPdsgSttsNm", "stStsgSttsNm", "stUtsgSttsNm",
    "wtBssgRmndCs", "wtBcsgRmndCs", "wtLtsgRmndCs", "wtPdsgRmndCs", "wtStsgRmndCs", "wtUtsgRmndCs", "wtBssgSttsNm", "wtBcsgSttsNm", "wtLtsgSttsNm",
]
PLACES = [("서울특별시", "1100000000", "20035"), ("서울특별시", "1100000000", "20036"), ("서울특별시", "1100000000", "20037"), ("경기도 성남시", "4113500000", "31001"), ("경기도 수원시", "4111100000", "31002"), ("경기도 안성시", "4155000000", "41550"), ("인천광역시", "2800000000", "28001"), ("부산광역시", "2600000000", "26001"), ("부산광역시", "2600000000", "26002"), ("대구광역시", "2700000000", "27001"), ("광주광역시", "2900000000", "29001"), ("대전광역시", "3000000000", "30001"), ("울산광역시", "3100000000", "31001"), ("세종특별자치시", "3611000000", "36101"), ("강원특별자치도 춘천시", "5111000000", "51101"), ("충청북도 청주시", "4311100000", "43101"), ("전라북도 전주시", "4511100000", "45101")]
def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
def quote(column: str) -> str:
    return f'"{column}"'
def create_tables(conn: sqlite3.Connection):
    definitions = ", ".join(f"{quote(column)} TEXT" for column in COLUMNS)
    conn.execute(f"CREATE TABLE IF NOT EXISTS dfp_7582edcc ({definitions})")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS signal_overrides (
            signal_id INTEGER PRIMARY KEY,
            status TEXT NOT NULL CHECK(status IN ('green', 'yellow', 'red')),
            remaining_seconds INTEGER NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS signal_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signal_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            remaining_seconds INTEGER NOT NULL,
            recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    """)
def insert_row(conn: sqlite3.Connection, row: dict):
    column_sql = ", ".join(quote(column) for column in COLUMNS)
    placeholders = ", ".join("?" for _ in COLUMNS)
    conn.execute(f"INSERT INTO dfp_7582edcc ({column_sql}) VALUES ({placeholders})", [str(row.get(column, "")) for column in COLUMNS])
def seed_mock_data(conn: sqlite3.Connection):
    existing = {row["lclgvNm"] for row in conn.execute("SELECT DISTINCT lclgvNm FROM dfp_7582edcc").fetchall()}
    missing_places = [place for place in PLACES if place[0] not in existing]
    for index, (city, code, intersection_id) in enumerate(missing_places):
        allowed = "protected-Movement-Allowed" if index % 3 == 0 else "stop-And-Remain" if index % 3 == 1 else "caution-Conflicting-Traffic"
        row = {column: "" for column in COLUMNS}
        row.update({"header": "header", "resultCode": "K0", "resultMsg": "NORMAL_SERVICE", "body": "body", "totalCount": str(len(PLACES)), "pageNo": "1", "numOfRows": "20", "items": "items", "item": "신호제어기 신호잔여시간 정보", "totDt": f"2026-11-11 10:{4 + index:02d}:01.587", "stdgCd": code, "lclgvNm": city, "crsrdId": intersection_id, "regId": "v2x", "regDt": "2026-11-11"})
        for direction, offset in [("nt", 0), ("et", 120), ("st", 240), ("wt", 360)]:
            for movement, extra in [("Bssg", 80), ("Bcsg", 42), ("Ltsg", 16), ("Pdsg", 42), ("Stsg", 0), ("Utsg", 28)]: row[f"{direction}{movement}RmndCs"] = str(380 + index * 73 + offset + extra)
            for movement in ["Bssg", "Bcsg", "Ltsg", "Pdsg", "Stsg", "Utsg"]: row[f"{direction}{movement}SttsNm"] = allowed if movement in {"Bssg", "Bcsg", "Stsg"} else ("stop-And-Remain" if allowed != "stop-And-Remain" else "protected-Movement-Allowed")
        insert_row(conn, row)
def init_db():
    with closing(get_db()) as conn:
        create_tables(conn); seed_mock_data(conn); conn.commit()
def status_for(raw: str) -> str:
    value = (raw or "").lower()
    if "protected" in value or "allowed" in value: return "green"
    if "caution" in value or "yellow" in value: return "yellow"
    return "red"
def seconds_for(value: str) -> int:
    try: return max(0, int(float(value)) // 100)
    except (TypeError, ValueError): return 0
def to_signal(row: sqlite3.Row) -> dict:
    status, seconds, updated = status_for(row["ntStsgSttsNm"]), seconds_for(row["ntStsgRmndCs"]), row["totDt"]
    if row["override_status"]:
        status, seconds, updated = row["override_status"], int(row["override_seconds"]), row["override_updated"]
    return {"id": int(row["rowid"]), "name": f'{row["lclgvNm"]} · 교차로 {row["crsrdId"]}', "location": f'{row["lclgvNm"]} {row["item"]}', "status": status, "remaining_seconds": seconds, "updated_at": updated, "source": "전국 통합 신호제어기 실시간 데이터", "intersection_id": row["crsrdId"], "local_government": row["lclgvNm"]}
def extract_rows(payload: bytes) -> list[dict]:
    text = payload.decode("utf-8-sig")
    try:
        parsed = json.loads(text)
        candidates = parsed.get("response", parsed).get("body", parsed.get("body", {})).get("items", {}).get("item", [])
        return candidates if isinstance(candidates, list) else [candidates]
    except json.JSONDecodeError:
        root = ElementTree.fromstring(text)
        return [{child.tag: child.text or "" for child in item} for item in root.findall(".//item")]
def refresh_live_data():
    if not DATA_API_KEY or not DATA_API_URL:
        return False
    query = urlencode({"serviceKey": DATA_API_KEY, "pageNo": 1, "numOfRows": 100, "dataType": "JSON"})
    separator = "&" if "?" in DATA_API_URL else "?"
    try:
        with urlopen(f"{DATA_API_URL}{separator}{query}", timeout=12) as response:
            records = extract_rows(response.read())
    except Exception:
        return False
    valid = [record for record in records if isinstance(record, dict) and record.get("crsrdId")]
    if not valid:
        return False
    with closing(get_db()) as conn:
        create_tables(conn)
        conn.execute("DELETE FROM dfp_7582edcc")
        for record in valid:
            row = {column: record.get(column, "") for column in COLUMNS}
            row["item"] = row["item"] or "신호제어기 신호잔여시간 정보"
            insert_row(conn, row)
        conn.commit()
    return True
class SignalUpdate(BaseModel):
    status: str
    remaining_seconds: int
class LiveSignalSync(BaseModel):
    rows: list[dict[str, Any]]
    total: int = 0
app = FastAPI()
init_db()
@app.get("/api/health")
def health():
    return {"ok": True}
@app.post("/api/traffic-signals/sync")
def sync_traffic_signals(payload: LiveSignalSync):
    valid = [record for record in payload.rows if isinstance(record, dict) and record.get("crsrdId")]
    if not valid:
        raise HTTPException(status_code=400, detail="저장할 신호등 정보가 없습니다.")
    with closing(get_db()) as conn:
        create_tables(conn)
        conn.execute("DELETE FROM dfp_7582edcc")
        for record in valid:
            row = {column: record.get(column, "") for column in COLUMNS}
            row["item"] = row["item"] or "신호제어기 신호잔여시간 정보"
            insert_row(conn, row)
        conn.commit()
    return {"ok": True, "saved": len(valid), "total": payload.total or len(valid)}
@app.get("/api/traffic-signals")
def list_traffic_signals(q: str = "", status: Optional[str] = None, limit: int = 20, offset: int = 0):
    refresh_live_data()
    limit, offset, query = min(max(limit, 1), 100), max(offset, 0), q.strip()
    conditions, values = [], []
    if query:
        like = f"%{query}%"; conditions.append("(d.lclgvNm LIKE ? OR d.crsrdId LIKE ? OR d.item LIKE ?)"); values.extend([like, like, like])
    if status and status != "all":
        conditions.append("COALESCE(o.status, CASE WHEN lower(d.ntStsgSttsNm) LIKE '%protected%' OR lower(d.ntStsgSttsNm) LIKE '%allowed%' THEN 'green' WHEN lower(d.ntStsgSttsNm) LIKE '%caution%' OR lower(d.ntStsgSttsNm) LIKE '%yellow%' THEN 'yellow' ELSE 'red' END) = ?"); values.append(status)
    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"SELECT d.rowid, d.*, o.status AS override_status, o.remaining_seconds AS override_seconds, o.updated_at AS override_updated FROM dfp_7582edcc d LEFT JOIN signal_overrides o ON o.signal_id = d.rowid{where} ORDER BY d.totDt DESC, d.crsrdId ASC LIMIT ? OFFSET ?"
    with closing(get_db()) as conn:
        total = conn.execute(f"SELECT COUNT(*) AS count FROM dfp_7582edcc d LEFT JOIN signal_overrides o ON o.signal_id = d.rowid{where}", values).fetchone()["count"]
        rows = conn.execute(sql, [*values, limit, offset]).fetchall()
    return {"items": [to_signal(row) for row in rows], "total": total, "limit": limit, "offset": offset, "source": "live" if DATA_API_KEY else "mock"}
@app.get("/api/traffic-signals/{signal_id}")
def get_traffic_signal(signal_id: int):
    with closing(get_db()) as conn:
        row = conn.execute("SELECT d.rowid, d.*, o.status AS override_status, o.remaining_seconds AS override_seconds, o.updated_at AS override_updated FROM dfp_7582edcc d LEFT JOIN signal_overrides o ON o.signal_id = d.rowid WHERE d.rowid = ?", (signal_id,)).fetchone()
        history = conn.execute("SELECT id, status, remaining_seconds, recorded_at FROM signal_history WHERE signal_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 8", (signal_id,)).fetchall()
    if not row: raise HTTPException(status_code=404, detail="신호등 정보를 찾을 수 없습니다.")
    if not history:
        history = [{"id": index + 1, "status": status_for(row[f"{direction}StsgSttsNm"]), "remaining_seconds": seconds_for(row[f"{direction}StsgRmndCs"]), "recorded_at": row["totDt"], "label": label} for index, (direction, label) in enumerate([("nt", "북쪽 직진"), ("et", "동쪽 직진"), ("st", "남쪽 직진"), ("wt", "서쪽 직진")])]
    return {"signal": to_signal(row), "history": [dict(item) for item in history]}
@app.put("/api/signals/{signal_id}")
def update_signal(signal_id: int, update: SignalUpdate):
    if update.status not in {"green", "yellow", "red"} or update.remaining_seconds < 0: raise HTTPException(status_code=400, detail="올바른 신호 상태와 시간을 입력해 주세요.")
    with closing(get_db()) as conn:
        if not conn.execute("SELECT rowid FROM dfp_7582edcc WHERE rowid = ?", (signal_id,)).fetchone(): raise HTTPException(status_code=404, detail="신호등 정보를 찾을 수 없습니다.")
        conn.execute("INSERT INTO signal_overrides (signal_id, status, remaining_seconds, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(signal_id) DO UPDATE SET status = excluded.status, remaining_seconds = excluded.remaining_seconds, updated_at = CURRENT_TIMESTAMP", (signal_id, update.status, update.remaining_seconds))
        conn.execute("INSERT INTO signal_history (signal_id, status, remaining_seconds) VALUES (?, ?, ?)", (signal_id, update.status, update.remaining_seconds))
        conn.commit()
    return {"ok": True}
@app.get("/api/signals")
def search_signals(q: str = "", status: Optional[str] = None, limit: int = 20, offset: int = 0):
    return list_traffic_signals(q, status, limit, offset)
@app.get("/api/signals/{signal_id}")
def get_signal(signal_id: int):
    return get_traffic_signal(signal_id)

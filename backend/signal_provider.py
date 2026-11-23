import asyncio
import json
import logging
import math
import sqlite3
from collections.abc import Callable
from contextlib import closing
from datetime import UTC, datetime, timedelta, timezone
from http.client import HTTPException as HTTPTransportError
from time import monotonic
from urllib.parse import urlencode
from urllib.request import urlopen
from xml.etree import ElementTree

BASE_URL = "https://apis.data.go.kr/B551982/rti"
ANSEONG_CODE = "4155000000"
SOURCE = "행정안전부 한국지역정보개발원 교통안전 신호등 정보"
KST = timezone(timedelta(hours=9))
DIRECTIONS = (
    ("nt", "북쪽"),
    ("et", "동쪽"),
    ("st", "남쪽"),
    ("wt", "서쪽"),
    ("ne", "북동쪽"),
    ("se", "남동쪽"),
    ("sw", "남서쪽"),
    ("nw", "북서쪽"),
)
STATUSES = {
    "protected-movement-allowed": "green",
    "permissive-movement-allowed": "green",
    "protected-clearance": "yellow",
    "permissive-clearance": "yellow",
    "caution-conflicting-traffic": "yellow",
    "stop-and-remain": "red",
    "stop-then-proceed": "red",
}
log = logging.getLogger(__name__)


def parse_page(payload: bytes) -> tuple[list[dict], int | None]:
    try:
        parsed = json.loads(payload.decode("utf-8-sig"))
    except json.JSONDecodeError:
        root = ElementTree.fromstring(payload)
        code = root.findtext("./header/resultCode")
        body = root.find("body")
        if body is None:
            raise ValueError("invalid signal API body")
        rows = [
            {child.tag: child.text or "" for child in item}
            for item in body.findall("./items/item")
        ]
        total = body.findtext("totalCount")
    else:
        if not isinstance(parsed, dict):
            raise ValueError("invalid signal API response")
        response = parsed.get("response", parsed)
        if not isinstance(response, dict):
            raise ValueError("invalid signal API response")
        header, body = response.get("header"), response.get("body")
        if not isinstance(header, dict) or not isinstance(body, dict):
            raise ValueError("invalid signal API envelope")
        code = header.get("resultCode")
        items = body.get("items")
        rows = items.get("item") if isinstance(items, dict) else items
        if isinstance(rows, dict):
            rows = [rows]
        if rows is None or rows == "":
            rows = []
        total = body.get("totalCount")
    if str(code) not in {"00", "0", "K0"} or not isinstance(rows, list):
        raise ValueError("signal API reported an error")
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError("invalid signal API item")
    count = int(str(total)) if total is not None else None
    if count is not None and count < 0:
        raise ValueError("invalid signal API count")
    return rows, count


def fetch_rows(operation: str, key: str) -> list[dict]:
    rows = []
    for page in range(1, 6):
        query = urlencode(
            {
                "serviceKey": key,
                "stdgCd": ANSEONG_CODE,
                "type": "JSON",
                "pageNo": page,
                "numOfRows": 100,
            }
        )
        with urlopen(f"{BASE_URL}/{operation}?{query}", timeout=5) as response:
            batch, total = parse_page(response.read(2_000_000))
        if total is not None and total > 500:
            break
        rows.extend(batch)
        if total is not None:
            if len(rows) == total:
                return rows
            if len(rows) > total or not batch:
                break
        elif len(batch) < 100:
            return rows
    raise ValueError("incomplete signal API response")


def region_id(row: dict) -> str:
    code = str(row.get("stdgCd") or "").strip()
    if len(code) != 10 or not code.isdecimal() or not code.startswith("41550"):
        return ""
    return str(row.get("crsrdId") or "").strip()


def observed_at(value: object) -> datetime:
    text = str(value or "").strip()
    if len(text) == 14 and text.isdecimal():
        timestamp = datetime.strptime(text, "%Y%m%d%H%M%S")
    else:
        timestamp = datetime.fromisoformat(text)
    return (
        timestamp if timestamp.tzinfo else timestamp.replace(tzinfo=KST)
    ).astimezone(UTC)


def remaining_seconds(value: object) -> int | None:
    try:
        centiseconds = int(str(value).strip())
    except ValueError:
        return None
    return centiseconds // 100 if centiseconds >= 0 else None


def straight_signals(row: dict, timestamp: str) -> list[dict]:
    result = []
    for index, (prefix, label) in enumerate(DIRECTIONS, start=1):
        status = STATUSES.get(
            str(row.get(f"{prefix}StsgSttsNm", "")).strip().lower(), "unknown"
        )
        seconds = remaining_seconds(row.get(f"{prefix}StsgRmndCs"))
        if status != "unknown" or seconds is not None:
            result.append(
                {
                    "id": index,
                    "label": f"{label} 직진",
                    "status": status,
                    "remaining_seconds": seconds,
                    "recorded_at": timestamp,
                }
            )
    return result


def map_info(row: dict) -> tuple[str | None, float | None, float | None]:
    name = str(row.get("crsrdNm") or "").strip() or None
    try:
        latitude = float(row.get("mapCtptIntLat"))
        longitude = float(row.get("mapCtptIntLot"))
    except (TypeError, ValueError, OverflowError):
        return name, None, None
    if not (
        math.isfinite(latitude)
        and math.isfinite(longitude)
        and 0 < latitude <= 90
        and 0 < longitude <= 180
    ):
        return name, None, None
    return name, latitude, longitude


class SignalFeed:
    def __init__(self, key: str, connect: Callable[[], sqlite3.Connection]) -> None:
        self.key = key
        self.connect = connect
        self.maps: dict[str, tuple[str | None, float | None, float | None]] = {}
        self.map_due = 0.0
        self.message: str | None = "첫 관측값을 불러오는 중입니다."

    async def poll(self) -> None:
        while True:
            started = monotonic()
            await asyncio.to_thread(self.refresh)
            await asyncio.sleep(max(0, 120 - (monotonic() - started)))

    def refresh(self) -> None:
        if monotonic() >= self.map_due:
            self.map_due = monotonic() + 3600
            try:
                self.maps.update(
                    {
                        identifier: map_info(row)
                        for row in fetch_rows("crsrd_map_info", self.key)
                        if (identifier := region_id(row))
                    }
                )
            except (
                OSError,
                HTTPTransportError,
                ValueError,
                TypeError,
                ElementTree.ParseError,
            ):
                log.warning("신호 제공기관의 교차로 위치를 갱신하지 못했습니다.")

        try:
            newest = {}
            now = datetime.now(UTC)
            for row in fetch_rows("tl_drct_info", self.key):
                identifier = region_id(row)
                if not identifier:
                    continue
                try:
                    timestamp = observed_at(row.get("totDt"))
                except (ValueError, OverflowError):
                    continue
                if timestamp > now + timedelta(minutes=1):
                    continue
                encoded = timestamp.isoformat()
                directions = straight_signals(row, encoded)
                if directions and (
                    identifier not in newest or newest[identifier][0] < encoded
                ):
                    newest[identifier] = (encoded, directions)
            if not newest:
                self.message = "제공기관에서 안성시 신호 관측값을 받지 못했습니다."
                return
            self.save(newest)
        except (
            OSError,
            HTTPTransportError,
            ValueError,
            TypeError,
            ElementTree.ParseError,
            sqlite3.Error,
        ):
            self.message = "신호 관측을 갱신하지 못했습니다."
            log.warning("안성시 신호 관측 갱신에 실패했습니다.")
        else:
            self.message = None

    def save(self, observations: dict) -> None:
        with closing(self.connect()) as conn, conn:
            conn.execute("UPDATE provider_signals SET active = 0 WHERE active = 1")
            conn.executemany(
                """
                INSERT INTO provider_signals
                    (intersection_id, observed_at, directions, name, latitude, longitude, active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                ON CONFLICT(intersection_id) DO UPDATE SET
                    active = 1,
                    observed_at = max(provider_signals.observed_at, excluded.observed_at),
                    directions = CASE WHEN excluded.observed_at >= provider_signals.observed_at
                        THEN excluded.directions ELSE provider_signals.directions END,
                    name = coalesce(excluded.name, provider_signals.name),
                    latitude = coalesce(excluded.latitude, provider_signals.latitude),
                    longitude = coalesce(excluded.longitude, provider_signals.longitude)
            """,
                [
                    (
                        identifier,
                        timestamp,
                        json.dumps(directions, ensure_ascii=False),
                        *self.maps.get(identifier, (None, None, None)),
                    )
                    for identifier, (timestamp, directions) in observations.items()
                ],
            )

    def lookup(self, signal_id: int | None = None) -> list[dict]:
        with closing(self.connect()) as conn:
            if signal_id is None:
                rows = conn.execute("""
                    SELECT * FROM provider_signals WHERE active = 1
                    ORDER BY observed_at DESC, intersection_id
                """).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM provider_signals WHERE active = 1 AND id = ?",
                    (-signal_id,),
                ).fetchall()
        now = datetime.now(UTC)
        stale = self.message is not None
        return [self.to_detail(row, now, stale) for row in rows]

    @staticmethod
    def to_detail(row: sqlite3.Row, now: datetime, stale: bool) -> dict:
        directions = json.loads(row["directions"])
        primary = next(
            (direction for direction in directions if direction["status"] != "unknown"),
            directions[0],
        )
        old = stale or now - observed_at(row["observed_at"]) > timedelta(minutes=5)
        return {
            "signal": {
                # Positive IDs belong to local seed data and manual snapshots.
                "id": -row["id"],
                "intersection_id": row["intersection_id"],
                "name": row["name"] or f"교차로 {row['intersection_id']}",
                "location": "경기도 안성시",
                "local_government": "경기도 안성시",
                "status": primary["status"],
                "remaining_seconds": primary["remaining_seconds"],
                "movement_label": primary["label"],
                "updated_at": row["observed_at"],
                "source": SOURCE,
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "observation_status": "stale" if old else "fresh",
            },
            "history": directions,
        }

import os
from datetime import datetime, timedelta, timezone
from http.client import HTTPException as HTTPClientError, HTTPSConnection
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlencode
from xml.etree import ElementTree

from pydantic import AwareDatetime, BaseModel, Field, TypeAdapter, computed_field, model_validator


Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
Position = tuple[Latitude, Longitude]
NonnegativeNumber = Annotated[float, Field(ge=0, allow_inf_nan=False)]
TrafficMode = Literal["sample", "observed"]

SAMPLE_PATH = Path(__file__).resolve().parent / "data" / "traffic-sample.json"
POSITION_ADAPTER = TypeAdapter(Position)
KST = timezone(timedelta(hours=9))
MAX_XML_BYTES = 1024 * 1024
CONGESTED_THRESHOLD = 75


class SignalDiagnosis(BaseModel):
    level: str
    findings: list[str]
    actions: list[str]


class TrafficSegment(BaseModel):
    id: str
    sourceId: str
    name: str
    area: str
    position: Position
    observedAt: AwareDatetime
    trafficVolume: Annotated[int, Field(ge=0)] | None = None
    trafficVolumeUnit: Literal["vehicles/interval", "vehicles/hour"] | None = None
    aggregationIntervalSeconds: Annotated[int, Field(gt=0)] | None = None
    averageSpeed: NonnegativeNumber | None = None
    averageWait: NonnegativeNumber | None = None
    congestion: Annotated[int, Field(ge=0, le=100)] | None = None
    greenRatio: Annotated[float, Field(ge=0, le=1)] | None = None
    directions: None = None

    @computed_field
    @property
    def status(self) -> str | None:
        if self.congestion is None:
            return None
        if self.congestion >= CONGESTED_THRESHOLD:
            return "혼잡"
        return "주의" if self.congestion >= 50 else "원활"

    @computed_field
    @property
    def diagnosis(self) -> SignalDiagnosis:
        findings = []
        actions = []
        status = self.status
        slow_speed = self.averageSpeed is not None and self.averageSpeed <= 20
        if status == "혼잡":
            findings.append(f"혼잡도 {self.congestion}점으로 검토 기준인 {CONGESTED_THRESHOLD}점 이상입니다.")
            actions.append("진입 방향별 교통량과 대기행렬을 비교하세요.")
        if self.averageWait is not None and self.averageWait >= 60:
            findings.append(f"평균 대기시간 {self.averageWait:g}초가 검토 기준인 60초 이상입니다.")
            actions.append("혼잡 시간대의 신호 주기와 방향별 대기시간을 함께 확인하세요.")
        if self.greenRatio is not None and self.greenRatio <= 0.38:
            findings.append(f"녹색 신호 비율이 {self.greenRatio:.0%}로 검토 기준인 38% 이하입니다.")
            actions.append("방향별 수요와 보행 시간을 고려해 녹색시간 배분을 검토하세요.")

        if findings:
            level = "개선 검토 필요"
        elif None in (self.congestion, self.averageWait, self.greenRatio):
            level = "자료 부족"
            findings.append("혼잡도·평균 대기시간·녹색 신호 비율 중 누락된 지표가 있습니다.")
            actions.append("같은 시간대의 누락된 지표를 수집한 뒤 다시 진단하세요.")
        elif status == "주의" or slow_speed:
            level = "관찰 필요"
            findings.append("혼잡도 또는 통행속도가 관찰 범위에 있습니다.")
            actions.append("인접 시간대의 지표와 비교하세요.")
        else:
            level = "양호"
            findings.append("확인된 지표가 개선 검토 기준에 해당하지 않습니다.")
            actions.append("출퇴근 시간대에도 같은 경향이 유지되는지 확인하세요.")
        if slow_speed:
            findings.append(f"평균 통행속도가 {self.averageSpeed:g}km/h로 20km/h 이하입니다.")
        return SignalDiagnosis(level=level, findings=findings, actions=actions)

    @model_validator(mode="after")
    def validate_volume_metadata(self) -> "TrafficSegment":
        if self.trafficVolume is not None and (
            self.trafficVolumeUnit is None or self.aggregationIntervalSeconds is None
        ):
            raise ValueError("Traffic volume requires a unit and an aggregation interval")
        return self


class HourlyTraffic(BaseModel):
    time: str
    volume: NonnegativeNumber | None
    wait: NonnegativeNumber | None


class RoadSegment(BaseModel):
    id: str
    sourceId: str
    name: str
    positions: list[Position]
    observedAt: AwareDatetime | None = None
    averageSpeed: NonnegativeNumber | None = None
    congestion: Annotated[int, Field(ge=0, le=100)] | None = None


def _rounded_average(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 1) if values else None


class TrafficOverview(BaseModel):
    source: str
    dataStatus: TrafficMode
    generatedAt: AwareDatetime
    intersections: list[TrafficSegment]
    hourlyTraffic: list[HourlyTraffic] | None = None
    roadSegments: list[RoadSegment] | None = None

    @computed_field
    @property
    def summary(self) -> dict[str, int | float | None]:
        waits: list[float] = []
        speeds: list[float] = []
        congested = 0
        has_congestion_data = False
        for row in self.intersections:
            if (wait := row.averageWait) is not None:
                waits.append(wait)
            if (speed := row.averageSpeed) is not None:
                speeds.append(speed)
            if (score := row.congestion) is not None:
                has_congestion_data = True
                if score >= CONGESTED_THRESHOLD:
                    congested += 1

        return {
            "count": len(self.intersections),
            "congested": congested if has_congestion_data else None,
            "averageWait": _rounded_average(waits),
            "averageSpeed": _rounded_average(speeds),
        }


def load_traffic_overview(mode: TrafficMode | None = None) -> TrafficOverview:
    source = mode or os.getenv("TRAFFIC_DATA_SOURCE", "sample")
    if source == "observed":
        return load_observed_overview()
    if source != "sample":
        raise OSError("Invalid TRAFFIC_DATA_SOURCE")
    try:
        overview = TrafficOverview.model_validate_json(SAMPLE_PATH.read_bytes())
    except ValueError as exc:
        raise OSError("Invalid sample data") from exc
    if overview.dataStatus != "sample":
        raise OSError("Expected sample data")
    return overview


def fetch_link_xml(key: str, link_id: str) -> bytes:
    query = urlencode({"serviceKey": key, "linkId": link_id})
    connection = HTTPSConnection("openapigits.gg.go.kr", timeout=5)
    try:
        connection.request("GET", "/api/rest/getRoadLinkTrafficInfo?" + query)
        response = connection.getresponse()
        if response.status != 200:
            raise OSError("Traffic provider unavailable")
        body = response.read(MAX_XML_BYTES + 1)
        if len(body) > MAX_XML_BYTES:
            raise ValueError("Unexpected response size")
        return body
    except HTTPClientError as exc:
        raise OSError("Traffic request failed") from exc
    finally:
        connection.close()


def load_observed_overview() -> TrafficOverview:
    try:
        key = os.environ["GITS_SERVICE_KEY"].strip()
        link_id = os.environ["ANSEONG_LINK_ID"].strip()
        position = POSITION_ADAPTER.validate_python(os.environ["ANSEONG_LINK_POSITION"].split(","))
        if not key or not link_id:
            raise ValueError("Empty configuration")
    except (KeyError, ValueError) as exc:
        raise OSError("Missing or invalid traffic configuration") from exc

    segments = _parse_link_segments(fetch_link_xml(key, link_id), link_id, position)
    return TrafficOverview(
        source="경기도교통정보센터",
        dataStatus="observed",
        generatedAt=datetime.now(KST),
        intersections=segments,
    )


def _parse_link_segments(body: bytes, link_id: str, position: Position) -> list[TrafficSegment]:
    root = ElementTree.fromstring(body)
    for element in root.iter():
        element.tag = element.tag.lower()
    code = root.findtext("msgheader/headercd", "").strip()
    if not code.isdigit():
        raise ValueError("Missing provider status")
    if code == "4":
        return []
    if code != "0":
        raise OSError("Traffic provider rejected request")

    rows = root.findall("msgbody/itemlist")
    if len(rows) != int(root.findtext("msgheader/itemcount", "")):
        raise ValueError("Unexpected row count")

    segments = []
    for row in rows:
        row_id = row.findtext("linkid", "").strip()
        if not row_id:
            raise ValueError("Missing link ID")
        if row_id != link_id:
            continue
        observed_at = datetime.fromisoformat(row.findtext("colldate", "").strip())
        if observed_at.tzinfo is None:
            observed_at = observed_at.replace(tzinfo=KST)
        segments.append(TrafficSegment(
            id=row_id,
            sourceId=row_id,
            name=row.findtext("routenm") or row_id,
            area="안성시",
            position=position,
            observedAt=observed_at.astimezone(KST),
            averageSpeed=row.findtext("spd", "").strip() or None,
        ))
    return segments

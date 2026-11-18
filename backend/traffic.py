import os
from datetime import datetime, timedelta, timezone
from http.client import HTTPException as HTTPClientError, HTTPSConnection
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlencode
from xml.etree import ElementTree

from pydantic import AwareDatetime, BaseModel, Field, TypeAdapter, model_validator


Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
NonnegativeNumber = Annotated[float, Field(ge=0, allow_inf_nan=False)]
TrafficMode = Literal["sample", "observed"]
SAMPLE_PATH = Path(__file__).resolve().parent / "data" / "traffic-sample.json"


class TrafficSegment(BaseModel):
    id: str
    sourceId: str
    name: str
    area: str
    position: tuple[Latitude, Longitude]
    observedAt: AwareDatetime
    trafficVolume: Annotated[int, Field(ge=0)] | None = None
    trafficVolumeUnit: Literal["vehicles/interval", "vehicles/hour"] | None = None
    aggregationIntervalSeconds: Annotated[int, Field(gt=0)] | None = None
    averageSpeed: NonnegativeNumber | None = None
    averageWait: NonnegativeNumber | None = None
    congestion: None = None
    status: None = None
    greenRatio: None = None
    directions: None = None

    @model_validator(mode="after")
    def validate_volume_metadata(self) -> "TrafficSegment":
        if self.trafficVolume is not None and (
            self.trafficVolumeUnit is None or self.aggregationIntervalSeconds is None
        ):
            raise ValueError("Traffic volume requires a unit and an aggregation interval")
        return self


class TrafficOverview(BaseModel):
    source: str
    dataStatus: TrafficMode
    generatedAt: AwareDatetime
    intersections: list[TrafficSegment]
    hourlyTraffic: None = None
    summary: None = None


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
        body = response.read(1024 * 1024 + 1)
        if len(body) > 1024 * 1024:
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
        position = TypeAdapter(tuple[Latitude, Longitude]).validate_python(
            os.environ["ANSEONG_LINK_POSITION"].split(",")
        )
        if not key or not link_id:
            raise ValueError("Empty configuration")
    except (KeyError, ValueError) as exc:
        raise OSError("Missing or invalid traffic configuration") from exc

    root = ElementTree.fromstring(fetch_link_xml(key, link_id))
    for element in root.iter():
        element.tag = element.tag.lower()
    code = root.findtext("msgheader/headercd", "").strip()
    if not code.isdigit():
        raise ValueError("Missing provider status")
    if code not in {"0", "4"}:
        raise OSError("Traffic provider rejected request")
    segments = []
    kst = timezone(timedelta(hours=9))
    if code == "0":
        rows = root.findall("msgbody/itemlist")
        if len(rows) != int(root.findtext("msgheader/itemcount", "")):
            raise ValueError("Unexpected row count")
        for row in rows:
            row_id = row.findtext("linkid", "").strip()
            if not row_id:
                raise ValueError("Missing link ID")
            if row_id != link_id:
                continue
            observed_at = datetime.fromisoformat(row.findtext("colldate", "").strip())
            if observed_at.tzinfo is None:
                observed_at = observed_at.replace(tzinfo=kst)
            segments.append(TrafficSegment(
                id=row_id, sourceId=row_id, name=row.findtext("routenm") or row_id,
                area="안성시", position=position, observedAt=observed_at.astimezone(kst),
                averageSpeed=row.findtext("spd", "").strip() or None,
            ))
    return TrafficOverview(
        source="경기도교통정보센터", dataStatus="observed",
        generatedAt=datetime.now(kst), intersections=segments,
    )

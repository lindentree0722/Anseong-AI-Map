from pathlib import Path
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, Field, model_validator


Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
NonnegativeNumber = Annotated[float, Field(ge=0, allow_inf_nan=False)]


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
    dataStatus: Literal["sample"]
    generatedAt: AwareDatetime
    intersections: list[TrafficSegment]
    hourlyTraffic: None = None
    summary: None = None


def load_traffic_overview(path: Path) -> TrafficOverview:
    return TrafficOverview.model_validate_json(path.read_bytes())

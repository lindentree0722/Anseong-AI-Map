import os
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from math import cos, hypot, radians
from pathlib import Path
from statistics import mean
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import AwareDatetime, BaseModel, Field, ValidationError, model_validator

if __package__:
    from .traffic import Latitude, Longitude, NonnegativeNumber
    from .vacancies import BACKEND_DIR, Vacancy, get_vacancies
else:
    from traffic import Latitude, Longitude, NonnegativeNumber
    from vacancies import BACKEND_DIR, Vacancy, get_vacancies


router = APIRouter()
KST = timezone(timedelta(hours=9))
METERS_PER_DEGREE = 111_195

# Hours are local and half-open. Facility types match the source file.
CATEGORY_PROFILES = {
    "CAFE": ((7, 17), {"bus_stop", "library", "park"}),
    "FOOD": ((11, 21), {"bus_stop", "park"}),
    "RETAIL": ((12, 21), {"bus_stop", "school"}),
    "LIFE": ((9, 20), {"bus_stop", "library"}),
    "HEALTH": ((9, 18), {"bus_stop"}),
    "EDU": ((15, 21), {"school", "library"}),
}


class Point(BaseModel):
    lat: Latitude
    lng: Longitude


class Store(Point):
    id: str
    name: str
    category_code: str = Field(min_length=1)
    category_name: str = Field(min_length=1)


class Facility(Point):
    id: str
    name: str
    type: str


class NearbyFacility(Facility):
    distance_m: float


class RoadNode(Point):
    id: str
    name: str


class RoadLink(BaseModel):
    id: str
    from_node_id: str
    to_node_id: str


class TrafficObservation(BaseModel):
    link_id: str
    observed_at: AwareDatetime
    average_speed_kmh: NonnegativeNumber


class PedestrianObservation(BaseModel):
    node_id: str
    window_start: AwareDatetime
    window_end: AwareDatetime
    pedestrian_count: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_window(self) -> PedestrianObservation:
        if self.window_end <= self.window_start:
            raise ValueError("window_end must follow window_start")
        return self


class Source(BaseModel):
    source: str = Field(min_length=1)
    reference_date: date
    data_status: Literal["sample", "reported"]


class Rows[Row: BaseModel](Source):
    items: list[Row]


class RoadNetwork(Source):
    nodes: list[RoadNode]
    links: list[RoadLink]


class AnalysisInputs(BaseModel):
    stores: Rows[Store]
    facilities: Rows[Facility]
    road_network: RoadNetwork
    road_traffic: Rows[TrafficObservation]
    pedestrians: Rows[PedestrianObservation]

    @model_validator(mode="after")
    def validate_references(self) -> AnalysisInputs:
        node_ids = {node.id for node in self.road_network.nodes}
        link_ids = {link.id for link in self.road_network.links}
        if (
            len(node_ids) != len(self.road_network.nodes)
            or len(link_ids) != len(self.road_network.links)
            or any(link.from_node_id not in node_ids or link.to_node_id not in node_ids
                   for link in self.road_network.links)
            or any(row.link_id not in link_ids for row in self.road_traffic.items)
            or any(row.node_id not in node_ids for row in self.pedestrians.items)
        ):
            raise ValueError("inconsistent road network references")
        return self


class CategorySupply(BaseModel):
    category_code: str
    category_name: str
    nearby_store_count: int
    nearby_share: float
    dataset_share: float


class PedestrianContext(BaseModel):
    node_id: str
    node_name: str
    distance_m: float
    observations: list[PedestrianObservation]


class SpeedSummary(BaseModel):
    observed_hour: datetime
    average_speed_kmh: float
    observation_count: int


class RoadContext(BaseModel):
    nearest_link_id: str
    nearest_link_distance_m: float
    nearby_link_count: int
    speed_by_hour: list[SpeedSummary]


class Recommendation(CategorySupply):
    score: float
    supply_gap_score: float
    pedestrian_fit_score: float | None
    facility_fit_score: float | None
    road_access_score: float | None
    matching_facility_count: int | None


class Prescription(BaseModel):
    vacancy: Vacancy
    vacancy_source: str
    vacancy_data_status: Literal["sample", "reported"]
    data_status: Literal["sample", "mixed", "reported"]
    sources: dict[str, Source]
    radius_m: int
    nearby_store_count: int
    nearby_stores: list[Store]
    category_supply: list[CategorySupply]
    facilities: list[NearbyFacility]
    pedestrians: PedestrianContext | None
    road_access: RoadContext | None
    signal_average_wait_seconds: None = None
    status: Literal["ready", "insufficient_store_data"]
    recommendations: list[Recommendation]


def load_inputs() -> AnalysisInputs:
    configured_dir = os.getenv("ANSEONG_PRESCRIPTION_DATA_DIR", "").strip()
    directory = BACKEND_DIR / (configured_dir or "data")
    suffix = ".json" if configured_dir else "-sample.json"
    return AnalysisInputs(
        stores=Rows[Store].model_validate_json((directory / f"stores{suffix}").read_bytes()),
        facilities=Rows[Facility].model_validate_json((directory / f"facilities{suffix}").read_bytes()),
        road_network=RoadNetwork.model_validate_json((directory / f"road-network{suffix}").read_bytes()),
        road_traffic=Rows[TrafficObservation].model_validate_json(
            (directory / f"traffic-observations{suffix}").read_bytes()
        ),
        pedestrians=Rows[PedestrianObservation].model_validate_json(
            (directory / f"foot-traffic{suffix}").read_bytes()
        ),
    )


def offset_m(center: Vacancy, point: Point) -> tuple[float, float]:
    longitude_delta = (point.lng - center.lng + 180) % 360 - 180
    return (
        longitude_delta * METERS_PER_DEGREE * cos(radians(center.lat)),
        (point.lat - center.lat) * METERS_PER_DEGREE,
    )


def link_distance_m(center: Vacancy, start: RoadNode, end: RoadNode) -> float:
    x, y = offset_m(center, start)
    end_x, end_y = offset_m(center, end)
    dx, dy = end_x - x, end_y - y
    length_squared = dx * dx + dy * dy
    if not length_squared:
        return hypot(x, y)
    fraction = min(1, max(0, -(x * dx + y * dy) / length_squared))
    return hypot(x + fraction * dx, y + fraction * dy)


def pedestrian_context(inputs: AnalysisInputs, distances: dict[str, float]) -> PedestrianContext | None:
    observed_nodes = {row.node_id for row in inputs.pedestrians.items}
    nearest = min(observed_nodes & distances.keys(), key=lambda node: (distances[node], node), default=None)
    if nearest is None:
        return None
    node = next(node for node in inputs.road_network.nodes if node.id == nearest)
    return PedestrianContext(
        node_id=node.id,
        node_name=node.name,
        distance_m=round(distances[node.id], 1),
        observations=sorted(
            (row for row in inputs.pedestrians.items if row.node_id == node.id),
            key=lambda row: row.window_start,
        ),
    )


def road_context(inputs: AnalysisInputs, vacancy: Vacancy, radius: int) -> RoadContext | None:
    nodes = {node.id: node for node in inputs.road_network.nodes}
    distances = {
        link.id: link_distance_m(vacancy, nodes[link.from_node_id], nodes[link.to_node_id])
        for link in inputs.road_network.links
    }
    nearby = {link_id for link_id, distance in distances.items() if distance <= radius}
    if not nearby:
        return None
    nearest = min(nearby, key=lambda link_id: (distances[link_id], link_id))
    speeds: dict[datetime, list[float]] = defaultdict(list)
    for row in inputs.road_traffic.items:
        if row.link_id in nearby:
            hour = row.observed_at.astimezone(KST).replace(minute=0, second=0, microsecond=0)
            speeds[hour].append(row.average_speed_kmh)
    return RoadContext(
        nearest_link_id=nearest,
        nearest_link_distance_m=round(distances[nearest], 1),
        nearby_link_count=len(nearby),
        speed_by_hour=[
            SpeedSummary(observed_hour=hour, average_speed_kmh=round(mean(values), 1),
                         observation_count=len(values))
            for hour, values in sorted(speeds.items())
        ],
    )


def pedestrian_fit(pedestrians: PedestrianContext | None, hours: tuple[int, int]) -> float | None:
    if pedestrians is None:
        return None
    rates = [
        (row.window_start.astimezone(KST).hour,
         row.pedestrian_count * 3600 / (row.window_end - row.window_start).total_seconds())
        for row in pedestrians.observations
    ]
    matching = [rate for hour, rate in rates if hours[0] <= hour < hours[1]]
    return 100 * mean(matching) / (max(rate for _, rate in rates) or 1) if matching else None


def nearby_supply(stores: list[Store], nearby_stores: list[Store]) -> list[CategorySupply]:
    baseline = Counter(store.category_code for store in stores)
    nearby = Counter(store.category_code for store in nearby_stores)
    names = {store.category_code: store.category_name for store in stores}
    return [
        CategorySupply(category_code=code, category_name=names[code], nearby_store_count=nearby[code],
                       nearby_share=nearby[code] / len(nearby_stores) if nearby_stores else 0,
                       dataset_share=baseline[code] / len(stores))
        for code in sorted(baseline, key=lambda code: (-nearby[code], code))
    ]


def rank_categories(
    categories: list[CategorySupply], pedestrians: PedestrianContext | None,
    facilities: list[NearbyFacility] | None, road: RoadContext | None,
) -> list[Recommendation]:
    road_score = None
    if road is not None:
        # Fixed distances and speed reference keep scores comparable across analysis radii.
        proximity = 100 * max(0, 1 - road.nearest_link_distance_m / 300)
        speeds = [slot.average_speed_kmh for slot in road.speed_by_hour]
        road_score = (proximity + 100 * min(mean(speeds) / 40, 1)) / 2 if speeds else proximity

    results = []
    for category in categories:
        supply_score = 100 * max(0, 1 - category.nearby_share / category.dataset_share)
        profile = CATEGORY_PROFILES.get(category.category_code)
        foot_score = pedestrian_fit(pedestrians, profile[0]) if profile else None
        matches = (
            sum(facility.type in profile[1] for facility in facilities)
            if profile and facilities is not None else None
        )
        facility_score = 50 * min(matches, 2) if matches is not None else None
        weighted = [(supply_score, 55), (foot_score, 20), (facility_score, 15), (road_score, 10)]
        available = [(score, weight) for score, weight in weighted if score is not None]
        score = sum(score * weight for score, weight in available) / sum(weight for _, weight in available)
        results.append(Recommendation(
            **category.model_dump(), score=round(score, 1), supply_gap_score=round(supply_score, 1),
            pedestrian_fit_score=None if foot_score is None else round(foot_score, 1),
            facility_fit_score=facility_score, road_access_score=None if road_score is None else round(road_score, 1),
            matching_facility_count=matches,
        ))
    return sorted(results, key=lambda item: (-item.score, item.category_code))[:3]


@router.get("/commercial-service/vacancies/{vacancy_id}/prescription")
def get_prescription(vacancy_id: str, radius_m: Annotated[int, Query(ge=100, le=1500)] = 300) -> Prescription:
    vacancies = get_vacancies()
    vacancy = next((item for item in vacancies.items if item.id == vacancy_id), None)
    if vacancy is None:
        raise HTTPException(404, "공실을 찾을 수 없습니다.")
    try:
        inputs = load_inputs()
    except (OSError, ValidationError) as exc:
        raise HTTPException(503, "공실 처방에 필요한 자료를 불러올 수 없습니다.") from exc

    sources = {
        "stores": inputs.stores, "facilities": inputs.facilities, "road_network": inputs.road_network,
        "road_traffic": inputs.road_traffic, "pedestrians": inputs.pedestrians,
    }
    statuses = {vacancies.data_status, *(source.data_status for source in sources.values())}
    nearby_stores = [store for store in inputs.stores.items if hypot(*offset_m(vacancy, store)) <= radius_m]
    categories = nearby_supply(inputs.stores.items, nearby_stores)
    facilities = []
    for facility in inputs.facilities.items:
        distance = hypot(*offset_m(vacancy, facility))
        if distance <= radius_m:
            facilities.append(NearbyFacility(**facility.model_dump(), distance_m=round(distance, 1)))
    facilities.sort(key=lambda facility: (facility.distance_m, facility.id))
    node_distances = {node.id: hypot(*offset_m(vacancy, node)) for node in inputs.road_network.nodes}
    pedestrians = pedestrian_context(inputs, {node: dist for node, dist in node_distances.items() if dist <= radius_m})
    road = road_context(inputs, vacancy, radius_m)
    recommendations = (
        rank_categories(categories, pedestrians, facilities if inputs.facilities.items else None, road)
        if nearby_stores else []
    )
    return Prescription(
        vacancy=vacancy, vacancy_source=vacancies.source, vacancy_data_status=vacancies.data_status,
        data_status="mixed" if len(statuses) > 1 else vacancies.data_status,
        sources=sources, radius_m=radius_m, nearby_store_count=len(nearby_stores),
        nearby_stores=nearby_stores, category_supply=categories,
        facilities=facilities, pedestrians=pedestrians, road_access=road,
        status="ready" if nearby_stores else "insufficient_store_data", recommendations=recommendations,
    )

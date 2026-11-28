from collections import defaultdict
from dataclasses import dataclass
from heapq import heappop, heappush
from itertools import count
from statistics import mean
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, ValidationError

if __package__:
    from .prescriptions import KST, RoadLink, RoadNetwork, RoadNode, Rows, SignalObservation, Source, TrafficObservation
    from .vacancies import BACKEND_DIR
else:
    from prescriptions import KST, RoadLink, RoadNetwork, RoadNode, Rows, SignalObservation, Source, TrafficObservation
    from vacancies import BACKEND_DIR


router = APIRouter(prefix="/traffic/sample-routes")
DATA_DIR = BACKEND_DIR / "data"


class RouteLink(RoadLink):
    length_m: float = Field(gt=0, allow_inf_nan=False)
    one_way: bool


class ProhibitedTurn(BaseModel):
    via_node_id: str
    incoming_link_id: str
    outgoing_link_id: str
    type: Literal["prohibited"]


class RouteNetwork(RoadNetwork):
    links: list[RouteLink]
    turn_restrictions: list[ProhibitedTurn]


class RouteTraffic(TrafficObservation):
    from_node_id: str
    to_node_id: str
    travel_time_seconds: float = Field(gt=0, allow_inf_nan=False)


class RouteSignal(SignalObservation):
    incoming_link_id: str
    approach_from_node_id: str
    outgoing_link_id: str


class RouteOptions(Source):
    nodes: list[RoadNode]
    hours: list[int]


class RouteOption(BaseModel):
    nodes: list[RoadNode]
    link_ids: list[str]
    distance_m: float
    travel_seconds: float
    signal_wait_seconds: float | None
    total_seconds: float
    fallback_segments: int
    observed_signal_turns: int


class RouteComparison(Source):
    hour: int
    routes: list[RouteOption]


@dataclass(frozen=True)
class RouteStep:
    link: RouteLink
    destination: str
    travel_seconds: float
    has_observation: bool


def load_route_data() -> tuple[RouteNetwork, list[RouteTraffic], list[RouteSignal]]:
    try:
        network = RouteNetwork.model_validate_json((DATA_DIR / "road-network-sample.json").read_bytes())
        traffic = Rows[RouteTraffic].model_validate_json((DATA_DIR / "traffic-observations-sample.json").read_bytes())
        signals = Rows[RouteSignal].model_validate_json((DATA_DIR / "signal-observations-sample.json").read_bytes())
        return network, traffic.items, signals.items
    except (OSError, ValidationError) as exc:
        raise HTTPException(503, "가상 경로 자료를 불러올 수 없습니다.") from exc


@router.get("/options")
def get_route_options() -> RouteOptions:
    network, traffic, _ = load_route_data()
    return RouteOptions(
        source=network.source, data_status="sample", reference_date=network.reference_date,
        nodes=network.nodes, hours=sorted({row.observed_at.astimezone(KST).hour for row in traffic}),
    )


def directed_steps(network: RouteNetwork, traffic: list[RouteTraffic], hour: int) -> dict[str, list[RouteStep]]:
    observations: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    for row in traffic:
        if row.observed_at.astimezone(KST).hour == hour:
            observations[row.link_id, row.from_node_id, row.to_node_id].append(row.travel_time_seconds)
    graph: dict[str, list[RouteStep]] = defaultdict(list)
    for link in network.links:
        directions = [(link.from_node_id, link.to_node_id)]
        if not link.one_way:
            directions.append((link.to_node_id, link.from_node_id))
        for start, end in directions:
            values = observations[link.id, start, end]
            seconds = mean(values) if values else link.length_m * 3.6 / 30
            graph[start].append(RouteStep(link, end, seconds, bool(values)))
    return graph


def compare_paths(
    network: RouteNetwork, traffic: list[RouteTraffic], signals: list[RouteSignal],
    start_id: str, end_id: str, hour: int,
) -> list[RouteOption]:
    nodes = {node.id: node for node in network.nodes}
    graph = directed_steps(network, traffic, hour)
    prohibited = {(turn.via_node_id, turn.incoming_link_id, turn.outgoing_link_id) for turn in network.turn_restrictions}
    wait_samples: dict[tuple[str, str, str, str], list[float]] = defaultdict(list)
    for signal in signals:
        if signal.observed_at.astimezone(KST).hour == hour:
            key = (signal.intersection_id, signal.approach_from_node_id, signal.incoming_link_id, signal.outgoing_link_id)
            wait_samples[key].append(signal.average_wait_seconds)

    order = count()
    # The bundled demo graph is small. Expanding paths by total cost yields the shortest distinct loop-free routes.
    pending = [(0.0, next(order), (start_id,), (), 0.0, 0.0, 0.0, 0, 0)]
    found = []
    while pending and len(found) < 3:
        total, _, path, links, travel, wait, distance, fallback, observed_turns = heappop(pending)
        current = path[-1]
        if current == end_id:
            found.append(RouteOption(
                nodes=[nodes[node_id] for node_id in path], link_ids=list(links), distance_m=round(distance, 1),
                travel_seconds=round(travel, 1), signal_wait_seconds=round(wait, 1) if observed_turns else None,
                total_seconds=round(total, 1), fallback_segments=fallback, observed_signal_turns=observed_turns,
            ))
            continue
        for step in graph[current]:
            if step.destination in path:
                continue
            samples = ()
            if links:
                if (current, links[-1], step.link.id) in prohibited:
                    continue
                samples = wait_samples.get((current, path[-2], links[-1], step.link.id), ())
            next_travel = travel + step.travel_seconds
            next_wait = wait + (mean(samples) if samples else 0)
            heappush(pending, (
                next_travel + next_wait, next(order), (*path, step.destination), (*links, step.link.id),
                next_travel, next_wait, distance + step.link.length_m,
                fallback + (not step.has_observation), observed_turns + bool(samples),
            ))
    return found


@router.get("")
def get_route_comparison(
    start_id: Annotated[str, Query(min_length=1)], end_id: Annotated[str, Query(min_length=1)],
    hour: Annotated[int, Query(ge=0, le=23)] = 8,
) -> RouteComparison:
    network, traffic, signals = load_route_data()
    ids = {node.id for node in network.nodes}
    if start_id not in ids or end_id not in ids:
        raise HTTPException(404, "출발지 또는 도착지 교차로를 찾을 수 없습니다.")
    if start_id == end_id:
        raise HTTPException(422, "출발지와 도착지는 서로 달라야 합니다.")
    return RouteComparison(
        source=network.source, data_status="sample", reference_date=network.reference_date, hour=hour,
        routes=compare_paths(network, traffic, signals, start_id, end_id, hour),
    )

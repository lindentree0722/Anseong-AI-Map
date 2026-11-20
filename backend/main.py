from typing import Annotated
from xml.etree.ElementTree import ParseError

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

if __package__:
    from .traffic import Latitude, Longitude, TrafficMode, TrafficOverview, load_traffic_overview
else:
    from traffic import Latitude, Longitude, TrafficMode, TrafficOverview, load_traffic_overview


class Place(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1)
    position: tuple[
        Annotated[Latitude, Field(strict=True)],
        Annotated[Longitude, Field(strict=True)],
    ] = Field(description="위도(-90~90), 경도(-180~180) 순서")


class PlacesResponse(BaseModel):
    message: str
    places: list[Place]


app = FastAPI()
# shortcut: 프로세스별 메모리 저장, 영구 보존이나 다중 워커 운영 시 저장소로 교체한다.
places: list[Place] = []


@app.get("/traffic/overview")
def get_traffic_overview(mode: TrafficMode | None = None) -> TrafficOverview:
    try:
        return load_traffic_overview(mode)
    except (ValueError, ParseError) as exc:
        raise HTTPException(502, "교통 제공기관의 응답 형식이 올바르지 않습니다.") from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503, detail="교통 데이터를 불러올 수 없습니다."
        ) from exc


@app.get("/places")
def get_places() -> list[Place]:
    """임시 장소 목록을 조회합니다. 서버 재시작 시 모든 장소가 사라집니다."""
    return places


@app.post("/places")
def create_places(new_places: list[Place]) -> PlacesResponse:
    """장소 배열을 추가합니다. 서버 재시작 시 사라지며 잘못된 항목이 있으면 전체 요청을 거부합니다."""
    places.extend(new_places)
    return PlacesResponse(message="장소 등록 성공", places=places)


@app.delete("/places")
def delete_places() -> PlacesResponse:
    """임시 장소를 모두 삭제합니다. 재시작 시에도 초기화되며, 인증 없는 로컬 시연용 API입니다."""
    places.clear()
    return PlacesResponse(message="장소 삭제 성공", places=places)

from xml.etree.ElementTree import ParseError

from fastapi import FastAPI, HTTPException

if __package__:
    from .traffic import TrafficMode, TrafficOverview, load_traffic_overview
else:
    from traffic import TrafficMode, TrafficOverview, load_traffic_overview


app = FastAPI()
places = []


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
def get_places():
    return places


@app.post("/places")
def create_places(new_places: list[dict]):
    places.extend(new_places)
    return {"message": "장소 등록 성공", "places": places}


@app.delete("/places")
def delete_places():
    places.clear()
    return {"message": "장소 삭제 성공", "places": places}

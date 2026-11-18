from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import ValidationError

if __package__:
    from .traffic import TrafficOverview, load_traffic_overview
else:
    from traffic import TrafficOverview, load_traffic_overview


app = FastAPI()
traffic_sample_path = Path(__file__).resolve().parent / "data" / "traffic-sample.json"
places = []


@app.get("/traffic/overview")
def get_traffic_overview() -> TrafficOverview:
    try:
        return load_traffic_overview(traffic_sample_path)
    except (OSError, ValidationError) as exc:
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

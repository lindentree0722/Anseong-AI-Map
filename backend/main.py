from fastapi import FastAPI

app = FastAPI()

places = []

@app.get("/places")
def get_places():
    return places

@app.post("/places")
def create_places(new_places: list[dict]):
    places.extend(new_places)
    return {
        "message" : "장소 등록 성공",
        "places" : places
    }


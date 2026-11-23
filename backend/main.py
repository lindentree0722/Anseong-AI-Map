import os
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from xml.etree.ElementTree import ParseError

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

if __package__:
    from . import commercial, database, signals
    from .traffic import Latitude, Longitude, TrafficMode, TrafficOverview, load_traffic_overview
else:
    import commercial, database, signals
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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.database_path = database.database_path()
    database.initialize(app.state.database_path)
    signals.init_db()
    yield


FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
app = FastAPI(
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    swagger_ui_oauth2_redirect_url="/api/docs/oauth2-redirect",
)
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


async def require_writes_enabled(request: Request) -> None:
    if request.method in {"POST", "PUT", "DELETE"} and os.getenv("ANSEONG_ALLOW_WRITES") == "0":
        raise HTTPException(403, "이 서버에서는 API를 통한 데이터 변경이 비활성화되어 있습니다.")


api = APIRouter(prefix="/api", dependencies=[Depends(require_writes_enabled)])


@app.exception_handler(sqlite3.Error)
async def database_error(request: Request, exc: sqlite3.Error) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": "장소 저장소를 사용할 수 없습니다."})


def read_places(connection: sqlite3.Connection) -> list[Place]:
    return [
        Place(name=name, position=(latitude, longitude))
        for name, latitude, longitude in connection.execute(
            "SELECT name, latitude, longitude FROM places ORDER BY id"
        )
    ]


@api.get("/traffic/overview")
def get_traffic_overview(mode: TrafficMode | None = None) -> TrafficOverview:
    try:
        return load_traffic_overview(mode)
    except (ValueError, ParseError) as exc:
        raise HTTPException(502, "교통 제공기관의 응답 형식이 올바르지 않습니다.") from exc
    except OSError as exc:
        raise HTTPException(
            status_code=503, detail="교통 데이터를 불러올 수 없습니다."
        ) from exc


@api.get("/places")
def get_places(request: Request) -> list[Place]:
    """저장된 장소 목록을 조회합니다. 서버 재시작 후에도 같은 DB 파일의 데이터는 유지됩니다."""
    with database.transaction(request.app.state.database_path) as connection:
        return read_places(connection)


@api.post("/places")
def create_places(new_places: list[Place], request: Request) -> PlacesResponse:
    """장소 배열을 저장합니다. 재시작 후에도 유지되며 잘못된 항목이 있으면 전체 요청을 거부합니다."""
    with database.transaction(request.app.state.database_path) as connection:
        connection.executemany(
            "INSERT INTO places(name, latitude, longitude) VALUES (?, ?, ?)",
            [(place.name, *place.position) for place in new_places],
        )
        return PlacesResponse(message="장소 등록 성공", places=read_places(connection))


@api.delete("/places")
def delete_places(request: Request) -> PlacesResponse:
    """저장된 장소를 모두 영구 삭제합니다. 재시작으로 복구되지 않으며, 인증 없는 로컬 시연용 API입니다."""
    with database.transaction(request.app.state.database_path) as connection:
        connection.execute("DELETE FROM places")
        return PlacesResponse(message="장소 삭제 성공", places=read_places(connection))


api.include_router(signals.router)
api.include_router(commercial.router)
app.include_router(api)

if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")


@app.get("/", include_in_schema=False)
@app.get("/traffic", include_in_schema=False)
@app.get("/signals", include_in_schema=False)
@app.get("/commercial", include_in_schema=False)
def frontend() -> FileResponse:
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise HTTPException(404, "프론트엔드 빌드가 없습니다.")
    return FileResponse(index)

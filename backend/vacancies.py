import os
from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ValidationError


router = APIRouter()
BACKEND_DIR = Path(__file__).resolve().parent


class Vacancy(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    address: str | None = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    confirmed_on: date


class VacancyDataset(BaseModel):
    source: str = Field(min_length=1)
    items: list[Vacancy]


class VacancyResponse(VacancyDataset):
    data_status: Literal["sample", "reported"]


@router.get("/commercial-service/vacancies")
def get_vacancies() -> VacancyResponse:
    configured_path = os.getenv("ANSEONG_VACANCY_DATA_PATH", "").strip()
    path = BACKEND_DIR / (configured_path or "data/vacancies-sample.json")
    try:
        dataset = VacancyDataset.model_validate_json(path.read_bytes())
    except (OSError, ValidationError) as exc:
        raise HTTPException(503, "공실 목록을 불러올 수 없습니다.") from exc
    return VacancyResponse(
        source=dataset.source,
        items=dataset.items,
        data_status="reported" if configured_path else "sample",
    )

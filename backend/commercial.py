import json
import os
from typing import Annotated
from urllib.parse import unquote, urlencode
from urllib.request import urlopen

from fastapi import APIRouter, HTTPException, Query


router = APIRouter()
STORE_URL = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius"


@router.get("/commercial-service/storeListInRadius")
def get_stores(
    radius: Annotated[int, Query(gt=0, le=1500)],
    cx: Annotated[float, Query(ge=-180, le=180)],
    cy: Annotated[float, Query(ge=-90, le=90)],
    pageNo: Annotated[int, Query(ge=1, le=5)] = 1,
):
    key = os.getenv("COMMERCIAL_SERVICE_KEY", "").strip()
    if not key:
        raise HTTPException(503, "상권 API 서비스키가 설정되지 않았습니다.")
    query = urlencode(
        {
            "serviceKey": unquote(key),
            "pageNo": pageNo,
            "numOfRows": 1000,
            "radius": radius,
            "cx": cx,
            "cy": cy,
            "type": "json",
        }
    )
    try:
        with urlopen(f"{STORE_URL}?{query}", timeout=10) as response:
            return json.load(response)
    except (OSError, ValueError) as exc:
        raise HTTPException(502, "상권 데이터를 불러올 수 없습니다.") from exc

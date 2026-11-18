# 안성맞춤 AI 백엔드

Python 3.15와 uv를 사용합니다. 저장소 루트에서 실행하세요.

```powershell
cd backend
uv sync --locked
uv run uvicorn main:app --reload
```

- API 문서: http://127.0.0.1:8000/docs
- 장소 조회: `GET /places`
- 장소 등록: `POST /places` (JSON 객체 배열)
- 교통 개요: `GET /traffic/overview`

교통 개요는 `data/traffic-sample.json`의 예시 데이터를 읽어 `dataStatus: "sample"`로 반환합니다.
`position`은 위도, 경도 순이며, `averageSpeed`의 단위는 km/h입니다.
교통량의 집계 구간은 `aggregationIntervalSeconds`로 확인할 수 있습니다.
예시에서 제공하지 않는 값은 `null`이며, 파일을 읽을 수 없거나 형식이 잘못되면 503이 반환됩니다.

저장소 루트에서 교통 API 테스트를 실행합니다.

```powershell
uv sync --project backend --locked
uv run --project backend python -B -m pytest backend/tests -q
```

장소 데이터는 메모리에 저장되며 서버 재시작 시 초기화됩니다.
`anseong-ai-map` 명령은 현재 인사 메시지만 출력합니다. API는 위의 uvicorn 명령으로 실행하세요.

의존성을 변경할 때는 `uv add 패키지명`을 사용하고 `pyproject.toml`과
`uv.lock`을 함께 커밋하세요.

# 안성맞춤 AI 백엔드

Python 3.15와 uv를 사용합니다. 저장소 루트에서 실행하세요.

2026-11-21 Windows 환경에서 `uv sync --project backend --locked`가 성공했습니다.
이때 uv가 선택한 인터프리터는 **CPython 3.15.0b3(베타)**입니다. 정식 Python 3.15에서의 호환성을 검증한 결과는 아닙니다.

```powershell
cd backend
uv sync --locked
uv run uvicorn main:app --reload
```

- API 문서: http://127.0.0.1:8000/api/docs
- 장소 조회: `GET /api/places`
- 장소 등록: `POST /api/places` (JSON 객체 배열)
- 장소 전체 삭제: `DELETE /api/places`
- 교통 개요: `GET /api/traffic/overview`
- 가상 신호 대기시간: `GET /api/traffic/signals/wait-times`
- 신호 목록·상세: `GET /api/traffic-signals`, `GET /api/traffic-signals/{id}`
- 신호 동기화·수정: `POST /api/traffic-signals/sync`, `PUT /api/signals/{id}`
- 상권 반경 조회: `GET /api/commercial-service/storeListInRadius`
- 공실 목록 조회: `GET /api/commercial-service/vacancies`
- 공실 처방: `GET /api/commercial-service/vacancies/{vacancy_id}/prescription`

### 공실 목록 API

기본 응답은 `data/vacancies-sample.json`의 가상 공실 목록이며 `data_status`는 `sample`입니다. 실제 자료를 받으면 같은 형식의 JSON 파일을 준비하고 서버 환경변수 `ANSEONG_VACANCY_DATA_PATH`에 경로를 지정하세요. 상대 경로는 `backend/` 기준입니다. 설정한 파일의 응답에는 `data_status: "reported"`가 붙습니다.

파일에는 제공처명 `source`와 공실 배열 `items`가 필요합니다. 각 항목은 고유한 문자열 `id`, `name`, 위도 `lat`, 경도 `lng`, 확인일 `confirmed_on` (`YYYY-MM-DD`)을 포함합니다. `address`는 선택 항목입니다. 공실이 없으면 빈 배열을 사용하세요. 파일을 읽을 수 없거나 형식이 잘못되면 API는 503을 반환합니다. 실제 자료 파일은 저장소 외부에서 관리하세요.

### 공실 처방 API

`/api/docs`에서 공실 목록의 ID를 선택해 처방을 조회합니다. 샘플 요청은 `GET /api/commercial-service/vacancies/grid-vacancy-7/prescription?radius_m=300`입니다. 반경은 공실을 중심으로 100~1,500m이며 기본값은 300m입니다.

- 지도에 표시할 주변 점포·시설, 반경 내 업종 분포, 가장 가까운 유동인구 관측 지점의 시간대별 기록, 가까운 도로와 시간대별 평균속도를 반환합니다. 반경과 도로 거리는 좌표로 계산합니다.
- 추천은 최대 3개 업종이며, 공급 공백 55%, 유동인구 시간대 적합도 20%, 주변 시설 적합도 15%, 도로 접근성 10%를 사용합니다. 공급 공백은 전체 자료와 반경 내 업종 비중을 비교합니다. 유동인구는 업종별 가정 영업시간에 해당하는 관측의 시간당 인원을, 시설은 업종에 관련된 유형의 개수를, 도로는 구간까지의 거리와 관측 속도를 반영합니다. 사용할 수 있는 항목의 가중치만 합계 100%로 환산합니다. 점수는 시연용 규칙이며 매출·수익 예측에는 사용할 수 없습니다.
- 반경 내 점포가 없으면 `insufficient_store_data`와 빈 추천 배열을 반환합니다. 반경 내 가상 신호 기록이 있으면 전체 기록의 평균 `signal_average_wait_seconds`와 교차로·시간대별 `signal_wait_by_hour`를 제공합니다. 자료가 없으면 `null`과 빈 배열을 반환합니다. 신호 대기시간은 별도 참고 지표입니다. 공실 ID가 없으면 404, 자료를 읽거나 검증할 수 없으면 503입니다.

기본값으로 내장 샘플을 읽습니다. 실자료를 연결하려면 공실 파일은 `ANSEONG_VACANCY_DATA_PATH`를 사용하고, 나머지 파일은 `ANSEONG_PRESCRIPTION_DATA_DIR`로 지정한 디렉터리에 둡니다. 디렉터리의 상대 경로는 `backend/` 기준입니다.

| 파일 | 참고 형식 |
| --- | --- |
| `stores.json` | `stores-sample.json`의 점포 ID, 위치, 업종 코드 및 이름 |
| `facilities.json` | `facilities-sample.json`의 시설 ID, 위치 및 유형 |
| `road-network.json` | `road-network-sample.json`의 도로 링크와 교차로 |
| `traffic-observations.json` | `traffic-observations-sample.json`의 도로 링크 ID, 시각 및 평균속도 |
| `foot-traffic.json` | `foot-traffic-sample.json`의 교차로 ID, 집계 시작·종료 시각 및 인원수 |
| `signal-observations.json` (선택) | `signal-observations-sample.json`의 교차로 ID, 관측시각 및 평균 대기시간 |

각 파일은 `source`, `reference_date`, `data_status`를 포함해야 합니다. 실자료는 `reported`, 가상 자료는 `sample`로 표시합니다. 실자료와 샘플이 섞이면 처방 응답은 `mixed`이며 개별 출처는 `sources`에서 확인할 수 있습니다. 실자료의 업종 코드가 `CAFE`, `FOOD`, `RETAIL`, `LIFE`, `HEALTH`, `EDU`인 경우 시연의 시간대·시설 적합도 규칙이 적용됩니다. 추가 업종에는 공급 공백과 이용 가능한 도로 접근성 점수를 사용합니다.

### 가상 신호 대기시간 API

`GET /api/traffic/signals/wait-times`는 가상 관측의 교차로별·시간대별 평균 대기시간과 집계 건수를 반환합니다. `?intersection_id=grid-node-2`로 특정 교차로를 조회할 수 있습니다. 시간대는 한국 표준시 기준이며, `data_status`는 `sample`입니다. 관측이 없는 교차로는 빈 배열을, 등록되지 않은 교차로 ID는 404를 반환합니다.

## 단일 서버 실행 및 Render 배포

저장소 루트에서 프론트를 빌드하고 FastAPI를 시작합니다.

```sh
npm ci --prefix frontend
npm run build --prefix frontend
uv run --project backend uvicorn backend.main:app
```

같은 서버에서 [홈 화면](http://127.0.0.1:8000/)과 [API 문서](http://127.0.0.1:8000/api/docs)를 열 수 있습니다. 개발할 때는 Vite를 별도로 실행해도 `/api/*` 경로가 그대로 FastAPI로 전달됩니다.

Render에서 저장소 루트를 사용하는 **Docker / Free Web Service** 하나를 만들고, 배포 브랜치와 루트의 `Dockerfile`을 선택합니다. Health Check Path는 `/api/health`입니다. 이미지 빌드가 프론트를 컴파일하고, FastAPI는 Render의 `PORT`로 화면과 API를 제공합니다. [Render Docker 배포 문서](https://render.com/docs/docker)

| 서버 환경변수 | 설정 |
| --- | --- |
| `CORS_ORIGINS` | 별도 출처에서 API를 호출할 때 허용할 주소를 쉼표로 지정합니다. 기본값은 `http://localhost:5173,http://127.0.0.1:5173`입니다. 같은 Render 주소에서 화면과 API를 사용하면 추가 설정이 필요 없습니다. |
| `COMMERCIAL_SERVICE_KEY` | 상권 분석의 서버 호출에 사용하는 공공데이터포털 키입니다. 키가 없으면 화면에 더미 데이터 사용이 표시됩니다. |
| `TRAFFIC_SIGNAL_API_KEY` | 공공데이터포털 안성시 신호 관측을 활성화하는 서버 전용 키입니다. 기본 사용은 키 없이 안성시 샘플을 표시합니다. |
| `SIGNAL_DB_PATH` | 별도 신호 SQLite 파일을 사용하거나 기존 8001번 서버의 DB 복사본을 가져올 때 지정합니다. 기본값은 장소와 같은 SQLite 파일입니다. |

신호 응답의 숫자 ID는 해당 스냅샷 내 상세 조회에 사용합니다. 스냅샷을 교체하면 ID가 재사용될 수 있습니다.

로컬 시연에서는 장소 등록·전체 삭제와 신호 동기화·수정을 사용할 수 있습니다. 공개 Docker 배포는 `ANSEONG_ALLOW_WRITES=0`으로 해당 요청을 차단합니다. 서버가 설정된 원천 API에서 신호를 조회해 스냅샷을 갱신하는 동작은 가능합니다. Render Free의 로컬 SQLite 변경은 서비스 재시작, 재배포, 절전 시 유실될 수 있습니다. [Render Free 파일시스템 안내](https://render.com/docs/free#local-files-lost-on-redeploy)

### 안성시 신호 관측

서버 환경변수 `TRAFFIC_SIGNAL_API_KEY`를 설정하면 공공데이터포털에서 안성시(`4155000000`) 신호 관측을 2분마다, 교차로 위치를 1시간마다 갱신합니다. API는 기존 `/api/traffic-signals` 목록과 상세 경로를 사용합니다. [신호등 실시간 정보 API](https://www.data.go.kr/data/15157604/openapi.do)

목록에서 `observation.state`는 `fresh`, `stale`, `sample` 중 하나입니다. 관측 교차로에는 `observation_status`와 시간대가 포함된 `updated_at`이 반환됩니다. 상태와 시간이 비어 있으면 `unknown`, `null`로 표시합니다. 마지막 관측이 5분을 넘었거나 최근 갱신에 실패하면 이전 관측으로 표시합니다. 원천 응답을 받기 전에는 안성시 샘플을 볼 수 있습니다.

### 장소 API (SQLite)

등록 요청은 아래 형식의 배열입니다. `name`은 앞뒤 공백을 제거한 뒤 비어 있지 않아야 하고,
`position`은 위도(-90~90), 경도(-180~180) 순서의 숫자 두 개입니다.
필드 누락, 추가 필드, 문자열·불리언 좌표, 범위를 벗어난 좌표는 422로 거부합니다.
배열 중 한 항목이라도 잘못되면 아무 항목도 저장하지 않습니다.

```json
[{"name": "안성시청", "position": [37.008, 127.279]}]
```

`GET /api/places`는 장소 배열을 반환합니다. 등록과 삭제는 기존의 `message`, `places` 응답 구조를 유지합니다.
빈 배열 등록은 기존 목록을 유지하며, 빈 목록의 조회·삭제도 성공합니다.
기존 임의 JSON 객체를 보내던 외부 호출자는 위 형식으로 변경해야 합니다. 저장소 내 프런트엔드는 이 API를 호출하지 않습니다.

장소는 Python 표준 `sqlite3`로 파일에 저장되며 **서버 재시작 후에도 유지**됩니다.
등록 순서와 중복 등록을 유지하며, DB 내부 ID는 응답에 포함하지 않습니다.
일괄 등록과 전체 삭제는 트랜잭션으로 처리하므로 저장·커밋 실패 시 변경을 롤백합니다.
DB 잠금은 최대 5초 대기한 뒤 503을 반환하며, 응답에 SQL이나 파일 경로를 노출하지 않습니다.
현재 인증이 없으므로 공개 배포 전에 쓰기·전체 삭제 권한을 제한해야 합니다. 전체 삭제는 영구 삭제이며 재시작으로 복구되지 않습니다.

#### DB 경로와 전환

기본 파일은 `backend/data/anseong-ai-map.db`입니다. 앱 시작 시 상위 디렉터리와 테이블을 생성하며 기존 행을 유지합니다.
`ANSEONG_DB_PATH`로 다른 경로를 지정할 수 있습니다. 상대 경로는 실행 위치와 무관하게 `backend/` 기준이고, 설정은 서버 시작 시 읽습니다.
DB를 열거나 초기화할 수 없으면 서버 시작이 실패합니다. 경로를 바꾸면 다른 DB를 사용하므로 기존 파일을 자동으로 옮기지는 않습니다.

현재 저장소는 OneDrive 아래에 있으므로 활성 DB는 동기화되지 않는 로컬 디렉터리를 사용하세요. 저장소 루트에서 실행하는 Windows 예시:

```powershell
$env:ANSEONG_DB_PATH = Join-Path $env:LOCALAPPDATA 'Anseong-AI-Map\anseong-ai-map.db'
uv run --project backend uvicorn main:app --app-dir backend --reload
```

서버에는 해당 디렉터리의 읽기·쓰기 권한이 필요합니다. DB와 SQLite 보조 파일(`-journal`, `-wal`, `-shm`)은 Git에서 제외합니다.
신호 스냅샷과 수정 이력은 기본적으로 같은 SQLite 파일의 별도 테이블에 저장합니다. 교통 개요와 상권 응답은 저장하지 않습니다. 별도 ORM이나 의존성 추가는 없습니다.
기존 메모리 서버에 보존할 장소가 있다면 **서버를 종료하기 전에** `GET /places` 응답을 보관하고 전환 후 `POST /api/places`로 등록하세요. 자동 이전은 하지 않습니다.

#### 백업과 복원

1. 같은 DB를 사용하는 서버·워커를 모두 정상 종료합니다.
2. DB 파일을 별도의 백업 경로에 복사합니다. 정상 종료 후에도 보조 파일이 남아 있다면 임의로 삭제하거나 DB 파일만 복사하지 말고 SQLite의 백업 기능을 사용하세요.
3. 복원할 때도 서버를 종료하고 현재 DB와 보조 파일을 별도 폴더에 보관한 뒤, 백업 DB를 설정된 경로에 복사합니다. 재시작 후 `GET /api/places`로 내용을 확인합니다.

첫 버전은 테이블을 생성하는 초기화만 제공합니다. 이후 스키마 변경 시에는 백업과 명시적인 마이그레이션이 필요합니다.

### 교통 개요 API

기본 설정에서 교통 개요는 `data/traffic-sample.json`을 읽어 `dataStatus: "sample"`로 반환합니다.
더미 데이터를 수정하려면 이 JSON 파일을 편집하고 같은 주소로 다시 조회하세요. API 키 없이 사용할 수 있습니다.
`position`은 위도, 경도 순이며, `averageSpeed`의 단위는 km/h입니다.
교통량의 집계 구간은 `aggregationIntervalSeconds`로 확인할 수 있습니다.
예시에서 제공하지 않는 값은 `null`이며, 파일을 읽을 수 없거나 형식이 잘못되면 503이 반환됩니다.

### 안성시 실측 구간 조회

아래 명령을 서버를 실행할 PowerShell에서 사용하세요. 현재 연동 범위는 운영자가 안성시 소재임을 확인한 도로 링크 한 곳입니다. 링크 ID와 대표 좌표는 같은 구간의 값이어야 합니다. 제공기관의 구간 소통 응답에는 좌표가 없어 서버 설정에서 보완합니다.

```powershell
$env:GITS_SERVICE_KEY = Read-Host '경기도교통정보센터 발급 키' -MaskInput
$env:ANSEONG_LINK_ID = Read-Host '확인된 안성시 링크 ID'
$env:ANSEONG_LINK_POSITION = Read-Host '링크 대표 좌표 (위도,경도)'
$env:TRAFFIC_DATA_SOURCE = 'observed'
uv run uvicorn main:app --reload
```

`-MaskInput`은 PowerShell 7.1 이상에서 지원합니다. Windows PowerShell 5.1에서는 사용자 환경변수 설정에서 키를 등록한 후 새 터미널에서 실행하세요.

서버를 재시작하면 같은 `GET /api/traffic/overview`에서 실측값을 조회합니다. 더미 데이터로 돌아가려면 `TRAFFIC_DATA_SOURCE`를 `sample`로 설정하고 재시작하세요. 개별 요청의 `?mode=sample` 또는 `?mode=observed`는 서버 기본값보다 우선합니다.

실측 응답에는 수집 시각과 구간 속도가 포함됩니다. 제공기관 문서에서 교통량의 집계 구간과 단위를 특정할 수 없어 교통량은 `null`로 제공합니다. 결과 없음은 200과 빈 배열, 원천 응답 형식 오류는 502, 설정 누락·인증 실패·요청 시간 초과는 503입니다. [공식 구간 소통정보 조회 규격](https://openapigits.gg.go.kr/api/jsp/manual_getRoadLinkTrafficInfo.jsp)

저장소 루트에서 장소·교통 API 테스트를 실행합니다.

```powershell
uv sync --project backend --locked
uv run --project backend python -B -m pytest backend/tests -q
```

장소 테스트는 테스트별 임시 DB를 사용하므로 개발 DB를 변경하지 않습니다.
`test_places_restart.py`는 임시 DB와 로컬 포트로 Uvicorn 프로세스를 실행·종료하며 재시작 후 등록·삭제 결과 보존을 검증합니다.
2026-11-21 SQLite 전환 검증 결과: **61개 통과**. 입력·응답 계약, 순서·중복·특수문자, DB 제약,
경로 설정, 동시 등록, 잠금 오류, 쓰기·커밋·삭제 실패 롤백과 기존 교통 테스트를 확인했습니다.
Starlette의 `httpx` TestClient 사용 중단 예정 경고 1건이 있습니다. 브라우저 조작 및 실제 외부 API 호출은 이번 검증에 포함하지 않았습니다.

`anseong-ai-map` 명령은 현재 인사 메시지만 출력합니다. API는 위의 uvicorn 명령으로 실행하세요.

프런트엔드는 백엔드 API가 없거나 연결되지 않은 개발 단계에도 같은 응답 구조의 더미 데이터를 표시합니다. 새 API를 추가할 때는 실제 응답 계약과 더미 응답 계약을 함께 갱신하고, 프런트엔드 화면에 데이터 출처가 표시되는지 확인하세요.

의존성을 변경할 때는 `uv add 패키지명`을 사용하고 `pyproject.toml`과
`uv.lock`을 함께 커밋하세요.

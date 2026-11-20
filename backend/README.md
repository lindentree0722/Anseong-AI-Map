# 안성맞춤 AI 백엔드

Python 3.15와 uv를 사용합니다. 저장소 루트에서 실행하세요.

2026-11-21 Windows 환경에서 `uv sync --project backend --locked`가 성공했습니다.
이때 uv가 선택한 인터프리터는 **CPython 3.15.0b3(베타)**입니다. 정식 Python 3.15에서의 호환성을 검증한 결과는 아닙니다.

```powershell
cd backend
uv sync --locked
uv run uvicorn main:app --reload
```

- API 문서: http://127.0.0.1:8000/docs
- 장소 조회: `GET /places`
- 장소 등록: `POST /places` (JSON 객체 배열)
- 장소 전체 삭제: `DELETE /places`
- 교통 개요: `GET /traffic/overview`

### 임시 장소 API

등록 요청은 아래 형식의 배열입니다. `name`은 앞뒤 공백을 제거한 뒤 비어 있지 않아야 하고,
`position`은 위도(-90~90), 경도(-180~180) 순서의 숫자 두 개입니다.
필드 누락, 추가 필드, 문자열·불리언 좌표, 범위를 벗어난 좌표는 422로 거부합니다.
배열 중 한 항목이라도 잘못되면 아무 항목도 저장하지 않습니다.

```json
[{"name": "안성시청", "position": [37.008, 127.279]}]
```

`GET /places`는 장소 배열을 반환합니다. 등록과 삭제는 기존의 `message`, `places` 응답 구조를 유지합니다.
빈 배열 등록은 기존 목록을 유지하며, 빈 목록의 조회·삭제도 성공합니다.
기존 임의 JSON 객체를 보내던 외부 호출자는 위 형식으로 변경해야 합니다. 저장소 내 프런트엔드는 이 API를 호출하지 않습니다.

장소는 프로토타입용 **프로세스 메모리**에만 저장됩니다. 재시작하면 사라지고 여러 워커 간에 공유되지 않습니다.
`/docs`의 각 장소 API에도 이 제한을 표시합니다. 현재 인증이 없으므로 공개 배포 전에 쓰기·전체 삭제 권한을 제한해야 합니다.

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

서버를 재시작하면 같은 `GET /traffic/overview`에서 실측값을 조회합니다. 더미 데이터로 돌아가려면 `TRAFFIC_DATA_SOURCE`를 `sample`로 설정하고 재시작하세요. 개별 요청의 `?mode=sample` 또는 `?mode=observed`는 서버 기본값보다 우선합니다.

실측 응답에는 수집 시각과 구간 속도가 포함됩니다. 제공기관 문서에서 교통량의 집계 구간과 단위를 특정할 수 없어 교통량은 `null`로 제공합니다. 결과 없음은 200과 빈 배열, 원천 응답 형식 오류는 502, 설정 누락·인증 실패·요청 시간 초과는 503입니다. [공식 구간 소통정보 조회 규격](https://openapigits.gg.go.kr/api/jsp/manual_getRoadLinkTrafficInfo.jsp)

저장소 루트에서 장소·교통 API 테스트를 실행합니다.

```powershell
uv sync --project backend --locked
uv run --project backend python -B -m pytest backend/tests -q
```

2026-11-21 결과: **47개 통과**. 장소 입력 검증, 일괄 등록 실패 시 기존 데이터 보존,
조회·전체 삭제, 테스트 간 목록 초기화, OpenAPI 계약 및 기존 교통 테스트를 확인했습니다.
Starlette의 `httpx` TestClient 사용 중단 예정 경고 1건이 있습니다. 브라우저 조작 및 실제 외부 API 호출은 이번 검증에 포함하지 않았습니다.

장소 데이터는 메모리에 저장되며 서버 재시작 시 초기화됩니다.
`anseong-ai-map` 명령은 현재 인사 메시지만 출력합니다. API는 위의 uvicorn 명령으로 실행하세요.

프런트엔드는 백엔드 API가 없거나 연결되지 않은 개발 단계에도 같은 응답 구조의 더미 데이터를 표시합니다. 새 API를 추가할 때는 실제 응답 계약과 더미 응답 계약을 함께 갱신하고, 프런트엔드 화면에 데이터 출처가 표시되는지 확인하세요.

의존성을 변경할 때는 `uv add 패키지명`을 사용하고 `pyproject.toml`과
`uv.lock`을 함께 커밋하세요.

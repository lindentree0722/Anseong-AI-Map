# 안성시 교통 조회 API 구현 계획

**목표** · FastAPI에서 안성시 도로 구간의 교통 관측값을 출처, 관측 시각, 단위와 함께 반환한다.

**구조** · `GET /traffic/overview`를 추가하고 데이터 읽기와 응답 검증은 `backend/traffic.py`에 둔다. 로컬 JSON 샘플로 계약을 먼저 검증하고, 안성시 구간과 응답 필드가 확인되면 원천 API 연동을 추가한다.

**기술** · Python 3.15, uv, FastAPI, Pydantic, pytest

**요구사항** · [실제 데이터 연동 준비](../../../ansung-traffic-ai/필요데이터.md)

## 1. 교통 조회 API와 샘플 검증

- [ ] `backend/tests/test_traffic.py`와 샘플 JSON을 작성한다. pytest와 FastAPI TestClient에 필요한 httpx를 개발 의존성으로 추가하고 잠금 파일을 갱신한다.
- [ ] `GET /traffic/overview`가 404를 반환해 새 API 테스트가 실패하는지 확인한다.
- [ ] `backend/traffic.py`에 Pydantic 응답 모델과 `load_traffic_overview(path: Path) -> TrafficOverview`를 구현한다. 최상위 키는 `source`, `dataStatus`, `generatedAt`, `intersections`, `hourlyTraffic`, `summary`를 사용한다. 샘플은 `dataStatus: "sample"`로 표시한다. 도로 구간은 구간 ID로 식별하고, `position`은 [위도, 경도], 시각은 오프셋이 포함된 ISO 8601로 반환한다. 교통량에는 관측 구간과 단위를 함께 제공한다. 신호주기, 대기시간, 시간대 집계 등 근거가 없는 항목은 `null`로 둔다.
- [ ] `backend/main.py`에 조회 라우트를 추가한다. 기존 `/places` 경로와 응답 계약을 유지한다. 관측 레코드가 없는 유효한 파일은 200과 빈 배열을 반환하고, 파일이 없거나 형식이 잘못되면 503과 일반 오류 메시지를 반환한다.
- [ ] `uv run --project backend python -m pytest backend/tests -q`를 실행한다. 정상 샘플의 출처, 시각, 좌표 순서, 교통량 단위, 결측값과 빈 응답, 파일 누락 및 형식 오류를 검증한다. `backend/README.md`에 샘플 사용법과 테스트 명령을 추가하고 `/docs`에서 200 응답을 확인한다.

## 2. 안성시 실제 관측 데이터 연동

- [ ] 경기도 구간 소통 정보 API의 활용 가이드와 인증 응답을 확인한다. 안성시 도로 구간 한 곳 이상에 대해 공식 링크 ID, 좌표, 관측 시각, 집계 단위를 확인한다. 확인한 응답에서 키를 제거해 파서 검증용 샘플을 만든다.
- [ ] `backend/traffic.py`에서 원천 응답을 기존 응답 모델로 변환한다. API 키는 서버 환경변수로 읽고, 안성시 링크 ID로 관측값을 필터링한다. `dataStatus: "observed"`와 실제 관측 시각, 제공 기관을 반환한다. 집계 구간이나 단위를 확인할 수 없는 값은 숫자 대신 `null`로 전달한다.
- [ ] 원천 요청에 타임아웃을 둔다. 네트워크 또는 원천 HTTP 오류는 503, 원천 응답 형식 오류는 502로 반환한다. 오래된 관측값은 원래 관측 시각을 유지한다. 실제 데이터 조회 실패는 오류 응답으로 드러낸다.
- [ ] 저장된 원천 샘플로 정상 변환, 안성시 외 링크 제외, 누락 필드, 타임아웃, 잘못된 응답을 검증한다. API 키 설정법과 확인된 구간 범위를 백엔드 README에 기록한다.
- [ ] 인증된 원천 API를 사용해 `/docs`에서 안성시 도로 구간 한 곳 이상의 실제 관측값, 출처, 관측 시각, 단위를 확인한다. 이 확인을 실제 연동의 완료 기준으로 삼는다.

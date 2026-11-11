# 안성맞춤 AI - 신호 진단 프로토타입

React + Vite 기반의 교통 신호 진단 대시보드입니다.

## 실행 방법

1. Node.js LTS를 설치합니다.
2. 이 폴더를 VS Code로 엽니다.
3. VS Code 터미널에서 아래 명령어를 실행합니다.

```bash
npm install
npm run dev
```

4. 터미널에 표시되는 로컬 주소(보통 http://localhost:5173)를 브라우저에서 엽니다.

## 현재 구현된 기능

- 시뮬레이션 교차로 5개
- 교차로별 혼잡도, 교통량, 평균 속도, 평균 대기시간
- 교차로 선택 및 검색
- 시간대별 교통량 / 대기시간 차트
- 규칙 기반 예비 진단과 개선 검토 제안
- 향후 API 교체를 고려한 `trafficService.js`

## 데이터 주의

현재 수치, 교차로 이름, 지도 배치는 모두 기능 확인을 위한 가상 예시입니다.
실제 안성시 측정값이나 실제 신호 운영 정보를 나타내지 않습니다.
실제 서비스 전에는 공공데이터 또는 승인된 교통 데이터를 연결하고 진단 기준을 검증해야 합니다.

## 팀 통합용 출력 구조 초안

각 교차로의 공통 식별자는 `intersection.id`입니다. 다른 모듈에서는 이 ID를 기준으로 연결하는 것을 권장합니다.

```json
{
  "intersection_id": "ANS-001",
  "congestion_level": "HIGH",
  "average_speed_kmh": 17.8,
  "average_waiting_time_sec": 74,
  "traffic_volume_per_hour": 920,
  "data_source": "SIMULATION"
}
```

위 JSON은 통합 규격 예시이며, 실제 API 계약은 팀원들과 함께 확정해야 합니다.

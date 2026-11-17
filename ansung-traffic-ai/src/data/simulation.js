// 모든 수치는 화면 및 기능 검증을 위한 가상 시뮬레이션 데이터입니다.
// 실제 안성시 측정값이나 실제 신호 운영 정보가 아닙니다.
export const intersections = [
  {
    id: "ANS-001", name: "안성시청 사거리", area: "봉산동",
    trafficVolume: 920, averageSpeed: 17.8, averageWait: 74,
    congestion: 86, status: "혼잡", greenRatio: 0.38,
    directions: { north: 280, south: 220, east: 250, west: 170 }
  },
  {
    id: "ANS-002", name: "공도 터미널 교차로", area: "공도읍",
    trafficVolume: 810, averageSpeed: 22.4, averageWait: 58,
    congestion: 69, status: "주의", greenRatio: 0.43,
    directions: { north: 190, south: 210, east: 260, west: 150 }
  },
  {
    id: "ANS-003", name: "중앙대입구 교차로", area: "대덕면",
    trafficVolume: 640, averageSpeed: 31.2, averageWait: 31,
    congestion: 38, status: "원활", greenRatio: 0.51,
    directions: { north: 160, south: 170, east: 180, west: 130 }
  },
  {
    id: "ANS-004", name: "안성IC 진입 교차로", area: "금광면",
    trafficVolume: 1050, averageSpeed: 14.6, averageWait: 91,
    congestion: 94, status: "혼잡", greenRatio: 0.34,
    directions: { north: 330, south: 270, east: 290, west: 160 }
  },
  {
    id: "ANS-005", name: "한경국립대 인근", area: "중앙동",
    trafficVolume: 520, averageSpeed: 34.5, averageWait: 24,
    congestion: 25, status: "원활", greenRatio: 0.55,
    directions: { north: 120, south: 140, east: 150, west: 110 }
  }
];

export const hourlyTraffic = [
  { time: "06시", volume: 310, wait: 22 },
  { time: "07시", volume: 580, wait: 43 },
  { time: "08시", volume: 920, wait: 76 },
  { time: "09시", volume: 790, wait: 62 },
  { time: "10시", volume: 540, wait: 39 },
  { time: "11시", volume: 490, wait: 34 },
  { time: "12시", volume: 610, wait: 45 },
  { time: "13시", volume: 570, wait: 41 },
  { time: "14시", volume: 550, wait: 38 },
  { time: "15시", volume: 680, wait: 49 },
  { time: "16시", volume: 820, wait: 67 },
  { time: "17시", volume: 980, wait: 82 },
  { time: "18시", volume: 1120, wait: 94 },
  { time: "19시", volume: 870, wait: 71 },
  { time: "20시", volume: 620, wait: 46 }
];

export function getSummary(items) {
  const count = items.length || 1;
  return {
    count: items.length,
    congested: items.filter(x => x.congestion >= 75).length,
    averageWait: Math.round(items.reduce((s, x) => s + x.averageWait, 0) / count),
    averageSpeed: Number((items.reduce((s, x) => s + x.averageSpeed, 0) / count).toFixed(1)),
    totalVolume: items.reduce((s, x) => s + x.trafficVolume, 0)
  };
}

export function diagnose(item) {
  const findings = [];
  if (item.congestion >= 75) findings.push("혼잡도가 높아 교차로 접근 흐름을 우선 점검해야 합니다.");
  if (item.averageWait >= 60) findings.push("평균 대기시간이 길어 시간대별 신호 배분 검토가 필요합니다.");
  if (item.averageSpeed <= 20) findings.push("평균 통행속도가 낮아 인접 교차로의 대기행렬 영향도 확인해야 합니다.");
  if (item.greenRatio <= 0.38) findings.push("시뮬레이션상 녹색 신호 비율이 낮습니다. 방향별 교통량을 함께 검토해야 합니다.");
  if (!findings.length) findings.push("현재 시뮬레이션 지표에서는 뚜렷한 혼잡 신호가 적습니다. 시간대별 변화를 계속 관찰하세요.");

  return {
    level: item.congestion >= 75 || item.averageWait >= 60 ? "개선 검토 필요" : item.congestion >= 50 ? "관찰 필요" : "양호",
    findings,
    actions: [
      "방향별 교통량과 대기행렬 길이를 추가로 수집합니다.",
      "출퇴근 시간대와 비혼잡 시간대의 신호 배분 시나리오를 비교합니다.",
      "보행자 신호와 인접 교차로의 연동 조건을 확인한 뒤 개선안을 검토합니다."
    ],
    note: "이 결과는 가상 데이터에 규칙을 적용한 예비 진단이며, 실제 신호 조정 지시가 아닙니다."
  };
}
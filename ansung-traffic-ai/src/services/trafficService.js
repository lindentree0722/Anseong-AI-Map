import { intersections, hourlyTraffic, getSummary, diagnose } from "../data/simulation";

// 향후 실제 API로 교체할 수 있도록 데이터 접근을 한 곳에 모았습니다.
export async function fetchTrafficOverview() {
  return {
    source: "SIMULATION",
    generatedAt: new Date().toISOString(),
    intersections,
    hourlyTraffic,
    summary: getSummary(intersections)
  };
}

export async function fetchIntersectionDiagnosis(id) {
  const item = intersections.find(x => x.id === id);
  if (!item) throw new Error("교차로를 찾을 수 없습니다.");
  return { intersection: item, diagnosis: diagnose(item) };
}
import { loadApiOrDummy } from "../../../lib/api-fallback.mjs";
import { diagnose, getSummary, hourlyTraffic, intersections } from "../data/simulation.js";

function dummyOverview() {
  const generatedAt = new Date().toISOString();
  const rows = intersections.map(item => ({
    ...item,
    sourceId: item.id,
    observedAt: generatedAt,
    trafficVolumeUnit: "vehicles/hour",
    aggregationIntervalSeconds: 3600,
    diagnosis: diagnose(item)
  }));
  return {
    source: "프런트엔드 더미 데이터",
    dataStatus: "sample",
    generatedAt,
    intersections: rows,
    hourlyTraffic,
    summary: getSummary(rows)
  };
}

export async function fetchTrafficOverview(signal) {
  const result = await loadApiOrDummy(async () => {
    const response = await fetch("/api/traffic-overview", { signal });
    if (!response.ok) throw new Error("교통 정보를 불러오지 못했습니다.");
    return response.json();
  }, dummyOverview);
  return result.data;
}

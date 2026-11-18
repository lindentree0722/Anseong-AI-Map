export async function fetchTrafficOverview(signal) {
  const response = await fetch("/traffic/overview", { signal });
  if (!response.ok) throw new Error("교통 정보를 불러오지 못했습니다.");
  return response.json();
}

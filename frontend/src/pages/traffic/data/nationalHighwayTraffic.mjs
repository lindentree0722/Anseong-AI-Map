export function loadHighwayStations() {
  return import("./nationalHighwayTrafficData.mjs").then(module => module.default);
}

export function getHighwayMonths(stations, stationId) {
  const station = stations.find(item => item.id === stationId);
  if (!station) return [];

  return [...new Set(station.records.map(record => record.date.slice(0, 7)))].sort();
}

export function getMonthlyHighwayTraffic(stations, stationId, month) {
  const station = stations.find(item => item.id === stationId);
  if (!station) return null;

  const records = station.records.filter(record => record.date.startsWith(month));
  if (!records.length) return null;

  const hourlyTraffic = Array.from({ length: 24 }, (_, hour) => {
    const values = records
      .map(record => record.hourlyVolumes[hour])
      .filter(value => Number.isFinite(value));

    return {
      time: `${String(hour).padStart(2, "0")}시`,
      volume: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
      observationCount: values.length
    };
  });
  const dailyTraffic = records
    .filter(record => Number.isFinite(record.dailyTotal))
    .map(record => ({
      date: record.date,
      label: `${Number(record.date.slice(5, 7))}/${Number(record.date.slice(8, 10))}`,
      volume: record.dailyTotal
    }));
  const dailyVolumes = dailyTraffic.map(record => record.volume);

  return {
    station,
    month,
    startDate: records[0].date,
    endDate: records[records.length - 1].date,
    recordCount: records.length,
    averageDailyVolume: dailyVolumes.length
      ? Math.round(dailyVolumes.reduce((sum, value) => sum + value, 0) / dailyVolumes.length)
      : null,
    hourlyTraffic,
    dailyTraffic
  };
}

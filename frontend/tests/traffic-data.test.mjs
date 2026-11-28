import { test } from "node:test";
import assert from "node:assert/strict";
import highwayStations from "../src/pages/traffic/data/nationalHighwayTrafficData.mjs";
import { getHighwayMonths, getMonthlyHighwayTraffic } from "../src/pages/traffic/data/nationalHighwayTraffic.mjs";

test("imports hourly highway observations from the provided workbooks", () => {
  assert.equal(highwayStations.length, 7);
  assert.equal(highwayStations.reduce((count, station) => count + station.records.length, 0), 824);
  assert.ok(highwayStations.every(station => {
    const dates = station.records.map(record => record.date);
    return station.records.length > 0
      && station.records.every(record => record.hourlyVolumes.length === 24)
      && new Set(dates).size === dates.length;
  }));

  const september = getMonthlyHighwayTraffic(highwayStations, "1728-02", "2025-09");
  assert.equal(september.station.route, "일반국도 17호선");
  assert.equal(september.station.locality, "경기 용인 처인 원삼면");
  assert.equal(september.recordCount, 30);
  assert.equal(september.hourlyTraffic.length, 24);
  assert.equal(september.hourlyTraffic[0].volume, 265);
  assert.equal(september.hourlyTraffic[0].observationCount, 30);
  assert.equal(september.station.records.find(record => record.date === "2025-09-01").hourlyVolumes[0], 255);
  assert.equal(september.dailyTraffic.find(record => record.date === "2025-09-01").volume, 33300);
});

test("returns only months and observations available for the selected station", () => {
  assert.deepEqual(getHighwayMonths(highwayStations, "1728-02"), ["2025-09", "2025-10", "2025-11", "2025-12"]);
  assert.equal(getMonthlyHighwayTraffic(highwayStations, "unknown", "2025-09"), null);
  assert.equal(getMonthlyHighwayTraffic(highwayStations, "1728-02", "2026-01"), null);
});

import { useEffect, useMemo, useState } from "react";
import { Clock3, Gauge, MapPin, Radio, RefreshCw, Search, SlidersHorizontal, TrafficCone } from "lucide-react";
import MetricCard from "./components/MetricCard";
import TrafficMap from "./components/TrafficMap";
import DiagnosisPanel from "./components/DiagnosisPanel";
import { DailyTrafficChart, TrafficChart } from "./components/TrafficChart";
import { fetchTrafficOverview } from "./services/trafficService";
import { getHighwayMonths, getMonthlyHighwayTraffic, loadHighwayStations } from "./data/nationalHighwayTraffic.mjs";

function display(value, unit) {
  return value == null ? "자료 없음" : `${value.toLocaleString("ko-KR")}${unit}`;
}

function seoulTime(value) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function displayMonth(value) {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

export default function App() {
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState("ANS-001");
  const [highwayStations, setHighwayStations] = useState([]);
  const [selectedStationId, setSelectedStationId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [highwayDataError, setHighwayDataError] = useState(false);
  const highwayTraffic = useMemo(
    () => getMonthlyHighwayTraffic(highwayStations, selectedStationId, selectedMonth),
    [highwayStations, selectedStationId, selectedMonth]
  );
  const availableMonths = useMemo(
    () => getHighwayMonths(highwayStations, selectedStationId),
    [highwayStations, selectedStationId]
  );

  const load = () => setRevision(value => value + 1);
  const selectStation = event => {
    const stationId = event.target.value;
    const months = getHighwayMonths(highwayStations, stationId);
    setSelectedStationId(stationId);
    setSelectedMonth(months.at(-1) ?? "");
  };
  useEffect(() => {
    let active = true;
    loadHighwayStations()
      .then(stations => {
        if (!active) return;
        const stationId = stations[0]?.id ?? "";
        const months = getHighwayMonths(stations, stationId);
        setHighwayStations(stations);
        setSelectedStationId(stationId);
        setSelectedMonth(months.at(-1) ?? "");
      })
      .catch(() => {
        if (active) setHighwayDataError(true);
      });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setError(false);
    fetchTrafficOverview(request.signal)
      .then(result => { if (!request.signal.aborted) setOverview(result); })
      .catch(() => { if (!request.signal.aborted) setError(true); })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [revision]);

  const filtered = useMemo(() => {
    if (!overview) return [];
    return overview.intersections.filter(x => x.name.includes(query) || x.area.includes(query));
  }, [overview, query]);

  const selected = filtered.find(x => x.id === selectedId) || filtered[0];
  const summary = overview?.summary;

  if (error) return <main className="loading" role="alert">교통 정보를 불러오지 못했습니다. <button onClick={load}>다시 시도</button></main>;
  if (loading || !overview) return <main className="loading" role="status">교통 정보를 불러오는 중입니다…</main>;

  return <div className="app-shell">
    <main className="main-content">
      <header className="topbar"><div><div className="breadcrumb">안성맞춤 AI <span>/</span> 교통 분석</div><h1>교통량 분석 대시보드</h1></div>
        <div className="top-actions"><span className="source-badge"><Radio size={14}/> 국도 실측 참고</span><button className="icon-button" onClick={load} title="새로고침"><RefreshCw size={17}/></button></div>
      </header>

      <section className="welcome-row"><div><h2>일반국도 시간별 상시교통량</h2><p>제공 자료에는 안성 지점이 없어, 가평·용인·평택 관측소의 참고 데이터로 표시합니다.</p></div><div className="updated"><Clock3 size={14}/> 자료 기간 2025년 9~12월</div></section>

      <section className="metric-grid">
        <MetricCard label="시연 교차로" value={summary.count} unit="개" hint="가상 교차로" icon={MapPin}/>
        <MetricCard label="시연 혼잡 지점" value={summary.congested} unit="개" hint="가상 혼잡도 기준" icon={TrafficCone} tone="red"/>
        <MetricCard label="시연 평균 대기" value={summary.averageWait} unit="초" hint="가상 교차로 평균" icon={Clock3} tone="yellow"/>
        <MetricCard label="시연 평균 속도" value={summary.averageSpeed} unit="km/h" hint="가상 교차로 평균" icon={Gauge} tone="green"/>
      </section>

      <section className="content-grid">
        <div className="panel map-section">
          <div className="panel-heading"><div><div className="eyebrow">DEMO INTERSECTION MONITORING</div><h2>교차로 교통 현황 · 시연</h2></div><span className="count-label">{filtered.length}개 지점</span></div>
          <div className="map-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="교차로 또는 지역 검색"/></div>
          <TrafficMap intersections={filtered} selectedId={selected?.id} onSelect={setSelectedId}/>
          <div className="intersection-list">{!filtered.length && <p role="status">{overview.intersections.length ? "검색 결과가 없습니다." : "조회된 교통 지점이 없습니다."}</p>}{filtered.map(x => <button key={x.id} onClick={() => setSelectedId(x.id)} className={`intersection-row ${selected?.id === x.id ? "chosen" : ""}`}><span className={`mini-status ${x.congestion == null ? "unknown-bg" : x.congestion >= 75 ? "red-bg" : x.congestion >= 50 ? "yellow-bg" : "green-bg"}`}/><span className="intersection-name"><b>{x.name}</b><small>{x.area}</small></span><span className="intersection-wait">{display(x.averageWait, "초")}<small>대기시간</small></span><span className={`status-pill ${x.congestion == null ? "" : x.congestion >= 75 ? "red" : x.congestion >= 50 ? "yellow" : "green"}`}>{x.status ?? "자료 없음"}</span></button>)}</div>
        </div>

        <div className="right-column">
          {selected && <DiagnosisPanel item={selected} diagnosis={selected.diagnosis}/>}
          {selected && <section className="panel selected-stats"><div className="panel-heading"><div><div className="eyebrow">SELECTED INTERSECTION</div><h2>{selected.name}</h2></div><SlidersHorizontal size={18}/></div>
            <div className="selected-stat-grid"><div><small>교통량</small><b>{display(selected.trafficVolume, selected.trafficVolumeUnit === "vehicles/hour" ? "대/시간" : `대/${selected.aggregationIntervalSeconds}초`)}</b></div><div><small>평균 속도</small><b>{display(selected.averageSpeed, " km/h")}</b></div><div><small>혼잡도</small><b>{display(selected.congestion, "/100")}</b></div><div><small>녹색 신호 비율</small><b>{display(selected.greenRatio == null ? null : Math.round(selected.greenRatio * 100), "%")}</b></div></div>
          <p className="small-note">관측 시각 {seoulTime(selected.observedAt)}</p></section>}
        </div>
      </section>

      <section className="charts-grid">
        <div className="panel national-traffic-panel">
          <div className="panel-heading"><div><div className="eyebrow">NATIONAL HIGHWAY · OBSERVED</div><h2>시간대별 평균 교통량</h2></div><span className="unit-label">대 / 시간</span></div>
          <div className="traffic-filters">
            <label>국도 관측 지점<select value={selectedStationId} onChange={selectStation}>{highwayStations.map(station => <option key={station.id} value={station.id}>{station.route} · {station.id} · {station.locality}</option>)}</select></label>
            <label>관측 월<select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)}>{availableMonths.map(month => <option key={month} value={month}>{displayMonth(month)}</option>)}</select></label>
          </div>
          {highwayTraffic ? <>
            <div className="national-data-summary"><span>{highwayTraffic.station.locality} · {highwayTraffic.station.nearbyJunction}</span><b>{highwayTraffic.recordCount}일 관측 · 일평균 {display(highwayTraffic.averageDailyVolume, "대")}</b></div>
            <TrafficChart data={highwayTraffic.hourlyTraffic}/>
          </> : <p role={highwayDataError ? "alert" : "status"}>{highwayDataError ? "국도 교통량 원자료를 불러오지 못했습니다." : "국도 원자료를 불러오는 중입니다…"}</p>}
        </div>
        <div className="panel">
          <div className="panel-heading"><div><div className="eyebrow">DAILY TRAFFIC VOLUME · OBSERVED</div><h2>일별 전일 교통량 합계</h2></div><span className="unit-label">대 / 일</span></div>
          {highwayTraffic ? <DailyTrafficChart data={highwayTraffic.dailyTraffic}/> : <p role={highwayDataError ? "alert" : "status"}>{highwayDataError ? "국도 교통량 원자료를 불러오지 못했습니다." : "국도 원자료를 불러오는 중입니다…"}</p>}
        </div>
      </section>

      <footer className="footer-note"><span>ⓘ 데이터 안내</span> 상시교통량은 제공 엑셀 원자료(2025년 9~12월, 국도 17·38·45호선)입니다. 지도·교차로 대기시간·속도·신호 진단은 시연 데이터이며 국도 관측소와 연결되지 않습니다.</footer>
    </main>
  </div>;
}

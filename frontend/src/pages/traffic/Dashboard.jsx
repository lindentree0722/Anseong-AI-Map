import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from "react";
import { Activity, CarFront, Clock3, Gauge, MapPin, Radio, RefreshCw, Search, SlidersHorizontal, TrafficCone } from "lucide-react";
import MetricCard from "./components/MetricCard";
import TrafficMap from "./components/TrafficMap";
import DiagnosisPanel from "./components/DiagnosisPanel";
import { TrafficChart, WaitChart } from "./components/TrafficChart";
import { fetchTrafficOverview } from "./services/trafficService";

function display(value, unit) {
  return value == null ? "자료 없음" : `${value.toLocaleString("ko-KR")}${unit}`;
}

function seoulTime(value) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function App() {
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState("ANS-001");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => setRevision(value => value + 1);
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
  const sample = overview?.dataStatus === "sample";

  const summary = overview?.summary;

  if (error) return <main className="loading" role="alert">교통 정보를 불러오지 못했습니다. <button onClick={load}>다시 시도</button></main>;
  if (loading || !overview) return <main className="loading" role="status">교통 정보를 불러오는 중입니다…</main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><TrafficCone size={23}/></div><div><b>안성맞춤 AI</b><small>SMART CITY PLATFORM</small></div></div>
      <div className="side-label">ANALYSIS</div>
      <div className="nav-item active"><Activity size={17}/> 신호 진단 <span>01</span></div>
      <Link to="/commercial" className="nav-item"><MapPin size={17}/> 공실 처방 <span>02</span></Link>
      <div className="nav-item muted"><CarFront size={17}/> 멈춤 없는 길 <span>03</span></div>
      <div className="sidebar-bottom"><div className="live-indicator"><i/> {sample ? "시뮬레이션" : "실측 데이터"}</div><p>안성시 교통 분석 프로토타입</p></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><div className="breadcrumb">안성맞춤 AI <span>/</span> 교통 분석</div><h1>신호 진단 대시보드</h1></div>
        <div className="top-actions"><span className="source-badge"><Radio size={14}/> {sample ? "가상 데이터" : "실측 데이터"}</span><button className="icon-button" onClick={load} title="새로고침"><RefreshCw size={17}/></button></div>
      </header>

      <section className="welcome-row"><div><h2>안성시 교통 흐름을 한눈에 분석합니다.</h2><p>교차로별 교통량과 대기시간을 확인하고 개선 검토 구간을 찾아보세요.</p></div><div className="updated"><Clock3 size={14}/> 자료 생성 {seoulTime(overview.generatedAt)}</div></section>

      <section className="metric-grid">
        <MetricCard label="분석 교차로" value={summary.count} unit="개" hint="조회된 지점" icon={MapPin}/>
        <MetricCard label="혼잡 교차로" value={summary.congested} unit="개" hint="혼잡도 75점 이상" icon={TrafficCone} tone="red"/>
        <MetricCard label="평균 대기시간" value={summary.averageWait} unit="초" hint="교차로 평균값" icon={Clock3} tone="yellow"/>
        <MetricCard label="평균 통행속도" value={summary.averageSpeed} unit="km/h" hint="교차로별 평균값" icon={Gauge} tone="green"/>
      </section>

      <section className="content-grid">
        <div className="panel map-section">
          <div className="panel-heading"><div><div className="eyebrow">INTERSECTION MONITORING</div><h2>교차로 교통 현황</h2></div><span className="count-label">{filtered.length}개 지점</span></div>
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
        <div className="panel"><div className="panel-heading"><div><div className="eyebrow">HOURLY TRAFFIC VOLUME</div><h2>시간대별 교통량</h2></div><span className="unit-label">대 / 시간</span></div>{overview.hourlyTraffic?.length ? <TrafficChart data={overview.hourlyTraffic}/> : <p>시간대별 교통량 자료 없음</p>}</div>
        <div className="panel"><div className="panel-heading"><div><div className="eyebrow">AVERAGE WAITING TIME</div><h2>시간대별 평균 대기시간</h2></div><span className="unit-label">초</span></div>{overview.hourlyTraffic?.length ? <WaitChart data={overview.hourlyTraffic}/> : <p>시간대별 대기시간 자료 없음</p>}</div>
      </section>

      <footer className="footer-note"><span>ⓘ 데이터 안내</span> {overview.source} · {sample ? "위치와 교통 지표는 시연용 예시입니다." : "구간 속도는 제공기관 수집값입니다."}</footer>
    </main>
  </div>;
}

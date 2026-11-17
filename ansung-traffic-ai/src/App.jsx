import { useEffect, useMemo, useState } from "react";
import { Activity, CarFront, Clock3, Gauge, MapPin, Radio, RefreshCw, Search, SlidersHorizontal, TrafficCone } from "lucide-react";
import MetricCard from "./components/MetricCard";
import TrafficMap from "./components/TrafficMap";
import DiagnosisPanel from "./components/DiagnosisPanel";
import { TrafficChart, WaitChart } from "./components/TrafficChart";
import { fetchTrafficOverview, fetchIntersectionDiagnosis } from "./services/trafficService";

export default function App() {
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState("ANS-001");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("전체");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const result = await fetchTrafficOverview();
    setOverview(result);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!overview) return [];
    return overview.intersections.filter(x => x.name.includes(query) || x.area.includes(query));
  }, [overview, query]);

  const selected = overview?.intersections.find(x => x.id === selectedId) || overview?.intersections[0];
  const diagnosis = selected ? fetchIntersectionDiagnosis(selected.id) : null;
  const summary = overview?.summary;

  if (loading || !overview) return <main className="loading">안성맞춤 AI 신호 진단 시스템을 준비하고 있습니다...</main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><TrafficCone size={23}/></div><div><b>안성맞춤 AI</b><small>SMART CITY PLATFORM</small></div></div>
      <div className="side-label">ANALYSIS</div>
      <div className="nav-item active"><Activity size={17}/> 신호 진단 <span>01</span></div>
      <div className="nav-item muted"><MapPin size={17}/> 공실 처방 <span>02</span></div>
      <div className="nav-item muted"><CarFront size={17}/> 멈춤 없는 길 <span>03</span></div>
      <div className="sidebar-bottom"><div className="live-indicator"><i/> SIMULATION MODE</div><p>안성시 교통 분석 프로토타입</p></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><div className="breadcrumb">안성맞춤 AI <span>/</span> 교통 분석</div><h1>신호 진단 대시보드</h1></div>
        <div className="top-actions"><span className="source-badge"><Radio size={14}/> 가상 데이터 사용 중</span><button className="icon-button" onClick={load} title="새로고침"><RefreshCw size={17}/></button></div>
      </header>

      <section className="welcome-row"><div><h2>안성시 교통 흐름을 한눈에 분석합니다.</h2><p>교차로별 교통량과 대기시간을 확인하고 개선 검토 구간을 찾아보세요.</p></div><div className="updated"><Clock3 size={14}/> {new Date(overview.generatedAt).toLocaleString("ko-KR")}</div></section>

      <section className="metric-grid">
        <MetricCard label="분석 교차로" value={summary.count} unit="개" hint="등록된 시뮬레이션 지점" icon={MapPin}/>
        <MetricCard label="혼잡 교차로" value={summary.congested} unit="개" hint="혼잡도 75점 이상" icon={TrafficCone} tone="red"/>
        <MetricCard label="평균 대기시간" value={summary.averageWait} unit="초" hint="교차로 평균값" icon={Clock3} tone="yellow"/>
        <MetricCard label="평균 통행속도" value={summary.averageSpeed} unit="km/h" hint="교차로별 평균값" icon={Gauge} tone="green"/>
      </section>

      <section className="content-grid">
        <div className="panel map-section">
          <div className="panel-heading"><div><div className="eyebrow">INTERSECTION MONITORING</div><h2>교차로 교통 현황</h2></div><span className="count-label">{filtered.length}개 지점</span></div>
          <div className="map-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="교차로 또는 지역 검색"/></div>
          <TrafficMap intersections={filtered} selectedId={selectedId} onSelect={setSelectedId}/>
          <div className="intersection-list">{filtered.map(x => <button key={x.id} onClick={() => setSelectedId(x.id)} className={`intersection-row ${selectedId === x.id ? "chosen" : ""}`}><span className={`mini-status ${x.congestion >= 75 ? "red-bg" : x.congestion >= 50 ? "yellow-bg" : "green-bg"}`}/><span className="intersection-name"><b>{x.name}</b><small>{x.area}</small></span><span className="intersection-wait">{x.averageWait}초<small>대기시간</small></span><span className={`status-pill ${x.congestion >= 75 ? "red" : x.congestion >= 50 ? "yellow" : "green"}`}>{x.status}</span></button>)}</div>
        </div>

        <div className="right-column">
          {selected && diagnosis && <DiagnosisPanel item={selected} diagnosis={diagnosis.diagnosis}/>}
          {selected && <section className="panel selected-stats"><div className="panel-heading"><div><div className="eyebrow">SELECTED INTERSECTION</div><h2>{selected.name}</h2></div><SlidersHorizontal size={18}/></div>
            <div className="selected-stat-grid"><div><small>교통량</small><b>{selected.trafficVolume.toLocaleString()}<em>대/시간</em></b></div><div><small>평균 속도</small><b>{selected.averageSpeed}<em>km/h</em></b></div><div><small>혼잡도</small><b>{selected.congestion}<em>/100</em></b></div><div><small>녹색 신호 비율</small><b>{Math.round(selected.greenRatio * 100)}<em>%</em></b></div></div>
          </section>}
        </div>
      </section>

      <section className="charts-grid">
        <div className="panel"><div className="panel-heading"><div><div className="eyebrow">HOURLY TRAFFIC VOLUME</div><h2>시간대별 교통량</h2></div><span className="unit-label">대 / 시간</span></div><TrafficChart data={overview.hourlyTraffic}/></div>
        <div className="panel"><div className="panel-heading"><div><div className="eyebrow">AVERAGE WAITING TIME</div><h2>시간대별 평균 대기시간</h2></div><span className="unit-label">초</span></div><WaitChart data={overview.hourlyTraffic}/></div>
      </section>

      <footer className="footer-note"><span>ⓘ 데이터 안내</span> 본 화면의 교통량, 속도, 대기시간, 교차로 위치는 기능 검증용 시뮬레이션 데이터입니다. 실제 안성시 교통 측정값이 아닙니다.</footer>
    </main>
  </div>;
}
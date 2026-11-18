import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from "react";
import { Activity, CarFront, Clock3, Gauge, MapPin, Radio, RefreshCw, Search, SlidersHorizontal, TrafficCone } from "lucide-react";
import MetricCard from "./components/MetricCard";
import TrafficMap from "./components/TrafficMap";
import DiagnosisPanel from "./components/DiagnosisPanel";
import { TrafficChart, WaitChart } from "./components/TrafficChart";
import { fetchTrafficOverview, fetchIntersectionDiagnosis } from "./services/trafficService";
import SignalStatusPanel from "./components/SignalStatusPanel";
import { TrafficOptimizer } from "../signals/components/TrafficOptimizer";
import { api } from "../signals/lib/api";
import { readJson, validateList } from "../signals/lib/responses.mjs";
import { statusMeta } from "../signals/components/signal-utils";
import "../signals/signals.css";

export default function App() {
  const [overview, setOverview] = useState(null);
  const [selectedId, setSelectedId] = useState("ANS-001");
  const [query, setQuery] = useState("");
  const [signalItems, setSignalItems] = useState([]);
  const [signalLoading, setSignalLoading] = useState(true);
  const [signalError, setSignalError] = useState("");
  const [signalRefresh, setSignalRefresh] = useState(0);
  const [activeView, setActiveView] = useState("overview");

  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  function load() { setRefresh(value => value + 1); setSignalRefresh(value => value + 1); }
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTrafficOverview().then(result => { if (active) { setOverview(result); setLoading(false); } });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    setSignalLoading(true);
    setSignalError("");
    async function loadSignals() {
      try {
        const params = new URLSearchParams({ q: "", status: "all", limit: "20", offset: "0" });
        const data = validateList(await readJson(await api(`traffic-signals?${params}`, { signal: controller.signal })));
        if (!controller.signal.aborted) setSignalItems(data.items);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSignalItems([]);
          setSignalError(error instanceof Error ? error.message : "신호 API에 연결할 수 없습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setSignalLoading(false);
      }
    }
    void loadSignals();
    return () => controller.abort();
  }, [signalRefresh]);

  const filtered = useMemo(() => {
    if (!overview) return [];
    return overview.intersections.filter(x => x.name.includes(query) || x.area.includes(query));
  }, [overview, query]);

  const selected = overview?.intersections.find(x => x.id === selectedId) || overview?.intersections[0];
  const selectedSignal = signalItems.find(signal => signal.intersection_id === selected?.id);
  const diagnosis = selected ? fetchIntersectionDiagnosis(selected.id) : null;
  const summary = overview?.summary;

  if (loading || !overview) return <main className="loading">안성맞춤 AI 교통·신호 통합 화면을 준비하고 있습니다...</main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><TrafficCone size={23}/></div><div><b>안성맞춤 AI</b><small>SMART CITY PLATFORM</small></div></div>
      <div className="side-label">ANALYSIS</div>
      <div className="nav-item active"><Activity size={17}/> 교통·신호 통합 <span>01</span></div>
      <Link to="/commercial" className="nav-item"><MapPin size={17}/> 공실 처방 <span>02</span></Link>
      <div className="nav-item muted" title="준비 중" aria-disabled="true"><CarFront size={17}/> 멈춤 없는 길 <span>준비 중</span></div>
      <div className="sidebar-bottom"><div className="live-indicator"><i/> SIMULATION MODE</div><p>안성시 교통 분석 프로토타입</p></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div><div className="breadcrumb">안성맞춤 AI <span>/</span> 교통·신호 분석</div><h1>교통·신호 통합 대시보드</h1></div>
        <div className="top-actions"><span className="source-badge"><Radio size={14}/> 가상 데이터 사용 중</span><Link to="/signals" className="signal-search-link">신호 검색</Link><button className="icon-button" onClick={load} title="새로고침"><RefreshCw size={17}/></button></div>
      </header>

      <section className="welcome-row"><div><h2>교차로별 교통량과 신호 현황을 함께 확인합니다.</h2><p>지도에서 지점을 선택하면 기존 교통량으로 방향별 분석과 진단을 자동으로 보여줍니다.</p></div><div className="updated"><Clock3 size={14}/> {new Date(overview.generatedAt).toLocaleString("ko-KR")}</div></section>

      <nav className="dashboard-tabs" aria-label="통합 대시보드 기능">
        <button type="button" className={activeView === "overview" ? "active" : ""} onClick={() => setActiveView("overview")}>교통·신호 현황</button>
        <button type="button" className={activeView === "optimizer" ? "active" : ""} onClick={() => setActiveView("optimizer")}>직접 입력·파일 분석</button>
      </nav>

      {activeView === "optimizer" ? <div className="page-signals optimizer-host"><TrafficOptimizer/></div> : <>
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
          <TrafficMap intersections={filtered} signals={signalItems} selectedId={selectedId} onSelect={setSelectedId}/>
          <div className="intersection-list">{filtered.map(x => {
            const signal = signalItems.find(item => item.intersection_id === x.id);
            return <button key={x.id} onClick={() => setSelectedId(x.id)} className={`intersection-row ${selectedId === x.id ? "chosen" : ""}`}><span className={`mini-status ${x.congestion >= 75 ? "red-bg" : x.congestion >= 50 ? "yellow-bg" : "green-bg"}`}/><span className="intersection-name"><b>{x.name}</b><small>{x.area} · 신호 {signal ? statusMeta[signal.status].label : "미연계"}</small></span><span className="intersection-wait">{x.averageWait}초<small>대기시간</small></span><span className={`status-pill ${x.congestion >= 75 ? "red" : x.congestion >= 50 ? "yellow" : "green"}`}>{x.status}</span></button>;
          })}</div>
        </div>

        <div className="right-column">
          {selected && diagnosis && <DiagnosisPanel item={selected} diagnosis={diagnosis.diagnosis}/>}
          {selected && <section className="panel selected-stats"><div className="panel-heading"><div><div className="eyebrow">SELECTED INTERSECTION</div><h2>{selected.name}</h2></div><SlidersHorizontal size={18}/></div>
            <div className="selected-stat-grid"><div><small>교통량</small><b>{selected.trafficVolume.toLocaleString()}<em>대/시간</em></b></div><div><small>평균 속도</small><b>{selected.averageSpeed}<em>km/h</em></b></div><div><small>혼잡도</small><b>{selected.congestion}<em>/100</em></b></div><div><small>녹색 신호 비율</small><b>{Math.round(selected.greenRatio * 100)}<em>%</em></b></div></div>
          </section>}
          {selected && <SignalStatusPanel signal={selectedSignal} loading={signalLoading} error={signalError} refreshKey={signalRefresh}/>}
        </div>
      </section>

      <section className="charts-grid">
        <div className="panel"><div className="panel-heading"><div><div className="eyebrow">HOURLY TRAFFIC VOLUME</div><h2>시간대별 교통량</h2></div><span className="unit-label">대 / 시간</span></div><TrafficChart data={overview.hourlyTraffic}/></div>
        <div className="panel"><div className="panel-heading"><div><div className="eyebrow">AVERAGE WAITING TIME</div><h2>시간대별 평균 대기시간</h2></div><span className="unit-label">초</span></div><WaitChart data={overview.hourlyTraffic}/></div>
      </section>

      <footer className="footer-note"><span>ⓘ 데이터 안내</span> 교통량·속도·위치는 시뮬레이션 자료이며, 신호는 별도 API에 저장된 스냅샷입니다. 두 자료는 실시간 안성시 운영 정보로 보장되지 않습니다.</footer>
      </>}
    </main>
  </div>;
}
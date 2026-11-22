import { Activity, Gauge, Home, MapPin, TrafficCone } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export default function AnalysisSidebar() {
  return <aside className="analysis-sidebar">
    <div className="brand">
      <div className="brand-mark"><TrafficCone size={23} aria-hidden="true" /></div>
      <div><b>안성맞춤 AI</b><small>SMART CITY PLATFORM</small></div>
    </div>
    <div className="side-label">ANALYSIS</div>
    <nav className="analysis-nav" aria-label="ANALYSIS">
      <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Home size={17} aria-hidden="true" /><span className="nav-label">소개</span><span className="nav-count">01</span>
      </NavLink>
      <NavLink to="/signals" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Activity size={17} aria-hidden="true" /><span className="nav-label">신호 진단</span><span className="nav-count">02</span>
      </NavLink>
      <NavLink to="/commercial" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <MapPin size={17} aria-hidden="true" /><span className="nav-label">상권 분석</span><span className="nav-count">03</span>
      </NavLink>
      <NavLink to="/traffic" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Gauge size={17} aria-hidden="true" /><span className="nav-label">교통량 분석 대시보드</span><span className="nav-count">04</span>
      </NavLink>
    </nav>
    <div className="sidebar-bottom">
      <div className="live-indicator"><i /> SIMULATION MODE</div>
      <p>안성시 교통 분석 프로토타입</p>
    </div>
  </aside>
}

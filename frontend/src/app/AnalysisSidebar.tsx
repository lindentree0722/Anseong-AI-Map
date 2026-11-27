import { Activity, Gauge, Home, MapPin, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import cityLogo from '../assets/anseong-city-logo.png'

export default function AnalysisSidebar() {
  return <aside className="analysis-sidebar">
    <div className="brand">
      <img className="brand-logo" src={cityLogo} alt="안성시 로고" />
      <div><b>안성맞춤 AI</b><small>SMART CITY PLATFORM</small></div>
    </div>
    <div className="side-label">ANALYSIS</div>
    <nav className="analysis-nav" aria-label="ANALYSIS">
      <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Home size={17} aria-hidden="true" /><span className="nav-label">소개</span><span className="nav-count">01</span>
      </NavLink>
      <NavLink to="/signals" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Activity size={17} aria-hidden="true" /><span className="nav-label">신호등 지금</span><span className="nav-count">02</span>
      </NavLink>
      <NavLink to="/commercial" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <MapPin size={17} aria-hidden="true" /><span className="nav-label">상권 분석</span><span className="nav-count">03</span>
      </NavLink>
      <NavLink to="/traffic" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Gauge size={17} aria-hidden="true" /><span className="nav-label">신호 진단 대시보드</span><span className="nav-count">04</span>
      </NavLink>
    </nav>
    <NavLink to="/settings" className={({ isActive }) => `nav-item settings-link${isActive ? ' active' : ''}`}>
      <Settings size={17} aria-hidden="true" /><span className="nav-label">설정</span>
    </NavLink>
    <div className="sidebar-bottom">
      <div className="live-indicator"><i /> SIMULATION MODE</div>
      <p>안성시 교통 분석 프로토타입</p>
    </div>
  </aside>
}

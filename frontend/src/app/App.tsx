import { lazy, Suspense, useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
const Home = lazy(() => import('../pages/home/Page'))
const Signals = lazy(() => import('../pages/signals/Page'))
const Commercial = lazy(() => import('../pages/commercial/Page'))
const Traffic = lazy(() => import('../pages/traffic/Page'))
export default function App() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return <>
    <a className="app-skip" href="#app-content">본문으로 이동</a>
    <nav className="app-navigation" aria-label="주 메뉴">
      <Link className="app-brand" to="/">안성맞춤 AI</Link>
      <div>{[['/', '소개'], ['/signals', '신호 진단'], ['/commercial', '상권 분석'], ['/traffic', '교통 대시보드']].map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}</div>
    </nav>
    <div id="app-content" tabIndex={-1}>
      <Suspense fallback={<p className="app-message" role="status">화면을 불러오는 중입니다…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/commercial" element={<Commercial />} />
          <Route path="/traffic" element={<Traffic />} />
          <Route path="*" element={<main className="app-message"><h1>페이지를 찾을 수 없습니다.</h1><Link to="/">홈으로 이동</Link></main>} />
        </Routes>
      </Suspense>
    </div>
  </>
}

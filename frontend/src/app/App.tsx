import { lazy, Suspense, useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import AnalysisSidebar from './AnalysisSidebar'
const Home = lazy(() => import('../pages/home/Page'))
const Signals = lazy(() => import('../pages/signals/Page'))
const Commercial = lazy(() => import('../pages/commercial/Page'))
const Traffic = lazy(() => import('../pages/traffic/Page'))
export default function App() {
  const { pathname } = useLocation()
  const showAnalysisSidebar = ['/traffic', '/signals', '/commercial'].includes(pathname)
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return <>
    <a className="app-skip" href="#app-content">본문으로 이동</a>
    <div className={`app-layout${showAnalysisSidebar ? ' app-layout--analysis' : ''}`}>
      {showAnalysisSidebar && <AnalysisSidebar />}
      <div id="app-content" className="app-content" tabIndex={-1}>
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
    </div>
  </>
}

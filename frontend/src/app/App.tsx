import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import AnalysisSidebar from './AnalysisSidebar'
import SettingsPage from '../pages/settings/Page'
const Home = lazy(() => import('../pages/home/Page'))
const Signals = lazy(() => import('../pages/signals/Page'))
const Commercial = lazy(() => import('../pages/commercial/Page'))
const Traffic = lazy(() => import('../pages/traffic/Page'))
export default function App() {
  const { pathname } = useLocation()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => window.localStorage.getItem('anseong-ai-theme') === 'light' ? 'light' : 'dark')
  const showAnalysisSidebar = ['/traffic', '/signals', '/commercial', '/settings'].includes(pathname)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('anseong-ai-theme', theme)
  }, [theme])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return <>
    <a className="app-skip" href="#app-content">본문으로 이동</a>
    <div className={`app-layout${showAnalysisSidebar ? ' app-layout--analysis' : ''}`} data-theme={theme}>
      {showAnalysisSidebar && <AnalysisSidebar />}
      <div id="app-content" className="app-content" tabIndex={-1}>
        <Suspense fallback={<p className="app-message" role="status">화면을 불러오는 중입니다…</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signals" element={<Signals />} />
            <Route path="/commercial" element={<Commercial />} />
            <Route path="/traffic" element={<Traffic />} />
            <Route path="/settings" element={<SettingsPage theme={theme} onThemeChange={setTheme} />} />
            <Route path="*" element={<main className="app-message"><h1>페이지를 찾을 수 없습니다.</h1><Link to="/">홈으로 이동</Link></main>} />
          </Routes>
        </Suspense>
      </div>
    </div>
  </>
}

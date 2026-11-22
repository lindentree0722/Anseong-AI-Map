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
    </div>
  </>
}

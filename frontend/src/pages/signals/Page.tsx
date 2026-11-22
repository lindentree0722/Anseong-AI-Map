import { useEffect, useMemo, useState } from 'react'
import { DetailView } from './components/DetailView'
import { SignalList } from './components/SignalList'
import { TrafficOptimizer } from './components/TrafficOptimizer'
import type { Signal, SignalHistory, SignalStatus } from './components/signal-utils'
import { api } from './lib/api'
import { getDummySignalDetail, getDummySignalList, readJson, validateList, validateDetail } from './lib/responses.mjs'
import { loadApiOrDummy } from '../../lib/api-fallback.mjs'
import './signals.css'
type Filter = 'all' | SignalStatus
const filters: {value: Filter; label: string}[] = [
  {value:'all',label:'전체'}, {value:'green',label:'초록불'}, {value:'yellow',label:'노란불'}, {value:'red',label:'빨간불'}
]
const dataProxyUrl = import.meta.env.VITE_SIGNAL_DATA_PROXY_URL?.trim()
export default function SignalsPage() {
  const [view, setView] = useState<'signals' | 'optimizer'>('signals')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<Signal[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncNote, setSyncNote] = useState('별도 API의 저장 데이터입니다. 시뮬레이션이 포함될 수 있으며 실제 현재 신호가 아닐 수 있습니다.')
  const [selected, setSelected] = useState<Signal | null>(null)
  const [history, setHistory] = useState<SignalHistory[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [detailRefresh, setDetailRefresh] = useState(0)
  const selectedId = selected?.id

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({q:query.trim(),status:filter,limit:'20',offset:'0'})
        const result = await loadApiOrDummy(
          async () => validateList(await readJson(await api(`traffic-signals?${params}`, {signal:controller.signal}))),
          () => getDummySignalList(query, filter),
        )
        if (!controller.signal.aborted) {
          setItems(result.data.items); setTotal(result.data.total)
          if (result.usedDummy) setSyncNote('연결된 신호 API가 없어 더미 데이터를 표시합니다.')
        }
      } catch (err) {
        if (!controller.signal.aborted) { setItems([]); setTotal(0); setError(err instanceof Error ? err.message : '신호 API에 연결할 수 없습니다.') }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 160)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, filter, refresh])

  useEffect(() => {
    if (!dataProxyUrl) return
    const controller = new AbortController()
    let timer: number | undefined
    async function sync() {
      try {
        const payload = await readJson(await fetch(dataProxyUrl!, {signal:controller.signal}))
        if (!Array.isArray(payload.rows) || !payload.rows.length) throw new Error('외부 동기화 데이터가 없습니다.')
        await readJson(await api('traffic-signals/sync', {method:'POST', signal:controller.signal, headers:{'Content-Type':'application/json'}, body:JSON.stringify({rows:payload.rows,total:payload.total ?? payload.rows.length})}))
        if (!controller.signal.aborted) { setSyncNote(`외부 데이터 ${payload.rows.length}건 동기화 · 수신 시점의 저장 정보입니다.`); setRefresh(v => v + 1) }
      } catch {
        if (!controller.signal.aborted) setSyncNote('외부 동기화에 실패했습니다. 별도 API의 저장 정보를 조회합니다.')
      } finally { if (!controller.signal.aborted) timer = window.setTimeout(sync, 60000) }
    }
    void sync()
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [])

  useEffect(() => {
    if (selectedId === undefined) return
    const controller = new AbortController()
    setHistory([]); setDetailError(''); setDetailLoading(true)
    async function load() {
      try {
        const result = await loadApiOrDummy(
          async () => validateDetail(await readJson(await api(`traffic-signals/${selectedId}`, {signal:controller.signal}))),
          () => getDummySignalDetail(selectedId),
        )
        if (!controller.signal.aborted) {
          setSelected(result.data.signal); setHistory(result.data.history)
          if (result.usedDummy) setSyncNote('연결된 신호 API가 없어 더미 데이터를 표시합니다.')
        }
      } catch (err) {
        if (!controller.signal.aborted) setDetailError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
      } finally { if (!controller.signal.aborted) setDetailLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [selectedId, detailRefresh])
  const openDetail = (item: Signal) => setSelected(item)
  const resultLabel = useMemo(() => query.trim() ? `“${query.trim()}” 검색 결과` : '전국 신호등 현황', [query])
  return <div className="page-signals"><div className="app-shell">
    <header className="hero"><div className="container"><p className="brand-mark">신호등 지금 <span>저장 데이터</span></p><h1>{view === 'signals' ? <>지금 지나갈 곳의<br />신호를 빠르게 확인하세요.</> : <>교통량을 살펴보고<br />신호 개선안을 확인하세요.</>}</h1>{view === 'signals' && <><label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시·구·동 또는 교차로 아이디 검색" aria-label="지역 검색" autoComplete="off" /><kbd>⌘ K</kbd></label><p className="data-note"><span className="live-dot" aria-hidden="true" />{syncNote}</p></>}<nav className="app-tabs" aria-label="서비스 선택"><button type="button" className={view === 'signals' ? 'active' : ''} onClick={() => setView('signals')}>신호 현황</button><button type="button" className={view === 'optimizer' ? 'active' : ''} onClick={() => setView('optimizer')}>교통량 분석</button></nav></div></header>
    <main className="container content">
      {view === 'optimizer' ? <TrafficOptimizer /> : selected ? <><button className="back-button" onClick={() => setDetailRefresh(v => v + 1)} disabled={detailLoading}>상세 다시 조회</button><DetailView signal={selected} history={history} loading={detailLoading} error={detailError} onBack={() => setSelected(null)} /></> : <>
        <section className="results-head"><div><p className="eyebrow">신호등 조회</p><h2>{resultLabel}</h2></div><span className="result-count tabular">{loading ? '조회 중' : `${items.length}곳 / ${total.toLocaleString()}건`}</span></section>
        <nav className="filter-tabs" aria-label="신호 상태 필터">{filters.map((item) => <button type="button" key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</nav>
        <button className="back-button" onClick={() => setRefresh(v => v + 1)} disabled={loading}>다시 조회</button><SignalList items={items} loading={loading} error={error} hasQuery={Boolean(query.trim())} onSelect={openDetail} />
      </>}
    </main>
  </div></div>
}

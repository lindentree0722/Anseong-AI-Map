import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DetailView } from './components/DetailView'
import { SignalList } from './components/SignalList'
import type { Signal, SignalHistory, SignalStatus } from './components/signal-utils'
import { formatDate } from './components/signal-utils'
import { api } from './lib/api'
type Filter = 'all' | SignalStatus
type DataProxyResponse = { rows?: Record<string, unknown>[]; total?: number }
type SyncState = { source_name: string; received_rows: number; total_rows: number; synced_at: string }
type SignalResponse = { items: Signal[]; total: number; sync?: SyncState | null }
const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '전체' }, { value: 'green', label: '초록불' }, { value: 'yellow', label: '노란불' }, { value: 'red', label: '빨간불' },
]
const dataProxyUrl = '/api/dataproxy/44d06e5a-ee2b-4f35-999b-37fd780b7fe5/7582edcc-6ab1-4bc2-9832-b348f92a9f46?page=1&size=5000'
export default function App() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<Signal[]>([])
  const [total, setTotal] = useState(0)
  const [sync, setSync] = useState<SyncState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncNote, setSyncNote] = useState('실시간 데이터를 연결하는 중이에요.')
  const [selected, setSelected] = useState<Signal | null>(null)
  const [history, setHistory] = useState<SignalHistory[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const latestRequest = useRef(0)
  const searchCriteria = useRef({ query, filter })
  searchCriteria.current = { query, filter }
  const loadResults = useCallback(async () => {
    const requestId = ++latestRequest.current
    const currentSearch = searchCriteria.current
    const params = new URLSearchParams({ q: currentSearch.query.trim(), status: currentSearch.filter, limit: currentSearch.query.trim() ? '100' : '20', offset: '0' })
    setLoading(true); setError('')
    try {
      const response = await api(`traffic-signals?${params}`)
      if (!response.ok) throw new Error('신호등 정보를 불러오지 못했어요.')
      const data: SignalResponse = await response.json()
      if (requestId !== latestRequest.current) return
      setItems(data.items); setTotal(data.total); setSync(data.sync ?? null)
      if (data.sync) setSyncNote(`실시간 연동 완료 · ${data.sync.received_rows.toLocaleString()}건 반영`)
    } catch (err) {
      if (requestId !== latestRequest.current) return
      setError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.')
    } finally { if (requestId === latestRequest.current) setLoading(false) }
  }, [])
  const syncLiveData = useCallback(async () => {
    try {
      const response = await fetch(dataProxyUrl)
      if (!response.ok) throw new Error('실시간 연동 데이터를 받아오지 못했어요.')
      const payload: DataProxyResponse = await response.json()
      const rows = Array.isArray(payload.rows) ? payload.rows : []
      if (!rows.length) throw new Error('현재 수신된 신호등 정보가 없어요.')
      const saved = await api('traffic-signals/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows, total: payload.total ?? rows.length }) })
      if (!saved.ok) throw new Error('수신한 신호등 정보를 저장하지 못했어요.')
      setSyncNote(`실시간 연동 완료 · ${rows.length.toLocaleString()}건 반영`)
      await loadResults()
    } catch (err) {
      setSyncNote(err instanceof Error ? `${err.message} 마지막 저장 정보로 표시해요.` : '연동을 다시 시도해 주세요.')
      await loadResults()
    }
  }, [loadResults])
  useEffect(() => { const timer = window.setTimeout(loadResults, 160); return () => window.clearTimeout(timer) }, [loadResults])
  useEffect(() => { syncLiveData(); const timer = window.setInterval(syncLiveData, 60000); return () => window.clearInterval(timer) }, [syncLiveData])
  useEffect(() => {
    const timer = window.setInterval(() => {
      setItems((current) => current.map((item) => ({ ...item, remaining_seconds: Math.max(0, item.remaining_seconds - 1), phase_times: item.phase_times ? { green: Math.max(0, item.phase_times.green - 1), red: Math.max(0, item.phase_times.red - 1), yellow: Math.max(0, item.phase_times.yellow - 1) } : undefined })))
      setSelected((current) => current ? { ...current, remaining_seconds: Math.max(0, current.remaining_seconds - 1), phase_times: current.phase_times ? { green: Math.max(0, current.phase_times.green - 1), red: Math.max(0, current.phase_times.red - 1), yellow: Math.max(0, current.phase_times.yellow - 1) } : undefined } : current)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  const openDetail = async (item: Signal) => {
    setSelected(item); setHistory([]); setDetailError(''); setDetailLoading(true)
    try {
      const response = await api(`traffic-signals/${item.id}`)
      if (!response.ok) throw new Error('상세 정보를 불러오지 못했어요.')
      const data: { signal: Signal; history: SignalHistory[] } = await response.json()
      setSelected(data.signal); setHistory(data.history)
    } catch (err) { setDetailError(err instanceof Error ? err.message : '잠시 후 다시 시도해 주세요.') } finally { setDetailLoading(false) }
  }
  const resultLabel = useMemo(() => query.trim() ? `“${query.trim()}” 검색 결과` : '전국 신호등 현황', [query])
  const syncTime = sync ? formatDate(sync.synced_at) : '확인 중'
  return <div className="app-shell">
    <header className="hero"><div className="container">
      <div className="hero-topline"><p className="brand-mark">신호등 지금 <span>LIVE</span></p><p className="sync-stamp tabular">기준 {syncTime}</p></div>
      <h1>지금 지나갈 곳의<br />신호를 빠르게 확인하세요.</h1>
      <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시·구·동 또는 교차로 아이디 검색" aria-label="지역 검색" autoComplete="off" /><kbd>⌘ K</kbd></label>
      <p className="data-note"><span className="live-dot" aria-hidden="true" />{syncNote}</p>
    </div></header>
    <main className="container content">
      {selected ? <DetailView signal={selected} history={history} loading={detailLoading} error={detailError} onBack={() => setSelected(null)} /> : <>
        <section className="results-head"><div><p className="eyebrow">신호등 조회</p><h2>{resultLabel}</h2></div><span className="result-count tabular">{loading ? '조회 중' : `${items.length}곳 / ${total.toLocaleString()}건`}</span></section>
        {sync && <section className="live-summary" aria-label="실시간 수신 현황"><div><span>실시간 수신</span><strong className="tabular">{sync.received_rows.toLocaleString()}건</strong></div><p>{sync.source_name}<br /><b>{formatDate(sync.synced_at)} 기준</b></p></section>}
        <nav className="filter-tabs" aria-label="신호 상태 필터">{filters.map((item) => <button type="button" key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</nav>
        <SignalList items={items} loading={loading} error={error} hasQuery={Boolean(query.trim())} onSelect={openDetail} />
      </>}
    </main>
  </div>
}

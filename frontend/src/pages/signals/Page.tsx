import { useEffect, useMemo, useState } from 'react'
import { DetailView } from './components/DetailView'
import { SignalList } from './components/SignalList'
import type { Signal, SignalHistory, SignalStatus } from './components/signal-utils'
import { formatDate } from './components/signal-utils'
import { api } from './lib/api'
import { getDummySignalDetail, getDummySignalList, readJson, validateList, validateDetail } from './lib/responses.mjs'
import { loadApiOrDummy } from '../../lib/api-fallback.mjs'
import './signals.css'
type Filter = 'all' | SignalStatus
type SignalSync = { source_name: string; received_rows: number; total_rows: number; synced_at: string }
type DataSourceStatus = 'checking' | 'live' | 'demo' | 'offline'
const filters: {value: Filter; label: string}[] = [
  {value:'all',label:'전체'}, {value:'green',label:'초록불'}, {value:'yellow',label:'노란불'}, {value:'red',label:'빨간불'}
]
const dataProxyUrl = import.meta.env.VITE_SIGNAL_DATA_PROXY_URL?.trim()
function readSyncState(value: unknown): SignalSync | null {
  if (typeof value !== 'object' || value === null ||
      !('source_name' in value) || typeof value.source_name !== 'string' ||
      !('received_rows' in value) || typeof value.received_rows !== 'number' ||
      !('total_rows' in value) || typeof value.total_rows !== 'number' ||
      !('synced_at' in value) || typeof value.synced_at !== 'string') return null
  return {
    source_name: value.source_name,
    received_rows: value.received_rows,
    total_rows: value.total_rows,
    synced_at: value.synced_at,
  }
}
export default function SignalsPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<Signal[]>([])
  const [total, setTotal] = useState(0)
  const [sync, setSync] = useState<SignalSync | null>(null)
  const [dataSource, setDataSource] = useState<DataSourceStatus>('checking')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncNote, setSyncNote] = useState('신호등 정보를 확인하고 있습니다.')
  const [selected, setSelected] = useState<Signal | null>(null)
  const [history, setHistory] = useState<SignalHistory[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [refresh, setRefresh] = useState(0)
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
          const nextSync = readSyncState(result.data.sync)
          setSync(nextSync)
          if (result.usedDummy) {
            setDataSource('offline')
            setSyncNote('신호 API 연결에 실패해 더미 데이터를 표시합니다.')
          } else if (result.data.source === 'live' && nextSync) {
            setDataSource('live')
            setSyncNote(`실시간 API 수신 · ${nextSync.received_rows.toLocaleString()}건 · ${formatDate(nextSync.synced_at)} 기준`)
          } else if (result.data.api_status === 'unavailable' || result.data.api_status === 'invalid_response') {
            setDataSource('offline')
            setSyncNote('실시간 API 요청에 실패해 저장된 시연 데이터를 표시합니다.')
          } else {
            setDataSource('demo')
            setSyncNote('신호 API는 연결됐지만 서비스 URL과 키가 없어 시연 데이터를 표시합니다.')
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) { setItems([]); setTotal(0); setSync(null); setDataSource('offline'); setError(err instanceof Error ? err.message : '신호 API에 연결할 수 없습니다.') }
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
    const timer = window.setInterval(() => {
      setItems(current => current.map(item => ({...item, remaining_seconds: Math.max(0, item.remaining_seconds - 1)})))
      setSelected(current => current ? {...current, remaining_seconds: Math.max(0, current.remaining_seconds - 1)} : current)
    }, 1000)
    return () => window.clearInterval(timer)
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
          if (result.usedDummy) {
            setSync(null)
            setDataSource('offline')
            setSyncNote('연결된 신호 API가 없어 더미 데이터를 표시합니다.')
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) setDetailError(err instanceof Error ? err.message : '상세 정보를 불러오지 못했습니다.')
      } finally { if (!controller.signal.aborted) setDetailLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [selectedId])
  const openDetail = (item: Signal) => setSelected(item)
  const resultLabel = useMemo(() => query.trim() ? `“${query.trim()}” 검색 결과` : '전국 신호등 현황', [query])
  const syncTime = sync ? formatDate(sync.synced_at) : '확인 중'
  const sourceLabel = dataSource === 'live' ? 'LIVE' : dataSource === 'demo' ? '시연 데이터' : dataSource === 'offline' ? 'API 오류' : '확인 중'
  return <div className="page-signals"><div className="app-shell">
    <header className="hero"><div className="container">
      <div className="hero-topline"><p className="brand-mark">신호등 지금 <span>{sourceLabel}</span></p><p className="sync-stamp tabular">기준 {syncTime}</p></div>
      <h1>지금 지나갈 곳의<br />신호를 빠르게 확인하세요.</h1>
      <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="시·구·동 또는 교차로 아이디 검색" aria-label="지역 검색" autoComplete="off" /><kbd>⌘ K</kbd></label>
      <p className="data-note"><span className="live-dot" aria-hidden="true" />{syncNote}</p>
    </div></header>
    <main className="container content">
      {selected ? <DetailView signal={selected} history={history} loading={detailLoading} error={detailError} onBack={() => setSelected(null)} /> : <>
        <section className="results-head"><div><p className="eyebrow">신호등 조회</p><h2>{resultLabel}</h2></div><span className="result-count tabular">{loading ? '조회 중' : `${items.length}곳 / ${total.toLocaleString()}건`}</span></section>
        {sync && <section className="live-summary" aria-label="실시간 수신 현황"><div><span>실시간 수신</span><strong className="tabular">{sync.received_rows.toLocaleString()}건</strong></div><p>{sync.source_name}<br /><b>{syncTime} 기준</b></p></section>}
        <nav className="filter-tabs" aria-label="신호 상태 필터">{filters.map((item) => <button type="button" key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</nav>
        <button className="back-button" onClick={() => setRefresh(v => v + 1)} disabled={loading}>다시 조회</button><SignalList items={items} loading={loading} error={error} hasQuery={Boolean(query.trim())} onSelect={openDetail} />
      </>}
    </main>
  </div></div>
}

import { useEffect, useState } from 'react'
import type { Signal, SignalHistory } from '../../signals/components/signal-utils'
import { api } from '../../signals/lib/api'
import { formatDate, formatSeconds, statusMeta } from '../../signals/components/signal-utils'
import { readJson, validateDetail } from '../../signals/lib/responses.mjs'

type Props = { signal: Signal | undefined; loading: boolean; error: string; refreshKey: number }

export default function SignalStatusPanel({ signal, loading, error, refreshKey }: Props) {
  const [detail, setDetail] = useState<{ signal: Signal; history: SignalHistory[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  useEffect(() => {
    if (!signal) {
      setDetail(null)
      setDetailError('')
      setDetailLoading(false)
      return
    }

    const signalId = signal.id
    const controller = new AbortController()
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    async function load() {
      try {
        const data = validateDetail(await readJson(await api(`traffic-signals/${signalId}`, { signal: controller.signal })))
        if (!controller.signal.aborted) setDetail(data)
      } catch (err) {
        if (!controller.signal.aborted) setDetailError(err instanceof Error ? err.message : '신호 이력을 불러오지 못했습니다.')
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [signal?.id, refreshKey])

  return <section className="panel signal-link-panel">
    <div className="panel-heading">
      <div><div className="eyebrow">LINKED SIGNAL</div><h2>연계 신호 현황</h2></div>
      {signal && <span className={`signal-status-badge ${signal.status}`}>{statusMeta[signal.status].label}</span>}
    </div>
    {loading ? <p className="signal-message" role="status">저장된 신호 정보를 불러오는 중입니다.</p>
      : error ? <p className="signal-message error" role="alert">{error}</p>
        : !signal ? <p className="signal-message">선택한 교차로와 연결된 신호 정보가 없습니다. 연결은 교차로 ID가 일치할 때만 표시합니다.</p>
          : <>
            <div className="signal-current">
              <strong>{detail?.signal.name ?? signal.name}</strong>
              <span>{formatSeconds((detail?.signal ?? signal).remaining_seconds)}</span>
            </div>
            <p className="signal-source-note">별도 API에 저장된 스냅샷 · 갱신 {formatDate((detail?.signal ?? signal).updated_at)} · 실시간 신호가 아닐 수 있습니다.</p>
            <h3 className="signal-history-title">최근 신호 이력</h3>
            {detailLoading ? <p className="signal-message" role="status">신호 이력을 불러오는 중입니다.</p>
              : detailError ? <p className="signal-message error" role="alert">{detailError}</p>
                : detail?.history.length ? <ol className="signal-history-list">
                  {detail.history.slice(0, 5).map(item => <li key={item.id}>
                    <span className={`signal-history-dot ${item.status}`} />
                    <span>{item.label || statusMeta[item.status].label}</span>
                    <time>{formatDate(item.recorded_at)}</time>
                    <strong>{formatSeconds(item.remaining_seconds)}</strong>
                  </li>)}
                </ol> : <p className="signal-message">표시할 신호 이력이 없습니다.</p>}
          </>}
  </section>
}

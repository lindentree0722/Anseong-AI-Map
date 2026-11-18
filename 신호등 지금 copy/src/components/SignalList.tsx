import type { Signal } from './signal-utils'
import { formatDate, formatSeconds, statusMeta } from './signal-utils'
import type { SignalStatus } from './signal-utils'

const phaseOrder: SignalStatus[] = ['green', 'red', 'yellow']

interface SignalListProps {
  items: Signal[]
  loading: boolean
  error: string
  hasQuery: boolean
  onSelect: (signal: Signal) => void
}
export function SignalList({ items, loading, error, hasQuery, onSelect }: SignalListProps) {
  if (loading) return <div className="notice">신호등 정보를 불러오고 있어요.</div>
  if (error) return <div className="notice danger-notice">{error}</div>
  if (!items.length && hasQuery) return <div className="empty-guide compact"><h2>검색 결과가 없어요</h2><p>지역명이나 도로명을 다시 확인해 주세요.</p></div>
  if (!items.length) return <section className="empty-guide" aria-label="검색 안내"><div className="guide-icon" aria-hidden="true">⌕</div><h2>표시할 신호등 정보가 없어요</h2><p>잠시 후 다시 확인하거나 지역명을 검색해 주세요.</p></section>
  return <div className="signal-list" aria-live="polite">
    {items.map((signal) => {
      const meta = statusMeta[signal.status]
      return <button type="button" className="signal-row press" key={signal.id} onClick={() => onSelect(signal)}>
        <span className={`signal-light ${meta.className}`} aria-label={meta.label}><i /><i /><i /></span>
        <span className="signal-main"><strong>{signal.name}</strong><span>{signal.location}</span><small>마지막 갱신 {formatDate(signal.updated_at)}</small></span>
        <span className="signal-phase-times tabular" role="group" aria-label="신호별 잔여 시간">
          {phaseOrder.map((phase) => <span className={phase} key={phase}><em>{statusMeta[phase].label}</em><b>{formatSeconds(signal.phase_times?.[phase] ?? 0)}</b></span>)}
        </span>
        <span className="signal-arrow" aria-hidden="true">›</span>
      </button>
    })}
  </div>
}

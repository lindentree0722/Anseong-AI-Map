import { RegionMap } from './RegionMap'
import type { DirectionalSignal, Signal, SignalHistory, SignalStatus } from './signal-utils'
import { formatDate, formatSeconds, statusMeta } from './signal-utils'

interface DetailViewProps {
  signal: Signal | null
  history: SignalHistory[]
  loading: boolean
  error: string
  onBack: () => void
}

const phaseOrder: SignalStatus[] = ['green', 'red', 'yellow']
const directionLabels = ['북쪽 직진', '동쪽 직진', '남쪽 직진', '서쪽 직진']

const directionalDetails = (history: SignalHistory[]): DirectionalSignal[] =>
  directionLabels.map((label, index) => {
    const item = history.find((entry) => entry.label === label) ?? history[index]
    return {
      id: label,
      label,
      status: item?.status ?? 'red',
      remaining_seconds: item?.remaining_seconds ?? 0,
    }
  })

export function DetailView({ signal, history, loading, error, onBack }: DetailViewProps) {
  if (!signal || loading) {
    return <section className="detail"><button type="button" className="back-button press" onClick={onBack}>← 목록으로</button><div className="notice">상세 정보를 불러오고 있어요.</div></section>
  }

  if (error) {
    return <section className="detail"><button type="button" className="back-button press" onClick={onBack}>← 목록으로</button><div className="notice danger-notice">{error}</div></section>
  }

  const meta = statusMeta[signal.status]
  const directions = directionalDetails(history)

  return <section className="detail">
    <button type="button" className="back-button press" onClick={onBack}>← 목록으로</button>
    <div className="detail-heading">
      <span className={`signal-light large ${meta.className}`} aria-label={meta.label}><i /><i /><i /></span>
      <div><p className="eyebrow">현재 신호 · 교차로 {signal.intersection_id || '정보 없음'}</p><h2>{signal.name}</h2><p>{signal.location}</p>{signal.source && <small className="source-label">{signal.source}</small>}</div>
    </div>
    <div className="detail-status"><span className={`status-pill ${meta.className}`}>{meta.label}</span><strong className={`current-signal-value ${meta.className} tabular`}>{formatSeconds(signal.remaining_seconds)}</strong><small>현재 {meta.label}의 남은 시간 · 북쪽 직진 기준</small></div>
    <section className="phase-summary" aria-label="신호별 잔여 시간"><div className="section-heading"><h3>신호별 잔여 시간</h3><span>직진 신호 기준</span></div><div className="phase-time-grid">{phaseOrder.map((phase) => <div className={phase} key={phase}><span>{statusMeta[phase].label}</span><strong className="tabular">{formatSeconds(signal.phase_times?.[phase] ?? 0)}</strong></div>)}</div></section>
    <RegionMap signal={signal} />
    <section className="history"><div className="section-heading"><h3>방향별 직진 신호</h3><span>집계 {formatDate(signal.updated_at)}</span></div><ol>{directions.map((item) => { const itemMeta = statusMeta[item.status]; return <li key={item.id}><span className={`dot ${itemMeta.className}`} /><div><b>{item.label}</b><small>{itemMeta.label} · 현재 직진 신호</small></div><strong className="tabular">{formatSeconds(item.remaining_seconds)}</strong></li> })}</ol></section>
  </section>
}

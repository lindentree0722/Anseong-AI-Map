import type { Signal, SignalHistory } from './signal-utils'
import { formatDate, formatSeconds, statusMeta } from './signal-utils'
interface DetailViewProps { signal: Signal | null; history: SignalHistory[]; loading: boolean; error: string; onBack: () => void }
export function DetailView({ signal, history, loading, error, onBack }: DetailViewProps) {
  if (loading) return <section className="detail"><button className="back-button" onClick={onBack}>← 목록으로</button><div className="notice">상세 정보를 불러오고 있어요.</div></section>
  if (error || !signal) return <section className="detail"><button className="back-button" onClick={onBack}>← 목록으로</button><div className="notice danger-notice">{error || '상세 정보를 찾을 수 없어요.'}</div></section>
  const meta = statusMeta[signal.status]
  return <section className="detail">
    <button type="button" className="back-button press" onClick={onBack}>← 목록으로</button>
    <div className="detail-heading"><span className={`signal-light large ${meta.className}`} aria-label={meta.label}><i /><i /><i /></span><div><p className="eyebrow">저장 신호 · 교차로 {signal.intersection_id}</p><h2>{signal.name}</h2><p>{signal.location}</p><small className="source-label">{signal.source === 'dummy' ? 'API 미연결 · 더미 데이터' : (signal.source || '저장 정보')}</small></div></div>
    <div className="detail-status"><span className={`status-pill ${meta.className}`}>{meta.label}</span><strong className="tabular">{formatSeconds(signal.remaining_seconds)}</strong><small>집계 시점의 북쪽 직진 잔여시간</small></div>
    <section className="history"><div className="section-heading"><h3>방향별 직진 신호</h3><span>집계 {formatDate(signal.updated_at)}</span></div>{!history.length ? <div className="notice">표시할 방향별 정보가 없어요.</div> : <ol>{history.map((item) => { const itemMeta = statusMeta[item.status]; return <li key={item.id}><span className={`dot ${itemMeta.className}`} /><div><b>{item.label || itemMeta.label}</b><small>{itemMeta.label} · {formatDate(item.recorded_at)} 집계</small></div><strong className="tabular">{formatSeconds(item.remaining_seconds)}</strong></li> })}</ol>}</section>
  </section>
}

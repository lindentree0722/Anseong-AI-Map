import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Signal, SignalHistory } from './signal-utils'
import { formatDate, formatSeconds, observationLabel, statusMeta } from './signal-utils'

interface DetailViewProps { signal: Signal | null; history: SignalHistory[]; loading: boolean; error: string; onBack: () => void }

export function DetailView({ signal, history, loading, error, onBack }: DetailViewProps) {
  if (loading) return <section className="detail"><button className="back-button" onClick={onBack}>← 목록으로</button><div className="notice">상세 정보를 불러오고 있어요.</div></section>
  if (error || !signal) return <section className="detail"><button className="back-button" onClick={onBack}>← 목록으로</button><div className="notice danger-notice">{error || '상세 정보를 찾을 수 없어요.'}</div></section>

  const meta = statusMeta[signal.status]
  const position = signal.observation_status && signal.latitude != null && signal.longitude != null
    ? [signal.latitude, signal.longitude] as [number, number]
    : null
  return <section className="detail">
    <button type="button" className="back-button press" onClick={onBack}>← 목록으로</button>
    <div className="detail-heading">
      <span className={`signal-light large ${meta.className}`} aria-label={meta.label}><i /><i /><i /></span>
      <div>
        <p className="eyebrow">교차로 {signal.intersection_id}</p>
        <h2>{signal.name}</h2>
        <p>{signal.location}</p>
        <small className="source-label">
          {signal.observation_status && `${observationLabel[signal.observation_status]} · `}
          {signal.source === 'dummy' ? 'API 미연결 · 더미 데이터' : (signal.source || '저장 정보')}
        </small>
      </div>
    </div>
    <div className="detail-status">
      <span className={`status-pill ${meta.className}`}>{meta.label}</span>
      <strong className="tabular">{formatSeconds(signal.remaining_seconds)}</strong>
      <small>수집 시점의 {signal.movement_label || '북쪽 직진'} 잔여시간</small>
    </div>
    <section className="history">
      <div className="section-heading"><h3>방향별 직진 신호</h3><span>관측 {formatDate(signal.updated_at)}</span></div>
      {!history.length ? <div className="notice">표시할 방향별 정보가 없어요.</div> : <ol>{history.map(item => {
        const itemMeta = statusMeta[item.status]
        return <li key={item.id}>
          <span className={`dot ${itemMeta.className}`} />
          <div><b>{item.label || itemMeta.label}</b><small>{itemMeta.label} · {formatDate(item.recorded_at)}</small></div>
          <strong className="tabular">{formatSeconds(item.remaining_seconds)}</strong>
        </li>
      })}</ol>}
    </section>
    {position && <section className="history" aria-label="교차로 위치">
      <h3>교차로 위치</h3>
      <MapContainer className="signal-location-map" center={position} zoom={16} scrollWheelZoom={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        <CircleMarker center={position} radius={8} />
      </MapContainer>
    </section>}
    {signal.observation_status && <p className="notice">수집 시각의 참고 정보입니다. 실제 도로 신호를 따라 주세요.</p>}
  </section>
}

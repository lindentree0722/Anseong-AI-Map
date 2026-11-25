import { useEffect } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { formatSeconds, statusMeta } from './signal-utils'
import type { Signal, SignalStatus } from './signal-utils'

const phaseOrder: SignalStatus[] = ['green', 'yellow', 'red']

function MapViewport({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap()
  const position: [number, number] = [latitude, longitude]
  useEffect(() => {
    map.setView(position, 12, { animate: false })
    const frame = window.requestAnimationFrame(() => map.invalidateSize())
    return () => window.cancelAnimationFrame(frame)
  }, [latitude, longitude, map])
  return null
}
interface RegionMapProps { signal: Signal }
export function RegionMap({ signal }: RegionMapProps) {
  const latitude = signal.latitude ?? 36.5
  const longitude = signal.longitude ?? 127.8
  const region = signal.local_government || '해당 지역'
  const mapKey = `${signal.id}-${latitude}-${longitude}`
  return <section className="region-map-section" aria-label={`${region} 기준 지도`}>
    <div className="section-heading"><h3>신호등 위치</h3><span>{region} 중심</span></div>
    <div className="map-caption">현재 API는 개별 교차로 좌표를 제공하지 않아 지자체 중심 위치에 표시합니다. 마커를 누르면 신호 정보를 확인할 수 있습니다.</div>
    <div className="map-frame">
      <MapContainer key={mapKey} center={[latitude, longitude]} zoom={12} scrollWheelZoom={false} className="map-view">
        <MapViewport latitude={latitude} longitude={longitude} />
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tiles.osm.kr/hot/{z}/{x}/{y}.png" />
        <CircleMarker center={[latitude, longitude]} radius={10} pathOptions={{ color: 'var(--color-text)', fillColor: 'var(--color-accent)', fillOpacity: 1, weight: 2 }}>
          <Popup>
            <div className="map-popup">
              <strong>{signal.name}</strong>
              <span>{region} · 교차로 {signal.intersection_id}</span>
              <b className={`map-popup-current ${signal.status}`}>
                현재 {statusMeta[signal.status].label} · {formatSeconds(signal.remaining_seconds)}
              </b>
              <div className="map-popup-phases">
                {phaseOrder.map((phase) => (
                  <span className={phase} key={phase}>
                    <em>{statusMeta[phase].label}</em>
                    <b>{formatSeconds(signal.phase_times?.[phase] ?? 0)}</b>
                  </span>
                ))}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      </MapContainer>
    </div>
    <p className="map-location">{region} · 교차로 {signal.intersection_id}</p>
  </section>
}

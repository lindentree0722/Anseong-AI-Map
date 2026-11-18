import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Signal } from './signal-utils'
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
    <div className="section-heading"><h3>지역 기준 지도</h3><span>{region} 중심</span></div>
    <div className="map-caption">교차로별 좌표가 제공되지 않아 지자체 중심 위치를 표시합니다.</div>
    <div className="map-frame">
      <MapContainer key={mapKey} center={[latitude, longitude]} zoom={12} scrollWheelZoom={false} className="map-view">
        <MapViewport latitude={latitude} longitude={longitude} />
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tiles.osm.kr/hot/{z}/{x}/{y}.png" />
        <CircleMarker center={[latitude, longitude]} radius={10} pathOptions={{ color: 'var(--color-text)', fillColor: 'var(--color-accent)', fillOpacity: 1, weight: 2 }} />
      </MapContainer>
    </div>
    <p className="map-location">{region} · 교차로 {signal.intersection_id}</p>
  </section>
}

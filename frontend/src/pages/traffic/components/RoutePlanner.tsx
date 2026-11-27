import { useEffect, useMemo, useState } from 'react'
import { latLngBounds, type LatLngTuple } from 'leaflet'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useApiData } from '../../../lib/use-api-data'

type RoadNode = { id: string; name: string; lat: number; lng: number }
type Options = { nodes: RoadNode[]; hours: number[] }
type Candidate = {
  nodes: RoadNode[]
  distance_m: number
  travel_seconds: number
  signal_wait_seconds: number | null
  total_seconds: number
  fallback_segments: number
  observed_signal_turns: number
}
type Comparison = { routes: Candidate[]; reference_date: string; hour: number }
const basePath = '/api/traffic/sample-routes'
const overlayColors = ['#1764ca', '#ab5220', '#187c60']

function FitRoutes({points}: {points: LatLngTuple[]}) {
  const map = useMap()
  useEffect(() => { map.fitBounds(latLngBounds(points), {padding:[28,28], maxZoom:17, animate:false}) }, [map, points])
  return null
}

function RouteMap({routes, selected}: {routes: Candidate[]; selected: number}) {
  const points = useMemo(() => routes.map(route => route.nodes.map((node): LatLngTuple => [node.lat,node.lng])), [routes])
  const bounds = useMemo(() => points.flat(), [points])
  const active = routes[selected]
  const start = active.nodes[0]
  const end = active.nodes[active.nodes.length - 1]
  return <div className="route-map" aria-label="후보 경로 지도">
    <MapContainer center={[start.lat,start.lng]} zoom={16} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitRoutes points={bounds} />
      {points.map((line, index) => index !== selected && <Polyline key={index} positions={line} pathOptions={{color:overlayColors[index], weight:4, opacity:.55, dashArray:'6 7'}} />)}
      <Polyline positions={points[selected]} pathOptions={{color:overlayColors[selected], weight:5}} />
      {[start,end].map((node, index) => <CircleMarker key={node.id} center={[node.lat,node.lng]} radius={7} pathOptions={{color:'#fff', fillColor:overlayColors[selected], fillOpacity:1}}>
        <Tooltip permanent direction="top">{index ? '도착' : '출발'}</Tooltip>
      </CircleMarker>)}
    </MapContainer>
  </div>
}

export default function RoutePlanner() {
  const options = useApiData<Options>(`${basePath}/options`)
  const data = options.result?.status === 'ready' ? options.result.data : null
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [hour, setHour] = useState('')
  const [requestPath, setRequestPath] = useState<string | null>(null)
  const [selected, setSelected] = useState(0)
  const comparison = useApiData<Comparison>(requestPath)
  const result = comparison.result?.status === 'ready' ? comparison.result.data : null
  const from = start || data?.nodes.find(node => node.id === 'grid-node-2')?.id || data?.nodes[0]?.id || ''
  const to = end || data?.nodes.find(node => node.id === 'grid-node-8')?.id || data?.nodes[1]?.id || ''
  const selectedHour = hour || String(data?.hours.includes(8) ? 8 : data?.hours[0] ?? '')

  return <section className="panel route-planner" id="sample-route-planner">
    <div className="panel-heading"><h2>멈춤 없는 길 · 경로 비교</h2><span className="source-badge">가상 데이터</span></div>
    {options.result?.status === 'loading' && <p role="status">경로 선택 정보를 불러오는 중입니다…</p>}
    {options.result?.status === 'error' && <p role="alert">경로 선택 정보를 불러오지 못했습니다. <button onClick={options.retry}>다시 시도</button></p>}
    {data && data.nodes.length >= 2 && data.hours.length > 0 && <form onSubmit={event => {
      event.preventDefault()
      const path = `${basePath}?${new URLSearchParams({start_id:from, end_id:to, hour:selectedHour})}`
      setSelected(0)
      if (requestPath === path) comparison.retry()
      else setRequestPath(path)
    }}>
      <div className="route-fields">
        <label>출발 교차로<select value={from} onChange={event => {setStart(event.target.value); setRequestPath(null)}}>
          {data.nodes.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}
        </select></label>
        <label>도착 교차로<select value={to} onChange={event => {setEnd(event.target.value); setRequestPath(null)}}>
          {data.nodes.map(node => <option key={node.id} value={node.id}>{node.name}</option>)}
        </select></label>
        <label>출발 시간대<select value={selectedHour} onChange={event => {setHour(event.target.value); setRequestPath(null)}}>
          {data.hours.map(slot => <option key={slot} value={slot}>{String(slot).padStart(2,'0')}:00</option>)}
        </select></label>
      </div>
      {from === to && <p role="status">서로 다른 출발·도착 교차로를 선택해 주세요.</p>}
      <button className="route-submit" disabled={from === to || comparison.result?.status === 'loading'} type="submit">경로 비교</button>
    </form>}
    {data && (data.nodes.length < 2 || data.hours.length === 0) && <p role="status">경로를 비교할 자료가 없습니다.</p>}
    {comparison.result?.status === 'loading' && <p role="status">후보 경로를 계산하는 중입니다…</p>}
    {comparison.result?.status === 'error' && <p role="alert">경로를 계산하지 못했습니다. <button onClick={comparison.retry}>다시 시도</button></p>}
    {result && result.routes.length === 0 && <p role="status">선택한 두 교차로를 잇는 통행 가능한 경로가 없습니다.</p>}
    {result && result.routes.length > 0 && <>
      <p className="small-note">샘플 기준일 {result.reference_date} · {String(result.hour).padStart(2,'0')}:00 한국 표준시</p>
      <div className="route-options">{result.routes.map((route, index) => <button key={index} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>
        <strong>{index === 0 ? '가장 빠른 경로' : `대안 ${index}`}</strong>
        <span>총 {route.total_seconds}초 · {route.distance_m}m</span>
        <small>구간 {route.travel_seconds}초 · 신호 {route.signal_wait_seconds === null ? '자료 없음' : `${route.signal_wait_seconds}초 (${route.observed_signal_turns}곳)`}</small>
        {route.fallback_segments > 0 && <small>속도 30km/h로 추정한 구간 {route.fallback_segments}개</small>}
      </button>)}</div>
      <RouteMap routes={result.routes} selected={selected}/>
      <p className="small-note">경유 교차로 · {result.routes[selected].nodes.map(node => node.name).join(' → ')}</p>
      <p className="small-note">가상 기록이 있는 회전의 대기시간만 합산합니다.</p>
    </>}
  </section>
}

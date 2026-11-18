import { useCallback, useEffect, useMemo, useState } from 'react'
import CommercialMap, { type Position, type Store, type Vacancy } from './Map'
import { genDemo, summarize, recommend, PALETTE } from './model.mjs'
import { DEFAULT_ENDPOINT, fetchStoresOrDemo } from './api.mjs'
import './commercial.css'
const proxyAvailable = import.meta.env.VITE_COMMERCIAL_PROXY_ENABLED === 'true'
type Mode = 'demo'|'proxy'|'api'
export default function CommercialPage() {
  const [center,setCenter] = useState<Position>({lat:37.008,lng:127.2797})
  const [radius,setRadius] = useState(500)
  const [access,setAccess] = useState(60)
  const [mode,setMode] = useState<Mode>('demo')
  const [key,setKey] = useState('')
  const [endpoint,setEndpoint] = useState(DEFAULT_ENDPOINT)
  const [requestConfig,setRequestConfig] = useState({key:'',endpoint:DEFAULT_ENDPOINT})
  const [refresh,setRefresh] = useState(0)
  const [stores,setStores] = useState<Store[]>([])
  const [vacs,setVacs] = useState<Vacancy[]>([])
  const [hidden,setHidden] = useState<Set<string>>(new Set())
  const [selected,setSelected] = useState<string|null>(null)
  const [addMode,setAddMode] = useState(false)
  const [loading,setLoading] = useState(false)
  const [status,setStatus] = useState('')
  const [error,setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(false); setStatus('불러오는 중…'); setSelected(null)
    async function load() {
      try {
        if (mode === 'demo') {
          const data = genDemo(center,radius)
          setStores(data.stores)
          setVacs(current => [...data.vacs,...current.filter(v => v.id.startsWith('v'))])
          setStatus('데모 데이터입니다(가상). API 모드로 바꾸면 실제 상가정보를 조회합니다.')
        } else {
          const result = await fetchStoresOrDemo({...requestConfig,mode,center,radius},controller.signal)
          if (!controller.signal.aborted) {
            setStores(result.stores)
            setVacs(current => result.usedDummy ? [...result.vacs,...current.filter(v => v.id.startsWith('v'))] : current.filter(v => v.id.startsWith('v')))
            setStatus(result.usedDummy
              ? '연결된 상권 API가 없어 더미 데이터를 표시합니다.'
              : `상가 ${result.stores.length}곳을 불러왔습니다.${result.limited ? ' 최대 5페이지를 조회해 일부 결과만 표시합니다.' : ''}`)
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) { setStores([]); setError(true); setStatus(err instanceof Error ? err.message : '조회에 실패했습니다.') }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [center,radius,mode,requestConfig,refresh])
  const colors = useMemo(() => Object.fromEntries([...new Set(stores.map(s => s.cat))].map((cat,i) => [cat,PALETTE[i % PALETTE.length]])),[stores])
  const summary = useMemo(() => summarize(stores,center,radius),[stores,center,radius])
  const selectedVacancy = vacs.find(v => v.id === selected)
  const recs = useMemo(() => recommend(stores,selectedVacancy ?? center,selectedVacancy ? 300 : radius,access),[stores,center,radius,access,selectedVacancy])
  const counts = Object.entries(summary.counts) as [string,number][]
  const max = Math.max(1,...counts.map(([,count]) => count))
  const onMapClick = useCallback((point:Position) => {
    if (addMode) setVacs(current => [...current,{...point,id:'v'+crypto.randomUUID(),name:'공실 후보 '+(current.length+1),vacant:true}])
    else setCenter(point)
    setSelected(null)
  },[addMode])
  function analyze() { setRequestConfig({key,endpoint}); setRefresh(v => v+1) }
  return <div className="page-commercial">
    <header><h1>안성맞춤 AI · 상권 분석</h1><span>공실 처방 모듈 프로토타입 · 소상공인 상가(상권)정보 API 기반</span></header>
    <div className="wrap">
      <CommercialMap center={center} radius={radius} stores={stores} vacs={vacs} hidden={hidden} colors={colors} selected={selected} onMapClick={onMapClick} onSelect={setSelected}/>
      <div className="side">
        <section className="card"><h2>데이터 설정</h2>
          <label htmlFor="commercial-mode">데이터 모드</label>
          <select id="commercial-mode" value={mode} onChange={e => setMode(e.target.value as Mode)}>
            <option value="demo">데모 (가상 샘플 데이터)</option>
            <option value="proxy" disabled={!proxyAvailable}>공공데이터 API · 프록시 서버{!proxyAvailable ? ' (연결 미설정)' : ''}</option>
            <option value="api">공공데이터 API · 브라우저 직접 호출</option>
          </select>
          {!proxyAvailable && <div className="note">프록시 서버가 연결되지 않아 프록시 모드를 사용할 수 없습니다.</div>}
          {mode === 'proxy' && <div className="note">연결된 프록시 서버로 조회합니다. 서비스키는 해당 서버에서 관리합니다.</div>}
          {mode === 'api' && <div>
            <label htmlFor="commercial-key">공공데이터포털 서비스키</label><input id="commercial-key" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder="data.go.kr에서 발급받은 인증키"/>
            <label htmlFor="commercial-endpoint">반경 조회 엔드포인트</label><input id="commercial-endpoint" type="text" value={endpoint} onChange={e => setEndpoint(e.target.value)}/>
            <div className="note">서비스키는 저장하지 않습니다. 값을 입력한 뒤 ‘이 위치 분석’을 눌러 주세요. 브라우저 호출이 CORS로 차단되면 프록시가 필요합니다.</div>
          </div>}
          <label htmlFor="commercial-radius">분석 반경: {radius}m</label><input id="commercial-radius" type="range" min="200" max="1500" step="100" value={radius} onChange={e => setRadius(Number(e.target.value))}/>
          <label htmlFor="commercial-access">접근성 점수(신호 진단 연계 임시 입력): {access}</label><input id="commercial-access" type="range" min="0" max="100" step="5" value={access} onChange={e => setAccess(Number(e.target.value))}/>
          <div className="row" style={{marginTop:10}}><button className="pri" onClick={analyze} disabled={loading}>{loading ? '조회 중…' : '이 위치 분석'}</button><button className={addMode ? 'on' : ''} aria-pressed={addMode} onClick={() => setAddMode(v => !v)}>공실 추가 모드{addMode ? ' ON' : ''}</button></div>
          <div id="status" className={error ? 'err' : ''} role={error ? 'alert' : 'status'}>{status}</div>
          <div className="note">지도를 클릭하면 분석 중심이 이동합니다. ‘공실 추가 모드’에서는 클릭한 위치에 공실 후보가 추가됩니다. 공실 위치는 상가정보 API에 없으므로 별도 자료나 직접 입력이 필요합니다.</div>
        </section>
        <section className="card"><h2>상권 요약</h2><div className="kpis"><div className="kpi"><b>{summary.count}</b><small>업소 수</small></div><div className="kpi"><b>{summary.count ? summary.density : '-'}</b><small>업소/㎢</small></div><div className="kpi"><b>{summary.count ? summary.diversity : '-'}</b><small>업종 다양성(0~100)</small></div></div></section>
        <section className="card"><h2>업종 분포 <small style={{fontWeight:400,color:'var(--sub)'}}>(클릭하면 지도에서 숨김/표시)</small></h2>
          {counts.length ? counts.sort((a,b) => b[1]-a[1]).map(([cat,count]) => <button key={cat} className={`bar ${hidden.has(cat) ? 'off' : ''}`} aria-pressed={!hidden.has(cat)} onClick={() => setHidden(current => {const next = new Set(current); next.has(cat) ? next.delete(cat) : next.add(cat); return next})}><span>{cat}</span><i style={{width:count/max*100+'%',background:colors[cat]}}/><span>{count}</span></button>) : <div className="note">데이터가 없습니다.</div>}
        </section>
        <section className="card"><h2>적합 업종 추천 <small style={{fontWeight:400,color:'var(--sub)'}}>· {selectedVacancy ? selectedVacancy.name+' 반경 300m' : `분석 중심 반경 ${radius}m`}</small></h2>
          {recs[0]?.scope ? recs.map((rec,i) => <div className="rec" key={rec.cat}><span className="score">{rec.score}점</span><b>{i+1}. {rec.cat}</b><small>반경 내 {rec.n}곳({rec.pct}%) · 접근성 {access}</small></div>) : <div className="note">분석할 업소 데이터가 없습니다.</div>}
          <div className="note">현재는 업종 공급 공백과 접근성 점수를 합산하는 규칙 기반 점수입니다. 실제 매출이나 수익을 예측하지 않습니다.</div>
        </section>
        <section className="card"><h2>공실 후보</h2>{vacs.length ? vacs.map(v => <div className="vac" key={v.id}><span>{v.name}</span><span><button onClick={() => setSelected(v.id)}>분석</button> <button aria-label={`${v.name} 삭제`} onClick={() => {setVacs(current => current.filter(x => x.id !== v.id)); if (selected === v.id) setSelected(null)}}>삭제</button></span></div>) : <div className="note">공실 후보가 없습니다.</div>}</section>
      </div>
    </div>
  </div>
}

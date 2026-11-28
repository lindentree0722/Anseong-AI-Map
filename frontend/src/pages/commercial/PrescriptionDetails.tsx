import { useApiData } from '../../lib/use-api-data'
import type { Position, Vacancy } from './Map'

type DataStatus = 'sample' | 'reported' | 'mixed'
export type ListedVacancy = Vacancy & { confirmed_on: string; address: string | null }
export type VacancyListing = { source: string; data_status: DataStatus; items: ListedVacancy[] }
export type Prescription = {
  data_status: DataStatus
  vacancy_source: string
  vacancy_data_status: DataStatus
  nearby_stores: (Position & { id: string; name: string; category_name: string })[]
  nearby_store_count: number
  signal_average_wait_seconds: number | null
  sources: Record<string, { source: string; data_status: DataStatus; reference_date: string }>
  recommendations: {
    category_code: string
    category_name: string
    score: number
    nearby_store_count: number
    supply_gap_score: number
    pedestrian_fit_score: number | null
    facility_fit_score: number | null
    road_access_score: number | null
  }[]
}

export const vacancyApi = '/api/commercial-service/vacancies'
export const statusLabel: Record<DataStatus, string> = {
  sample: '가상 데이터', reported: '제공 자료', mixed: '가상·제공 자료 혼합',
}
const sourceLabel: Record<string, string> = {
  stores: '영업점', facilities: '시설', road_network: '도로망', road_traffic: '교통량·속도',
  pedestrians: '유동인구', signals: '신호 대기시간',
}

function points(score: number | null) {
  return score === null ? '자료 없음' : `${score}점`
}

export function PrescriptionDetails({vacancy, request}: {
  vacancy: ListedVacancy
  request: ReturnType<typeof useApiData<Prescription>>
}) {
  const {result, retry} = request
  const data = result?.status === 'ready' ? result.data : null
  return <section className="card" aria-label="공실 처방 결과">
    <h2>공실 처방 · {vacancy.name}</h2>
    <p className="note">{vacancy.address ? `${vacancy.address} · ` : ''}확인일 {vacancy.confirmed_on}</p>
    {result?.status === 'loading' && <p role="status">공실 처방을 불러오는 중입니다…</p>}
    {result?.status === 'error' && <p role="alert">공실 처방을 불러오지 못했습니다. <button onClick={retry}>다시 시도</button></p>}
    {data && <>
      <p className="note">{statusLabel[data.data_status]} · 반경 내 영업점 {data.nearby_store_count}곳</p>
      <p>주변 평균 신호 대기시간 <strong>{data.signal_average_wait_seconds === null ? '자료 없음' : `${data.signal_average_wait_seconds}초`}</strong></p>
      {data.recommendations.length ? data.recommendations.map(rec => <div className="rec" key={rec.category_code}>
        <span className="score">{rec.score}점</span><b>{rec.category_name}</b>
        <small>반경 내 {rec.nearby_store_count}곳 · 공급 공백 {points(rec.supply_gap_score)}</small>
        <small>유동인구 {points(rec.pedestrian_fit_score)} · 시설 {points(rec.facility_fit_score)} · 도로 접근성 {points(rec.road_access_score)}</small>
      </div>) : <p role="status">주변 영업점 자료가 부족해 추천할 수 없습니다.</p>}
      <details className="note">
        <summary>데이터 출처</summary>
        <ul>
          <li>공실 · {data.vacancy_source} · {statusLabel[data.vacancy_data_status]}</li>
          {Object.entries(data.sources).map(([key, source]) => <li key={key}>
            {sourceLabel[key] ?? key} · {source.source} · {statusLabel[source.data_status]} · {source.reference_date}
          </li>)}
        </ul>
      </details>
    </>}
  </section>
}

import { useState } from 'react'
import { useApiData } from '../../../lib/use-api-data'

type WaitTimes = {
  source: string
  reference_date: string
  hours: {
    intersection_id: string
    intersection_name: string
    observed_hour: string
    average_wait_seconds: number
    observation_count: number
  }[]
}

const seoulTime = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

export function SampleWaitTimes() {
  const [selection, setSelection] = useState('')
  const {result, retry} = useApiData<WaitTimes>('/api/traffic/signals/wait-times')
  const data = result?.status === 'ready' ? result.data : null
  const intersections = new Map(data?.hours.map(row => [row.intersection_id, row.intersection_name]))
  const selected = intersections.has(selection) ? selection : intersections.keys().next().value ?? ''
  const hours = data?.hours.filter(row => row.intersection_id === selected) ?? []

  return <section className="sample-waits">
    <h2>교차로 시간대별 대기시간</h2>
    <p>가상 데이터{data && ` · ${data.source} · ${data.reference_date}`}</p>
    {result?.status === 'loading' && <p role="status">신호 대기시간을 불러오는 중입니다…</p>}
    {result?.status === 'error' && <p role="alert">신호 대기시간을 불러오지 못했습니다. <button className="back-button" onClick={retry}>다시 시도</button></p>}
    {data && !hours.length && <p role="status">조회된 대기시간 자료가 없습니다.</p>}
    {hours.length > 0 && <>
      <label>교차로 <select value={selected} onChange={event => setSelection(event.target.value)}>
        {[...intersections].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <table aria-label="시간대별 평균 대기시간">
        <thead><tr><th scope="col">시간 (한국 표준시)</th><th scope="col">평균 대기</th><th scope="col">집계 건수</th></tr></thead>
        <tbody>{hours.map(row => <tr key={row.observed_hour}>
          <th scope="row">{seoulTime.format(new Date(row.observed_hour))}</th>
          <td>{row.average_wait_seconds}초</td><td>{row.observation_count}건</td>
        </tr>)}</tbody>
      </table>
    </>}
  </section>
}

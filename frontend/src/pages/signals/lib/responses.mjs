export async function readJson(response) {
  if (!response.ok) throw new Error(`신호 API 요청 실패 (HTTP ${response.status}). 서버 연결을 확인해 주세요.`)
  try { return await response.json() } catch { throw new Error('신호 API가 JSON 응답을 반환하지 않았습니다.') }
}
const statusValid = value => ['green', 'yellow', 'red', 'unknown'].includes(value)
const numberValid = value => value === null || (Number.isFinite(value) && value >= 0)
const signalValid = value => value && Number.isInteger(value.id) && typeof value.name === 'string' && typeof value.location === 'string' && statusValid(value.status) && numberValid(value.remaining_seconds) && typeof value.updated_at === 'string'
export function validateList(data) {
  if (!data || !Array.isArray(data.items) || !data.items.every(signalValid) || !Number.isInteger(data.total) || data.total < 0) throw new Error('신호 목록 응답 형식이 올바르지 않습니다.')
  return data
}
export function validateDetail(data) {
  if (!data || !signalValid(data.signal) || !Array.isArray(data.history) || !data.history.every(item => item && Number.isInteger(item.id) && statusValid(item.status) && numberValid(item.remaining_seconds) && typeof item.recorded_at === 'string')) throw new Error('신호 상세 응답 형식이 올바르지 않습니다.')
  return data
}

const dummySignals = [
  {id:1,source:'dummy',intersection_id:'ANS-001',name:'안성시청 사거리',location:'안성시 봉산동',status:'red',remaining_seconds:38,updated_at:'2026-11-18T20:00:00+09:00'},
  {id:2,source:'dummy',intersection_id:'ANS-002',name:'공도 터미널 교차로',location:'안성시 공도읍',status:'yellow',remaining_seconds:4,updated_at:'2026-11-18T20:00:00+09:00'},
  {id:3,source:'dummy',intersection_id:'ANS-003',name:'중앙대입구 교차로',location:'안성시 대덕면',status:'green',remaining_seconds:27,updated_at:'2026-11-18T20:00:00+09:00'},
  {id:4,source:'dummy',intersection_id:'ANS-005',name:'한경국립대 교차로',location:'안성시 중앙동',status:'red',remaining_seconds:19,updated_at:'2026-11-18T20:00:00+09:00'},
]

export function getDummySignalList(query = '', status = 'all') {
  const keyword = query.trim().toLowerCase()
  const items = dummySignals.filter(item =>
    (status === 'all' || item.status === status) &&
    (!keyword || `${item.name} ${item.location} ${item.id}`.toLowerCase().includes(keyword))
  )
  return { items, total: items.length }
}

export function getDummySignalDetail(id) {
  const signal = dummySignals.find(item => item.id === Number(id))
  if (!signal) throw new Error('더미 신호 정보를 찾을 수 없습니다.')
  const statuses = ['green', 'yellow', 'red']
  return {
    signal,
    history: statuses.map((status, index) => ({
      id: signal.id * 10 + index,
      status,
      remaining_seconds: [32, 4, 38][index],
      recorded_at: `2026-11-18T19:${String(45 + index * 5).padStart(2, '0')}:00+09:00`,
    })),
  }
}

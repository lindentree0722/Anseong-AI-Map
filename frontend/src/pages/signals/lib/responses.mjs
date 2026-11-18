export async function readJson(response) {
  if (!response.ok) throw new Error(`신호 API 요청 실패 (HTTP ${response.status}). 별도 API 서버를 확인해 주세요.`)
  try { return await response.json() } catch { throw new Error('신호 API가 JSON 응답을 반환하지 않았습니다.') }
}
const statusValid = value => ['green', 'yellow', 'red'].includes(value)
const numberValid = value => Number.isFinite(value) && value >= 0
const signalValid = value => value && Number.isInteger(value.id) && typeof value.name === 'string' && typeof value.location === 'string' && statusValid(value.status) && numberValid(value.remaining_seconds) && typeof value.updated_at === 'string'
export function validateList(data) {
  if (!data || !Array.isArray(data.items) || !data.items.every(signalValid) || !Number.isInteger(data.total) || data.total < 0) throw new Error('신호 목록 응답 형식이 올바르지 않습니다.')
  return data
}
export function validateDetail(data) {
  if (!data || !signalValid(data.signal) || !Array.isArray(data.history) || !data.history.every(item => item && Number.isInteger(item.id) && statusValid(item.status) && numberValid(item.remaining_seconds) && typeof item.recorded_at === 'string')) throw new Error('신호 상세 응답 형식이 올바르지 않습니다.')
  return data
}

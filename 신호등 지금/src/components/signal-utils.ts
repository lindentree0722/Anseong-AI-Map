export type SignalStatus = 'green' | 'yellow' | 'red'
export interface Signal {
  id: number
  name: string
  location: string
  status: SignalStatus
  remaining_seconds: number
  updated_at: string
  source?: string
  intersection_id?: string
  local_government?: string
}
export interface SignalHistory {
  id: number
  status: SignalStatus
  remaining_seconds: number
  recorded_at: string
  label?: string
}
export const statusMeta: Record<SignalStatus, { label: string; className: string }> = {
  green: { label: '초록불', className: 'green' }, yellow: { label: '노란불', className: 'yellow' }, red: { label: '빨간불', className: 'red' },
}
export const formatSeconds = (seconds: number) => {
  const minute = Math.floor(Math.max(seconds, 0) / 60)
  const second = Math.max(seconds, 0) % 60
  return minute ? `${minute}분 ${String(second).padStart(2, '0')}초` : `${second}초`
}
export const formatDate = (value: string) => {
  const date = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'))
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

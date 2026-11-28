export type SignalStatus = 'green' | 'yellow' | 'red' | 'unknown'
type ObservationStatus = 'fresh' | 'stale'

export interface Signal {
  id: number
  name: string
  location: string
  status: SignalStatus
  remaining_seconds: number | null
  updated_at: string
  source?: string
  intersection_id?: string
  movement_label?: string
  observation_status?: ObservationStatus
  latitude?: number | null
  longitude?: number | null
}
export interface SignalHistory {
  id: number
  status: SignalStatus
  remaining_seconds: number | null
  recorded_at: string
  label?: string
}

export const observationLabel: Record<ObservationStatus, string> = {
  fresh: '최근 관측',
  stale: '이전 관측',
}

export const statusMeta: Record<SignalStatus, { label: string; className: string }> = {
  green: { label: '초록불', className: 'green' },
  yellow: { label: '노란불', className: 'yellow' },
  red: { label: '빨간불', className: 'red' },
  unknown: { label: '자료 없음', className: 'unknown' },
}

export function formatSeconds(seconds: number | null) {
  if (seconds === null) return '자료 없음'
  const minute = Math.floor(Math.max(seconds, 0) / 60)
  const second = Math.max(seconds, 0) % 60
  return minute ? `${minute}분 ${String(second).padStart(2, '0')}초` : `${second}초`
}

const observationDate = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

export function formatDate(value: string) {
  const iso = value.replace(' ', 'T')
  // The existing mock and locally stored UTC timestamps can be timezone-naive.
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(iso) ? iso : `${iso}Z`)
  return Number.isNaN(date.getTime()) ? '시각 없음' : observationDate.format(date)
}

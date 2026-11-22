/** @typedef {import('../components/signal-utils').Signal} Signal */
/** @typedef {import('../components/signal-utils').SignalHistory} SignalHistory */

const signals = [
  { id: 1001, name: '안성시청 사거리', location: '봉산동 · 중앙로', status: 'red', remaining_seconds: 38, updated_at: '2026-11-18T06:40:00Z', source: 'DEMO', intersection_id: 'ANS-001' },
  { id: 1002, name: '공도 터미널 교차로', location: '공도읍 · 서동대로', status: 'green', remaining_seconds: 24, updated_at: '2026-11-18T06:40:00Z', source: 'DEMO', intersection_id: 'ANS-002' },
  { id: 1003, name: '중앙대입구 교차로', location: '대덕면 · 대학로', status: 'green', remaining_seconds: 31, updated_at: '2026-11-18T06:40:00Z', source: 'DEMO', intersection_id: 'ANS-003' },
  { id: 1004, name: '안성IC 진입 교차로', location: '금광면 · 안성IC', status: 'red', remaining_seconds: 52, updated_at: '2026-11-18T06:40:00Z', source: 'DEMO', intersection_id: 'ANS-004' },
  { id: 1005, name: '한경국립대 인근', location: '중앙동 · 한경국립대', status: 'yellow', remaining_seconds: 6, updated_at: '2026-11-18T06:40:00Z', source: 'DEMO', intersection_id: 'ANS-005' },
]

const histories = {
  1001: [
    { id: 10011, status: 'red', remaining_seconds: 38, recorded_at: '2026-11-18T06:40:00Z', label: '북쪽 직진' },
    { id: 10012, status: 'yellow', remaining_seconds: 6, recorded_at: '2026-11-18T06:39:20Z', label: '북쪽 직진' },
    { id: 10013, status: 'green', remaining_seconds: 22, recorded_at: '2026-11-18T06:39:14Z', label: '북쪽 직진' },
  ],
  1002: [
    { id: 10021, status: 'green', remaining_seconds: 24, recorded_at: '2026-11-18T06:40:00Z', label: '북쪽 직진' },
    { id: 10022, status: 'yellow', remaining_seconds: 6, recorded_at: '2026-11-18T06:39:36Z', label: '북쪽 직진' },
    { id: 10023, status: 'red', remaining_seconds: 32, recorded_at: '2026-11-18T06:39:30Z', label: '북쪽 직진' },
  ],
  1003: [
    { id: 10031, status: 'green', remaining_seconds: 31, recorded_at: '2026-11-18T06:40:00Z', label: '북쪽 직진' },
    { id: 10032, status: 'yellow', remaining_seconds: 5, recorded_at: '2026-11-18T06:39:29Z', label: '북쪽 직진' },
    { id: 10033, status: 'red', remaining_seconds: 28, recorded_at: '2026-11-18T06:39:24Z', label: '북쪽 직진' },
  ],
  1004: [
    { id: 10041, status: 'red', remaining_seconds: 52, recorded_at: '2026-11-18T06:40:00Z', label: '북쪽 직진' },
    { id: 10042, status: 'yellow', remaining_seconds: 6, recorded_at: '2026-11-18T06:39:08Z', label: '북쪽 직진' },
    { id: 10043, status: 'green', remaining_seconds: 18, recorded_at: '2026-11-18T06:39:02Z', label: '북쪽 직진' },
  ],
  1005: [
    { id: 10051, status: 'yellow', remaining_seconds: 6, recorded_at: '2026-11-18T06:40:00Z', label: '북쪽 직진' },
    { id: 10052, status: 'green', remaining_seconds: 27, recorded_at: '2026-11-18T06:39:54Z', label: '북쪽 직진' },
    { id: 10053, status: 'red', remaining_seconds: 35, recorded_at: '2026-11-18T06:39:27Z', label: '북쪽 직진' },
  ],
}

/**
 * @param {{q?: string, status?: string, limit?: number, offset?: number}} options
 * @returns {{items: Signal[], total: number}}
 */
export function listDemoSignals({ q = '', status = 'all', limit = 20, offset = 0 } = {}) {
  const query = q.trim().toLocaleLowerCase()
  const filtered = signals.filter(signal => {
    const matchesQuery = !query || [signal.name, signal.location, signal.intersection_id]
      .some(value => value.toLocaleLowerCase().includes(query))
    return matchesQuery && (status === 'all' || signal.status === status)
  })
  return { items: filtered.slice(offset, offset + limit), total: filtered.length }
}

/**
 * @param {number|string} id
 * @returns {{signal: Signal, history: SignalHistory[]}}
 */
export function getDemoSignalDetail(id) {
  const signal = signals.find(item => item.id === Number(id))
  if (!signal) throw new Error('더미 신호 정보를 찾을 수 없습니다.')
  return { signal, history: histories[signal.id] }
}

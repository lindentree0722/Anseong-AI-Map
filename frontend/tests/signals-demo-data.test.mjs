import test from 'node:test'
import assert from 'node:assert/strict'
import { getDemoSignalDetail, listDemoSignals } from '../src/pages/signals/lib/demo-data.mjs'

test('더미 신호는 교통 시뮬레이션 교차로 ID와 연결된다', () => {
  const result = listDemoSignals({ q: 'ANS-003' })
  assert.equal(result.total, 1)
  assert.equal(result.items[0].name, '중앙대입구 교차로')
  assert.equal(result.items[0].intersection_id, 'ANS-003')
})

test('상태 필터와 페이지 범위로 더미 신호 목록을 조회한다', () => {
  const result = listDemoSignals({ status: 'red', limit: 1, offset: 1 })
  assert.equal(result.total, 2)
  assert.equal(result.items.length, 1)
})

test('더미 신호 상세에는 저장 시점 이력이 포함된다', () => {
  const result = getDemoSignalDetail(1001)
  assert.equal(result.signal.intersection_id, 'ANS-001')
  assert.equal(result.history.length, 3)
  assert.throws(() => getDemoSignalDetail(9999), /찾을 수 없습니다/)
})

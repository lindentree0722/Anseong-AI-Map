import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readJson, validateList, validateDetail } from '../src/pages/signals/lib/responses.mjs'
import * as responses from '../src/pages/signals/lib/responses.mjs'
test('빈 목록은 유효하지만 잘못된 상태와 개수는 거부한다', () => {
  assert.deepEqual(validateList({items:[],total:0}), {items:[],total:0})
  assert.throws(() => validateList({items:[{status:'unknown'}],total:1}))
  assert.throws(() => validateList({items:[],total:-1}))
})
test('HTML 프록시 오류와 HTTP 실패를 사용자 오류로 변환한다', async () => {
  await assert.rejects(readJson(new Response('bad gateway', {status:502})), /502/)
  await assert.rejects(readJson(new Response('<html>fallback</html>')), /JSON/)
})
test('상세 정보의 방향별 신호 상태를 검증한다', () => {
  const signal = {id:1,name:'교차로',location:'안성',status:'red',remaining_seconds:10,updated_at:'2026-11-18'}
  assert.equal(validateDetail({signal,history:[]}).signal, signal)
  assert.throws(() => validateDetail({signal,history:[{id:1,status:'purple',remaining_seconds:1,recorded_at:'now'}]}))
})
test('신호 API가 없을 때 검색과 상세 화면에 사용할 더미 데이터를 제공한다', () => {
  assert.equal(typeof responses.getDummySignalList, 'function')
  const all = responses.getDummySignalList('', 'all')
  const filtered = responses.getDummySignalList('안성시청', 'red')
  assert.ok(all.total >= 3)
  assert.deepEqual(filtered.items.map(item => item.name), ['안성시청 사거리'])

  const detail = responses.getDummySignalDetail(filtered.items[0].id)
  assert.equal(detail.signal.id, filtered.items[0].id)
  assert.equal(detail.signal.source, 'dummy')
  assert.ok(detail.history.length > 0)
})
test('관측 방향의 상태나 잔여시간이 누락돼도 샘플로 대체하지 않는다', () => {
  const signal = {id:-1,name:'안성 교차로',location:'안성시',status:'unknown',
    remaining_seconds:null,updated_at:'2026-11-24T08:00:00+09:00',observation_status:'stale'}
  const history = [{id:1,status:'unknown',remaining_seconds:null,recorded_at:signal.updated_at}]
  assert.equal(validateList({items:[signal],total:1}).items[0], signal)
  assert.deepEqual(validateDetail({signal,history}).history,history)
  assert.throws(() => validateList({items:[{...signal,remaining_seconds:-1}],total:1}))
})

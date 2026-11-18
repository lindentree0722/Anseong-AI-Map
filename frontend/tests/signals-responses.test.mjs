import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readJson, validateList, validateDetail } from '../src/pages/signals/lib/responses.mjs'
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

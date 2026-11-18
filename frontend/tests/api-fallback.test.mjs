import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchTrafficOverview } from '../src/pages/traffic/services/trafficService.js'

test('교통 API가 없으면 화면에서 사용할 수 있는 더미 응답을 반환한다', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }))

  const result = await fetchTrafficOverview(new AbortController().signal)

  assert.equal(result.dataStatus, 'sample')
  assert.equal(result.source, '프런트엔드 더미 데이터')
  assert.ok(result.intersections.length > 0)
  assert.ok(result.intersections.every(item => item.position.length === 2 && item.diagnosis.level))
  assert.ok(result.hourlyTraffic.length > 0)
})

test('교통 API가 정상 응답하면 API 데이터를 그대로 사용한다', async t => {
  const payload = { dataStatus: 'observed', source: 'API', intersections: [] }
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload))

  assert.deepEqual(await fetchTrafficOverview(new AbortController().signal), payload)
})

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {genDemo,parseItems,summarize,recommend,dist} from '../src/pages/commercial/model.mjs'
import {buildStoreUrl,fetchStores} from '../src/pages/commercial/api.mjs'
const center = {lat:37.008,lng:127.2797}
test('동일 위치의 데모 생성은 재현 가능하고 기존 반경별 개수를 유지한다', () => {
  const data = genDemo(center,500)
  assert.deepEqual(data,genDemo(center,500))
  assert.equal(data.stores.length,150); assert.equal(data.vacs.length,6)
  assert.ok(data.vacs.every(v => dist(center,v) < 500))
})
test('상권 API 단건·배열을 처리하고 빈 좌표와 잘못된 응답을 걸러낸다', () => {
  const item = {bizesNm:'상점',lat:'37.008',lon:'127.2797',indsLclsNm:'음식'}
  const wrap = items => ({response:{header:{resultCode:'00'},body:{items}}})
  assert.equal(parseItems(wrap({item})).length,1)
  assert.equal(parseItems(wrap({item:[item,{...item,lat:''},{...item,lon:999}]})).length,1)
  assert.deepEqual(parseItems(wrap('')),[])
  assert.throws(() => parseItems({response:{header:{resultCode:'99'}}}))
  assert.throws(() => parseItems({unexpected:true}))
})
test('반경·밀도·다양성과 기존 추천 점수를 계산한다', () => {
  const stores = [{...center,name:'A',cat:'음식'},{...center,name:'B',cat:'소매'},{lat:0,lng:0,name:'외부',cat:'음식'}]
  const summary = summarize(stores,center,500)
  assert.equal(summary.count,2); assert.equal(summary.density,3); assert.equal(summary.diversity,100)
  assert.equal(recommend(stores,center,500,60)[0].score,88)
  assert.equal(summarize([],center,500).count,0)
  assert.equal(recommend([],center,500,60)[0].scope,0)
})
test('서비스키 인코딩과 프록시 경로를 분리한다', () => {
  const options = {mode:'api',endpoint:'https://example.com/store',key:'a%2Bb%3D',center,radius:500,page:1}
  const url = new URL(buildStoreUrl(options))
  assert.equal(url.searchParams.get('serviceKey'),'a+b=')
  assert.equal(url.searchParams.get('cx'),'127.2797')
  const proxy = buildStoreUrl({...options,mode:'proxy'})
  assert.ok(proxy.startsWith('/api/commercial-service/storeListInRadius?'))
  assert.ok(!proxy.includes('serviceKey'))
  assert.throws(() => buildStoreUrl({...options,key:''}))
})
test('API 오류 응답의 내용에 키가 있어도 사용자 오류에 노출하지 않는다', async t => {
  t.mock.method(globalThis,'fetch',async () => new Response('sensitive-key',{status:403}))
  await assert.rejects(fetchStores({mode:'proxy',endpoint:'',key:'',center,radius:500},new AbortController().signal), error => error.message.includes('403') && !error.message.includes('sensitive'))
})

import { genDemo, parseItems } from './model.mjs'
import { loadApiOrDummy } from '../../lib/api-fallback.mjs'
export const DEFAULT_ENDPOINT = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius'
export function buildStoreUrl({mode, endpoint, key, center, radius, page}) {
  const base = mode === 'proxy' ? '/api/commercial-service/storeListInRadius' : endpoint.trim()
  if (mode !== 'proxy' && !key.trim()) throw new Error('서비스키를 입력해 주세요.')
  if (mode !== 'proxy' && !/^https?:\/\//.test(base)) throw new Error('HTTP 또는 HTTPS 엔드포인트를 입력해 주세요.')
  const url = new URL(base, 'http://localhost')
  const params = {pageNo:String(page),numOfRows:'1000',radius:String(radius),cx:String(center.lng),cy:String(center.lat),type:'json'}
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v)
  if (mode !== 'proxy') {
    let decoded = key.trim()
    try { decoded = decodeURIComponent(decoded) } catch { /* 일반 키는 그대로 사용 */ }
    url.searchParams.set('serviceKey', decoded)
  }
  return mode === 'proxy' ? url.pathname + url.search : url.toString()
}
export async function fetchStores(options, signal) {
  let stores = []
  for (let page = 1; page <= 5; page++) {
    const url = buildStoreUrl({...options,page})
    let response
    try { response = await fetch(url, {signal}) } catch (error) {
      if (signal.aborted) throw error
      throw new Error('상권 API에 연결하지 못했습니다. 서버와 CORS 설정을 확인해 주세요.')
    }
    if (!response.ok) throw new Error(`상권 API 요청 실패 (HTTP ${response.status})`)
    let payload
    try { payload = await response.json() } catch { throw new Error('상권 API가 JSON 응답을 반환하지 않았습니다.') }
    const rows = parseItems(payload)
    stores = stores.concat(rows)
    const raw = payload.response.body.items
    const rawItems = Array.isArray(raw) ? raw : raw?.item
    const received = Array.isArray(rawItems) ? rawItems.length : rawItems ? 1 : 0
    if (received < 1000) return {stores,limited:false}
  }
  return {stores,limited:true}
}

export async function fetchStoresOrDemo(options, signal) {
  const result = await loadApiOrDummy(
    () => fetchStores(options, signal),
    () => ({...genDemo(options.center, options.radius), limited:false}),
  )
  return {...result.data, usedDummy:result.usedDummy}
}

export const BASELINE = ['음식','소매','생활서비스','교육','의료·보건','숙박','여가·오락']
export const PALETTE = ['#e4572e','#17bebb','#e6a700','#76b041','#6a4c93','#2e86ab','#f18f01','#c73e1d','#3b8ea5','#8d99ae']
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function dist(a,b){const R=6371000,t=Math.PI/180,dLa=(b.lat-a.lat)*t,dLo=(b.lng-a.lng)*t;
  const h=Math.sin(dLa/2)**2+Math.cos(a.lat*t)*Math.cos(b.lat*t)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
export function genDemo(center, radius) {
  const r = rng(Math.round(center.lat*1e4)*7919 + Math.round(center.lng*1e4));
  const weights = {'음식':34,'소매':26,'생활서비스':14,'교육':9,'의료·보건':7,'숙박':3,'여가·오락':4};
  const cats = Object.keys(weights), tot = Object.values(weights).reduce((a,b)=>a+b,0);
  const rad = radius, out = [];
  const n = Math.round(60 + rad*0.18);
  for(let i=0;i<n;i++){
    let x=r()*tot, c=cats[0]; for(const k of cats){ if((x-=weights[k])<0){c=k;break;} }
    const d=Math.sqrt(r())*rad, a=r()*Math.PI*2;
    out.push({name:c+' 예시 '+(i+1),cat:c,lat:center.lat+(d*Math.cos(a))/111320,lng:center.lng+(d*Math.sin(a))/(111320*Math.cos(center.lat*Math.PI/180))});
  }
  const vac=[];
  for(let i=0;i<6;i++){const d=Math.sqrt(r())*rad*0.9,a=r()*Math.PI*2;
    vac.push({id:'d'+i,name:'공실 후보 '+(i+1),lat:center.lat+(d*Math.cos(a))/111320,lng:center.lng+(d*Math.sin(a))/(111320*Math.cos(center.lat*Math.PI/180)),vacant:true});}
  return {stores:out,vacs:vac};
}
export function parseItems(payload) {
  const code = payload?.response?.header?.resultCode
  if (code && code !== '00') throw new Error('상권 API가 오류를 반환했습니다. 서비스키와 이용 승인을 확인해 주세요.')
  const body = payload?.response?.body
  if (!body || typeof body !== 'object') throw new Error('상권 API 응답 형식이 올바르지 않습니다.')
  let items = body.items
  if (items == null || items === '') return []
  if (!Array.isArray(items)) items = items.item ?? []
  if (!Array.isArray(items)) items = [items]
  return items.filter(o => o && o.lat != null && o.lon != null && String(o.lat).trim() && String(o.lon).trim()).map(o => ({
    name: String(o.bizesNm ?? '이름 없음'), cat: String(o.indsLclsNm || '기타'),
    sub: String(o.indsSclsNm ?? ''), addr: String(o.rdnmAdr ?? ''), lat: Number(o.lat), lng: Number(o.lon),
  })).filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Math.abs(s.lat) <= 90 && Math.abs(s.lng) <= 180)
}
export function within(stores, center, radius) { return stores.filter(s => dist(center, s) <= radius) }
export function countBy(stores) {
  const result = Object.create(null)
  for (const store of stores) result[store.cat] = (result[store.cat] || 0) + 1
  return result
}
export function summarize(stores, center, radius) {
  const list = within(stores, center, radius), counts = countBy(list), n = list.length, categories = Object.keys(counts)
  const entropy = n && categories.length > 1 ? -categories.reduce((sum, k) => sum + counts[k] / n * Math.log(counts[k] / n), 0) : 0
  return { count:n, density: n ? Math.round(n / (Math.PI * (radius / 1000) ** 2)) : 0,
    diversity: categories.length > 1 ? Math.round(entropy / Math.log(categories.length) * 100) : 0, counts }
}
export function recommend(stores, center, radius, access) {
  const list = within(stores, center, radius), counts = countBy(list), total = list.length || 1
  const cats = [...new Set([...BASELINE,...stores.map(s => s.cat)])], ideal = 1 / cats.length
  return cats.map(cat => {
    const n = counts[cat] || 0, share = n / total, gap = Math.max(0, 1 - share / ideal)
    return {cat,n,pct:Math.round(share * 100),score:Math.round(gap * 70 + access * .3),scope:list.length}
  }).sort((a,b) => b.score - a.score).slice(0,3)
}

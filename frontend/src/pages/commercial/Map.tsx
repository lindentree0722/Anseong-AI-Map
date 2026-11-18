import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
export type Position = {lat:number; lng:number}
export type Store = Position & {name:string; cat:string; sub?:string; addr?:string}
export type Vacancy = Position & {id:string; name:string; vacant?:boolean}
type Props = {center:Position; radius:number; stores:Store[]; vacs:Vacancy[]; hidden:Set<string>; colors:Record<string,string>; selected:string|null; onMapClick:(point:Position)=>void; onSelect:(id:string)=>void}
function popup(title:string, text='') {
  const element = document.createElement('div'), strong = document.createElement('strong')
  strong.textContent = title; element.append(strong)
  if (text) { element.append(document.createElement('br'), document.createTextNode(text)) }
  return element
}
export default function CommercialMap({center,radius,stores,vacs,hidden,colors,selected,onMapClick,onSelect}:Props) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map|null>(null)
  const [tileError,setTileError] = useState(false)
  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current).setView([37.008,127.2797],15)
    map.current = instance
    const street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'}).addTo(instance)
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'})
    const onError = () => setTileError(true)
    street.on('tileerror',onError); osm.on('tileerror',onError)
    instance.on('baselayerchange', () => setTileError(false))
    L.control.layers({'Esri 거리지도':street,'OpenStreetMap':osm}).addTo(instance)
    const observer = new ResizeObserver(() => instance.invalidateSize())
    observer.observe(container.current)
    return () => { observer.disconnect(); instance.remove(); map.current = null }
  }, [])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const listener = (event:L.LeafletMouseEvent) => onMapClick({lat:event.latlng.lat,lng:event.latlng.lng})
    instance.on('click',listener)
    return () => { instance.off('click',listener) }
  }, [onMapClick])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const layer = L.layerGroup().addTo(instance)
    L.circle([center.lat,center.lng],{radius,color:'#2563eb',weight:1,fillOpacity:.05}).addTo(layer)
    L.circleMarker([center.lat,center.lng],{radius:5,color:'#2563eb',fillOpacity:1}).addTo(layer)
    for (const store of stores) {
      if (hidden.has(store.cat)) continue
      L.circleMarker([store.lat,store.lng],{radius:4,color:'#fff',weight:1,fillColor:colors[store.cat],fillOpacity:.9})
        .bindPopup(popup(store.name,[store.cat,store.sub,store.addr].filter(Boolean).join(' · '))).addTo(layer)
    }
    for (const vacancy of vacs) {
      L.marker([vacancy.lat,vacancy.lng],{icon:L.divIcon({className:'',html:'<div class="vicon"></div>',iconSize:[16,16]}),bubblingMouseEvents:false})
        .bindPopup(popup(vacancy.name)).on('click',() => onSelect(vacancy.id)).addTo(layer)
    }
    return () => { layer.remove() }
  }, [center,radius,stores,vacs,hidden,colors,onSelect])
  useEffect(() => {
    const vacancy = vacs.find(v => v.id === selected)
    if (vacancy) map.current?.panTo([vacancy.lat,vacancy.lng])
  }, [selected,vacs])
  return <div id="map" ref={container} aria-label="상권 및 공실 후보 지도">{tileError && <div className="map-error" role="status">배경 지도를 불러오지 못했습니다. 네트워크를 확인하거나 다른 지도 레이어를 선택해 주세요.</div>}</div>
}

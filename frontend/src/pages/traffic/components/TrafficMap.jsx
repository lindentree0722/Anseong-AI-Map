import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ANSEONG_MAP_BOUNDS, ANSEONG_MAP_CENTER, ANSEONG_MAP_MAX_ZOOM, ANSEONG_MAP_MIN_ZOOM } from "../../../shared/anseong-map";
import { statusMeta } from "../../signals/components/signal-utils";

const positions = {
  "ANS-001": [37.008, 127.2797],
  "ANS-002": [36.998, 127.172],
  "ANS-003": [36.835, 127.177],
  "ANS-004": [37.05, 127.302],
  "ANS-005": [37.011, 127.263]
};

function markerColor(congestion) {
  return congestion >= 75 ? "#f17b80" : congestion >= 50 ? "#e8b85f" : "#65c99b";
}

export default function TrafficMap({ intersections, signals, selectedId, onSelect }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      maxBounds: ANSEONG_MAP_BOUNDS,
      maxBoundsViscosity: 1,
      minZoom: ANSEONG_MAP_MIN_ZOOM,
      maxZoom: ANSEONG_MAP_MAX_ZOOM,
      scrollWheelZoom: true
    }).setView(ANSEONG_MAP_CENTER, 11);
    const markerLayer = L.layerGroup().addTo(instance);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: ANSEONG_MAP_MAX_ZOOM,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(instance);
    map.current = instance;
    markers.current = markerLayer;
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markers.current) return;
    markers.current.clearLayers();
    intersections.forEach(item => {
      const position = positions[item.id];
      if (!position) return;
      const selected = item.id === selectedId;
      const signal = signals.find(entry => entry.intersection_id === item.id);
      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.name;
      popup.append(title, document.createElement("br"), document.createTextNode(`${item.area} · 혼잡 ${item.congestion}/100 · ${signal ? `신호 ${statusMeta[signal.status].label}` : "신호 정보 미연계"} · 시뮬레이션 위치`));
      L.circleMarker(position, {
        radius: selected ? 9 : 7,
        color: "#fff",
        weight: 2,
        fillColor: markerColor(item.congestion),
        fillOpacity: 0.95
      }).bindPopup(popup).on("click", () => onSelect(item.id)).addTo(markers.current);
    });
  }, [intersections, signals, selectedId, onSelect]);

  useEffect(() => {
    const position = positions[selectedId];
    if (position) map.current?.panTo(position, { animate: true });
  }, [selectedId]);

  return <div className="traffic-map-wrap">
    <div className="map-panel" ref={container} aria-label="안성시 교통 시뮬레이션 지도"/>
    <div className="traffic-map-legend" aria-label="혼잡도 범례">
      <span><i className="dot bad-dot"/>혼잡</span>
      <span><i className="dot warn-dot"/>주의</span>
      <span><i className="dot good-dot"/>원활</span>
    </div>
  </div>;
}
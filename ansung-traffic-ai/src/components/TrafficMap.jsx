import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const ANSEONG_BOUNDS = [
  [36.8939866, 127.1020157],
  [37.1558891, 127.5165912]
];

function MapViewport({ intersections, selectedId }) {
  const map = useMap();
  const previousSelectedId = useRef(selectedId);
  const focused = intersections.find(item => item.id === selectedId) || intersections[0];

  useEffect(() => {
    map.fitBounds(ANSEONG_BOUNDS, { padding: [12, 12] });
  }, [map]);

  useEffect(() => {
    if (previousSelectedId.current !== selectedId && focused) {
      map.flyTo(focused.position, Math.max(map.getZoom(), 13), { duration: 0.5 });
    }
    previousSelectedId.current = selectedId;
  }, [focused, map, selectedId]);

  return null;
}

export default function TrafficMap({ intersections, selectedId, onSelect }) {
  return <div className="map-panel">
    <MapContainer
      className="leaflet-map"
      center={[37.02493785, 127.30930345]}
      zoom={9}
      minZoom={9}
      maxBounds={ANSEONG_BOUNDS}
      maxBoundsViscosity={1}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewport intersections={intersections} selectedId={selectedId} />
      {intersections.map(item => {
        const color = item.congestion >= 75 ? "#f17b80" : item.congestion >= 50 ? "#e8b85f" : "#65c99b";
        const selected = selectedId === item.id;

        return <CircleMarker
          key={item.id}
          center={item.position}
          radius={selected ? 10 : 8}
          pathOptions={{ color: "#ffffff", weight: selected ? 3 : 2, fillColor: color, fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelect(item.id) }}
        >
          <Popup>
            <strong>{item.name}</strong><br />
            {item.area} · 혼잡도 {item.congestion}/100<br />
            평균 대기 {item.averageWait}초
          </Popup>
        </CircleMarker>;
      })}
    </MapContainer>
    <div className="map-legend"><span><i className="dot bad-dot"/>혼잡</span><span><i className="dot warn-dot"/>주의</span><span><i className="dot good-dot"/>원활</span></div>
    <div className="map-disclaimer">지도: OpenStreetMap · 위치/교통량은 시뮬레이션</div>
  </div>;
}

function pinPosition(index) {
  const positions = [
    { left: "22%", top: "28%" }, { left: "62%", top: "22%" },
    { left: "42%", top: "55%" }, { left: "76%", top: "68%" },
    { left: "18%", top: "76%" }
  ];
  return positions[index % positions.length];
}

export default function TrafficMap({ intersections, selectedId, onSelect }) {
  return <div className="map-panel">
    <div className="map-grid"/>
    <div className="map-road road-a"/><div className="map-road road-b"/><div className="map-road road-c"/>
    <div className="map-label label-one">안성시 시뮬레이션 지도</div>
    <div className="map-label label-two">북</div>
    {intersections.map((item, i) => {
      const pos = pinPosition(i);
      return <button key={item.id} className={`map-pin ${item.congestion >= 75 ? "bad" : item.congestion >= 50 ? "warn" : "good"} ${selectedId === item.id ? "selected" : ""}`}
        style={pos} onClick={() => onSelect(item.id)} title={item.name}>
        <span/>{i + 1}
      </button>;
    })}
    <div className="map-legend"><span><i className="dot bad-dot"/>혼잡</span><span><i className="dot warn-dot"/>주의</span><span><i className="dot good-dot"/>원활</span></div>
    <div className="map-disclaimer">실제 지도가 아닌 교차로 배치 예시 · 시뮬레이션</div>
  </div>;
}
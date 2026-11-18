import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

export default function DiagnosisPanel({ item, diagnosis }) {
  const directions = [
    ["북쪽", item.directions?.north],
    ["동쪽", item.directions?.east],
    ["남쪽", item.directions?.south],
    ["서쪽", item.directions?.west]
  ].filter(([, volume]) => Number.isFinite(volume) && volume >= 0);
  const directionTotal = directions.reduce((sum, [, volume]) => sum + volume, 0);
  const peakVolume = Math.max(1, ...directions.map(([, volume]) => volume));
  const busiestDirection = [...directions].sort((a, b) => b[1] - a[1])[0];

  return <section className="panel diagnosis-panel">
    <div className="panel-heading"><div><div className="eyebrow">AI TRAFFIC DIAGNOSIS</div><h2>교차로 진단 결과</h2></div>
      <span className={`status-pill ${item.congestion >= 75 ? "red" : item.congestion >= 50 ? "yellow" : "green"}`}>{diagnosis.level}</span>
    </div>
    <div className="diagnosis-intro"><AlertTriangle size={19}/><div><strong>{item.name}</strong><p>{item.area} · 혼잡도 {item.congestion}/100 · 평균 대기 {item.averageWait}초</p></div></div>
    <div className="direction-volume-block">
      <div className="direction-volume-heading"><b>방향별 교통량</b><span>{item.trafficVolume.toLocaleString()}대/시간</span></div>
      {directions.length ? <>
        <p>최다 흐름: {busiestDirection[0]} · {directionTotal ? Math.round(busiestDirection[1] / directionTotal * 100) : 0}%</p>
        <div className="direction-volume-list">{directions.map(([direction, volume]) => <div className="direction-volume-row" key={direction}>
          <span>{direction}</span><div className="direction-volume-track"><i style={{width: `${volume / peakVolume * 100}%`}}/></div><b>{volume.toLocaleString()}</b>
        </div>)}</div>
      </> : <p>방향별 교통량 데이터가 없습니다.</p>}
    </div>
    <h3 className="subheading">주요 진단</h3>
    <ul className="diagnosis-list">{diagnosis.findings.map((x, i) => <li key={i}>{x}</li>)}</ul>
    <h3 className="subheading"><Lightbulb size={15}/> 개선 검토 제안</h3>
    <ul className="action-list">{diagnosis.actions.map((x, i) => <li key={i}><CheckCircle2 size={15}/>{x}</li>)}</ul>
    <p className="small-note">{diagnosis.note}</p>
  </section>;
}
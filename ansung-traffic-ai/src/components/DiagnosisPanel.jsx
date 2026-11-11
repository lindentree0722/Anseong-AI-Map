import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

export default function DiagnosisPanel({ item, diagnosis }) {
  return <section className="panel diagnosis-panel">
    <div className="panel-heading"><div><div className="eyebrow">AI TRAFFIC DIAGNOSIS</div><h2>교차로 진단 결과</h2></div>
      <span className={`status-pill ${item.congestion >= 75 ? "red" : item.congestion >= 50 ? "yellow" : "green"}`}>{diagnosis.level}</span>
    </div>
    <div className="diagnosis-intro"><AlertTriangle size={19}/><div><strong>{item.name}</strong><p>{item.area} · 혼잡도 {item.congestion}/100 · 평균 대기 {item.averageWait}초</p></div></div>
    <h3 className="subheading">주요 진단</h3>
    <ul className="diagnosis-list">{diagnosis.findings.map((x, i) => <li key={i}>{x}</li>)}</ul>
    <h3 className="subheading"><Lightbulb size={15}/> 개선 검토 제안</h3>
    <ul className="action-list">{diagnosis.actions.map((x, i) => <li key={i}><CheckCircle2 size={15}/>{x}</li>)}</ul>
    <p className="small-note">{diagnosis.note}</p>
  </section>;
}
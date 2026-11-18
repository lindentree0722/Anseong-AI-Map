import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

export default function DiagnosisPanel({ item, diagnosis }) {
  return <section className="panel diagnosis-panel">
    <div className="panel-heading"><div><div className="eyebrow">SIGNAL DIAGNOSIS</div><h2>교차로 진단 결과</h2></div>
      <span className={`status-pill ${diagnosis.level === "개선 검토 필요" ? "red" : diagnosis.level === "관찰 필요" ? "yellow" : diagnosis.level === "양호" ? "green" : ""}`}>{diagnosis.level}</span>
    </div>
    <div className="diagnosis-intro"><AlertTriangle size={19}/><div><strong>{item.name}</strong><p>{item.area} · 혼잡도 {item.congestion == null ? "자료 없음" : `${item.congestion}/100`} · 평균 대기 {item.averageWait == null ? "자료 없음" : `${item.averageWait}초`}</p></div></div>
    <h3 className="subheading">주요 진단</h3>
    <ul className="diagnosis-list">{diagnosis.findings.map((x, i) => <li key={i}>{x}</li>)}</ul>
    <h3 className="subheading"><Lightbulb size={15}/> 개선 검토 제안</h3>
    <ul className="action-list">{diagnosis.actions.map((x, i) => <li key={i}><CheckCircle2 size={15}/>{x}</li>)}</ul>
    <p className="small-note">교통 지표에 시연용 기준을 적용한 예비 진단입니다.</p>
  </section>;
}

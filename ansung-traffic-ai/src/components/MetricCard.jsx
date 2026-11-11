export default function MetricCard({ label, value, unit, hint, icon: Icon, tone = "blue" }) {
  return <section className="metric-card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={18}/></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-hint">{hint}</div>
  </section>;
}
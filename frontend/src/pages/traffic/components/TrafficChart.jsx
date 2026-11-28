import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export function TrafficChart({ data }) {
  return <div className="chart-wrap">
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#263448"/>
        <XAxis dataKey="time" interval={2} tick={{ fill: "#8fa0b8", fontSize: 10 }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fill: "#8fa0b8", fontSize: 11 }} axisLine={false} tickLine={false}/>
        <Tooltip contentStyle={{ background: "#172235", border: "1px solid #2a3a52", borderRadius: 10 }} labelStyle={{ color: "#fff" }} formatter={value => [value == null ? "자료 없음" : `${Number(value).toLocaleString("ko-KR")}대`, "일평균 교통량"]}/>
        <Bar dataKey="volume" name="교통량(대)" fill="#5b9cff" radius={[5,5,0,0]}/>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function DailyTrafficChart({ data }) {
  return <div className="chart-wrap">
    <ResponsiveContainer width="100%" height={210}>
      <LineChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#263448"/>
        <XAxis dataKey="label" interval={4} tick={{ fill: "#8fa0b8", fontSize: 10 }} axisLine={false} tickLine={false}/>
        <YAxis tick={{ fill: "#8fa0b8", fontSize: 11 }} axisLine={false} tickLine={false}/>
        <Tooltip contentStyle={{ background: "#172235", border: "1px solid #2a3a52", borderRadius: 10 }} labelStyle={{ color: "#fff" }} formatter={value => [`${Number(value).toLocaleString("ko-KR")}대`, "전일 합계"]}/>
        <Line type="monotone" dataKey="volume" name="전일 교통량(대)" stroke="#f3b75e" strokeWidth={3} dot={false}/>
      </LineChart>
    </ResponsiveContainer>
  </div>;
}
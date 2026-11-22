import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './home.css'
import image2 from '../../assets/home/image-3.png'
import image3 from '../../assets/home/image-4.png'
export default function HomePage() {
  const roadRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    function update() {
      const p = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.85), 0), 1)
      if (roadRef.current) {
        roadRef.current.style.opacity = String(1 - p)
        if (!reduced) roadRef.current.style.transform = `scale(${1 + 0.06 * p})`
      }
      if (mapRef.current) mapRef.current.style.opacity = (p * 0.2).toFixed(3)
    }
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])
  return <div className="page-home">
<div className="bg" id="bgMap" ref={mapRef} aria-hidden="true"></div>
<div className="bg" id="bgRoad" ref={roadRef} aria-hidden="true"></div>
<div className="bar">
 <a className="logo" href="#" aria-label="안성시"><img src={image2} alt="안성맞춤도시 안성 City of Masters" /></a>
 <div className="acts">
  <button type="button" className="abtn" id="btnLogin" disabled title="로그인 기능은 준비 중입니다"><svg viewBox="0 0 16 16"><circle cx="8" cy="5.2" r="2.8"/><path d="M2.5 14c.6-3 3-4.4 5.5-4.4s4.9 1.4 5.5 4.4"/></svg>로그인</button>
  <Link className="abtn" to="/traffic"><svg viewBox="0 0 16 16"><path d="M1.5 3.5l4-1.5 5 1.5 4-1.5v10.5l-4 1.5-5-1.5-4 1.5zM5.5 2v10.5M10.5 3.5V14"/></svg>지도로 이동</Link>
 </div>
</div>
<header className="hero">
 <img className="mark" src={image3} alt="" />
 <div className="brand">안성맞춤 AI</div>
 <h1>길은 막힘없이<br />거리는 빈틈없이 안성맞춤 ai</h1>
 <hr />
 <p>교통환경 개선을 통한 상권 활성화</p>
 <a className="pill" href="#info">자세히 보기</a>
 <div className="cue"></div>
</header>

<section className="s" id="info">
 <div className="eyebrow">QUICK GUIDE</div>
 <h2 className="sec">필요한 정보를 빠르게<br />살펴보세요</h2>
 <div className="grid">
  <article className="card">
   <h3>이동 데이터를 읽는 방법</h3>
   <p>시간대·요일·구간별 이동 흐름을 살펴 혼잡 구간과 보행·대중교통 접점을 함께 파악합니다.</p>
   <ul><li>시간대별 이동 흐름</li><li>구간별 혼잡 변화</li><li>보행·환승 접점</li></ul>
   <Link to="/traffic">교통·신호 현황 보기 →</Link>
  </article>
  <article className="card">
   <div className="tag">상권 현황 안내 분석 서비스</div>
   <div className="eyebrow" style={{"marginBottom": "6px"}}>보행·방문상권 변화</div>
   <h3>생활 상권의 변화를 읽는 방법</h3>
   <p>유동인구·매출·점포 변화와 생활권 특성을 함께 비교해 상권의 활력과 변화 신호를 살펴봅니다.</p><Link to="/commercial">상권 분석 보기 →</Link>
  </article>
 </div>
</section>

<section className="s" id="evidence">
 <div className="eyebrow">EVIDENCE · 2026. 10. 31.</div>
 <h2 className="sec">근거자료<br />교통환경 개선을 통한 상권 활성화 방안</h2>
 <div className="stats">
  <div className="stat"><small>청량리 청과물시장 · 2024. 12.</small><b>150m → 50m</b><span>정류소 직결 횡단보도로 중앙정류소까지 보행거리 최대 100m 단축, 반대방향 205m → 25m</span></div>
  <div className="stat"><small>연세로 대중교통전용지구</small><b>유동인구 +25.7%</b><span>매출 평균 8.6% 상승, 버스 승객 11.1% 증가, 교통사고 54.5% 감소 (서울연구원)</span></div>
  <div className="stat"><small>강남역 중앙정류소 · 2023</small><b>1.7 → 2.6㎡</b><span>횡단보도 주변 1인당 점유면적 확대, 버스↔지하철 환승거리 최대 210m 단축</span></div>
  <div className="stat"><small>서울시 AI 상권분석 · 2026</small><b>상권 활성화 지도</b><span>매출·유동인구·개폐업률을 한눈에, 장기적으로 위기 상권 예측 도입</span></div>
 </div>

 <h3 className="sub">교통 개선이 상권 활성화로 이어지는 경로</h3>
 <div className="flow">
  <div><b>1. 접근성</b>정류소 연장, 직결 횡단보도로 보행·환승 거리 단축</div>
  <div><b>2. 안전성</b>교통섬, 보행공간 확대로 무단횡단·사고 감소</div>
  <div><b>3. 체류환경</b>보도 확장, 광장·쉼터로 체류시간 증가</div>
  <div><b>4. 상권 성과</b>누적 효과로 유동인구·매출 증가</div>
  <div><b>5. 환류</b>AI 상권분석으로 효과 측정, 위기 선제 대응</div>
 </div>
 <p className="refs" style={{"marginTop": "14px"}}>핵심은 차량 소통이 아니라 사람이 상권에 도착하고 머무는 과정의 개선입니다.</p>

 <h3 className="sub">제언</h3>
 <ol className="rec">
  <li><b>이용자 특성에 맞춘 맞춤형 개선</b> — 고령층 비중, 차량 진출입 패턴 등을 먼저 파악</li>
  <li><b>대중교통 접점 중심의 투자</b> — 유동인구가 집중되는 정류소·환승역에서 효과가 큼</li>
  <li><b>안전과 상권을 하나의 지표로 관리</b> — 사업 전후 사고·보행밀집도·방문객·매출을 함께 측정</li>
  <li><b>AI 상권분석과의 연계</b> — 교통량·승하차·보행량 데이터를 결합 (본 보고서의 제안)</li>
  <li><b>주민·상인 합의 절차 강화</b> — 사전 설명, 시범 운영, 효과 공개</li>
  <li><b>역사·문화 자원과 결합</b> — 보행 환경과 문화 콘텐츠로 방문 이유를 만듦</li>
 </ol>

 <h3 className="sub">한계 및 유의사항</h3>
 <div className="note"><ul>
  <li>청량리 사례의 상권 효과는 발표 시점 기준 전망이며 매출 등 실측 자료가 없습니다.</li>
  <li>연세로 수치는 2020년 보도 기준이며 현재와 다를 수 있습니다.</li>
  <li>교통 개선과 매출 증가의 인과관계는 다른 요인의 영향을 배제하기 어렵습니다.</li>
  <li>AI 상권분석 내용은 2차 요약 자료에 근거하므로 서울시 공식 발표로 확인이 필요합니다.</li>
 </ul></div>

 <h3 className="sub">참고 자료</h3>
 <ul className="refs">
  <li>서울특별시, “청량리 시장에 맞춤형 횡단보도 신설…교통약자 보호·상권 활성화 지원” (2024. 12. 16.)</li>
  <li>국토교통신문, “도로 다이어트의 새이름 상권활성화…시민 주도형 길거리문화” (2020. 8. 4.)</li>
  <li>연합뉴스, “‘손님 줄어요’ 알려준다…서울시, AI로 상권분석 서비스 고도화” (2026. 3. 18.)</li>
 </ul>
</section>
<footer>© 안성맞춤 AI</footer>
</div>
}

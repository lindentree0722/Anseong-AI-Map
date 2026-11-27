# 안성맞춤 AI 통합 프론트엔드

React 18 + Vite + React Router 기반의 단일 앱입니다. TypeScript를 기본으로 사용하고 기존 교통 대시보드 JSX를 함께 유지합니다.

## 실행과 검증

Node.js 22 이상을 권장합니다. 저장소 루트에서 실행합니다.

```sh
cd frontend
npm ci
npm run dev -- --port 5173 --strictPort
```

```sh
npm run typecheck
npm test
npm run build
```

타입 검사는 신규 TS/TSX를 대상으로 하며 기존 JS/JSX는 빌드와 핵심 로직 테스트로 검증합니다. `npm test`는 Node의 테스트 러너를 사용해 API 응답 검증, 상권 계산, 서비스키 인코딩과 오류 처리를 확인합니다.

| URL | 화면 | 원본 |
| --- | --- | --- |
| `/` | 소개·홈 | itro-page.sihyung · 769e33c |
| `/signals` | 신호 현황·상세·교통량 분석 | 신호-진단 · d54dce5 |
| `/commercial` | 상권 지도·공실 후보·업종 추천 | anseong-sangkwon-(1234-홍기성) · e2fc4ac |
| `/traffic` | 교통 대시보드 | 정현수 · 4338771 |

각 페이지는 지연 로딩합니다. 페이지 전용 CSS 선택자와 변수를 분리해 화면 이동 시 스타일이 섞이지 않게 했습니다. 소개·상권 HTML은 React 컴포넌트로 전환했으며 iframe을 사용하지 않습니다.

## 선택적 API 설정

필요한 경우 `.env.example`을 참고해 `frontend/.env.local`을 작성하고 Vite를 재시작합니다. 비밀 값은 `VITE_` 변수에 넣지 마세요. `VITE_` 설정은 브라우저에 공개됩니다.

| 설정 | 기본값 | 용도 |
| --- | --- | --- |
| `SIGNAL_API_TARGET` | `http://127.0.0.1:8001` | 독립 실행하는 신호 진단 API 서버 |
| `VITE_SIGNAL_DATA_PROXY_URL` | 미설정 | 선택적인 외부 데이터 동기화 URL; 인증 비밀을 포함하지 않는 주소만 사용 |
| `COMMERCIAL_API_TARGET` | 미설정 | 선택적인 상권 프록시 서버 |

### 신호등 실제 API 연결

신호 백엔드는 `신호등 지금/backend/main.py`입니다. 실제 제공기관 API에 연결하려면 백엔드를 실행하는 터미널에 `TRAFFIC_SIGNAL_API_URL`과 `TRAFFIC_SIGNAL_API_KEY`를 설정하세요. 키는 브라우저에 전달되는 `VITE_` 변수나 저장소 파일에 넣지 않습니다.

Windows PowerShell 예시:

```powershell
Set-Location '신호등 지금'
$env:SIGNAL_DB_PATH = Join-Path $env:LOCALAPPDATA 'Anseong-AI-Map\signals.db'
$env:TRAFFIC_SIGNAL_API_URL = Read-Host '제공기관 API URL'
$secureKey = Read-Host 'API 서비스 키' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try { $env:TRAFFIC_SIGNAL_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer) }
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

그 뒤 별도 터미널에서 `frontend` 폴더의 `npm run dev`를 실행합니다. 백엔드는 실제 API 데이터를 60초 간격으로 갱신하고, 서비스 키가 없거나 원천 응답이 잘못되면 화면에 시연 데이터 또는 연결 상태를 표시합니다.

## API 미구현·연결 실패 처리

백엔드 API가 아직 없거나 요청·응답 검증에 실패하면 화면은 같은 응답 구조의 더미 데이터를 사용합니다. 교통, 신호, 상권 화면은 더미 사용 여부를 사용자에게 표시합니다. 요청 취소는 폴백하지 않고 그대로 중단합니다.

새 백엔드 기능을 연결할 때는 `src/lib/api-fallback.mjs`의 `loadApiOrDummy`를 사용하고, API 응답과 동일한 필드의 더미 생성 함수를 함께 추가하세요. API 성공 응답이 있으면 해당 값을 우선하며, 더미 값에는 출처를 명시해야 합니다.

### 신호 진단

- 프론트의 `/api/signals-service/*`를 별도 신호 API의 `/api/*`로 전달합니다.
- 기존 메인 백엔드(8000)의 `/places`와 신호 API(기본 8001)는 별개입니다.
- 별도 서버가 꺼져 있으면 연결 오류와 더미 데이터 상태를 표시합니다. 교통량 직접 입력·CSV/JSON 분석 탭은 신호 API 없이 사용할 수 있습니다.
- `VITE_SIGNAL_DATA_PROXY_URL`은 선택적인 브라우저 측 동기화 경로입니다. 서버에서 직접 제공기관을 조회할 때는 백엔드의 `TRAFFIC_SIGNAL_API_URL`과 `TRAFFIC_SIGNAL_API_KEY`를 사용합니다.
- 화면의 LIVE 표시는 백엔드가 동기화한 데이터가 있을 때만 사용합니다. 초기 시연 데이터와 API 연결 실패는 별도로 표시합니다.
- 방향별 상세·검색 요청은 페이지 이동 또는 대상 변경 시 취소합니다.

### 상권 분석

- 기본 모드는 가상 데모입니다. 반경, 지도 중심, 업종 표시 필터, 공실 후보 추가·삭제·선택 및 추천을 사용할 수 있습니다. 접근성 점수는 수동 입력이며 신호 API와 자동 연동되지 않습니다.
- 직접 호출 모드에서는 사용자가 서비스키를 입력한 뒤 ‘이 위치 분석’을 누릅니다. 키는 컴포넌트 메모리에만 유지하고 저장소·브라우저 저장소·로그에 저장하지 않습니다. 원본의 내장 서비스키는 가져오지 않았습니다.
- 실데이터에는 공공데이터포털 이용 승인과 CORS 허용이 필요합니다. 최대 5페이지(페이지당 1,000건)까지만 조회하고 한도에 도달하면 안내합니다.
- `COMMERCIAL_API_TARGET`이 설정됐을 때만 프록시 모드를 활성화합니다. `/api/commercial-service/storeListInRadius`를 해당 서버의 `/api/storeListInRadius`에 전달합니다. 키는 별도 프록시 서버에서 관리해야 하며 프록시 서버 구현은 포함하지 않습니다.
- 지도 타일은 Esri/OpenStreetMap을 사용하므로 인터넷 연결이 필요합니다. 상권 데이터와 별도로 타일 요청이 실패할 수 있습니다.
- 공실 후보는 현재 페이지 상태이며 영구 저장하지 않습니다. 데모의 공실은 가상이고, 실데이터 모드로 바꾸면 직접 추가한 후보만 유지합니다. 업종 추천은 기존 규칙 기반 점수입니다.

## 디자인과 기존 파일

교통 대시보드는 Leaflet 지도에 API가 반환한 위치를 표시합니다. 지도 또는 목록에서 지점을 선택하면 해당 지점의 신호 진단 결과를 확인할 수 있습니다.

신호 진단 원본의 Pretendard/Geist 폰트 바이너리가 없어 시스템 대체 글꼴을 사용합니다. 소개·교통 화면의 Google Fonts와 지도 타일은 외부 연결에 의존합니다. 소개의 로그인과 교통 대시보드의 경로 탐색은 미구현 상태로 표시합니다.

교통 대시보드는 `frontend/src/pages/traffic`에 통합했습니다. 로컬 백엔드를 8000번 포트에서 실행하면 `/traffic` 화면이 `/api/traffic-overview`를 통해 진단 결과를 읽습니다.

배포 환경에서는 `/api/traffic-overview`를 FastAPI의 `/traffic/overview`로 전달하세요. 샘플 데이터와 진단 규칙은 `backend/data/traffic-sample.json`과 `backend/traffic.py`에서 관리합니다.

## 배포

`npm run build` 결과는 `frontend/dist`입니다. React Router의 경로를 새로고침할 수 있도록 정적 호스팅에서 `/signals`, `/commercial`, `/traffic` 등 앱 경로를 `index.html`로 fallback해야 합니다.

Vite의 프록시 설정은 개발 서버에만 적용됩니다. 배포에서는 `/api/signals-service/*`와 필요 시 `/api/commercial-service/*`를 대응하는 별도 서버로 전달하는 리버스 프록시가 필요합니다. API 경로가 SPA HTML로 fallback되지 않게 구성하세요. 상권 프록시 사용 여부는 빌드 시 설정에서 결정되므로 배포 빌드에도 해당 연결 설정을 반영해야 합니다.

## 검증 범위

타입 검사, 프로덕션 빌드, 데이터/API 테스트 및 CLI HTTP 검증을 수행합니다. 브라우저 검증은 수행하지 않았으므로 시각적 동일성·실제 클릭 동작·외부 지도 타일 표시까지 확인된 것은 아닙니다. 서비스키를 사용하는 상권 실데이터 성공과 선택적 외부 신호 동기화는 별도 자격증명·연결 설정 없이 검증하지 않았습니다.

원본 계열 의존성을 유지했으며 설치 시 npm이 취약점 6건(높음 4, 보통 2)을 보고했습니다. 이번 변경에서 의존성의 주요 버전 교체는 수행하지 않았습니다.

### 확인된 기존 신호 API 제한

현재 비교용 신호 API는 목록 조회는 성공하지만 상세 조회에서 HTTP 500을 반환합니다. 원본 API의 `COLUMNS`에 `wtStsgSttsNm`이 빠져 있는데 상세 조회는 이 필드를 읽어 `IndexError`가 발생합니다. 통합 프론트는 이 실패를 안내하고 재조회·목록 복귀를 제공합니다. 백엔드를 수정하지 않는 범위에 따라 원본 API는 그대로 유지했습니다.

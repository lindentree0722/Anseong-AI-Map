# 신호등 지금

## Windows에서 실행

`run.bat`을 실행하면 필요한 Python 패키지를 설치하고 웹 서버를 시작한 뒤 브라우저에서 사이트를 엽니다. 프론트엔드 소스가 빌드 파일보다 최신이거나 `dist`가 없으면 Node.js가 필요하며, 스크립트가 프론트엔드를 다시 빌드합니다. 종료하려면 서버 창에서 `Ctrl+C`를 누릅니다.

처음 실행할 때는 인터넷 연결이 필요합니다. Python 의존성은 `requirements.txt`에서 설치하며, 프론트엔드 빌드가 필요한 경우 `npm ci`와 `npm run build`를 실행합니다.

## 명령줄에서 실행

프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

프론트엔드 소스를 수정한 뒤에는 Node.js가 설치된 환경에서 `npm ci`와 `npm run build`를 실행해 `dist`를 갱신하세요.

API 문서는 <http://127.0.0.1:8000/docs>에서 볼 수 있습니다. 기본 데이터베이스 파일은 `data/app.db`이며, `SIGNAL_DB_PATH` 환경 변수로 경로를 바꿀 수 있습니다.

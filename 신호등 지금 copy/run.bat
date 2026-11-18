@echo off
setlocal
cd /d "%~dp0"

set "BUILD_FRONTEND=0"
if not exist "dist\index.html" set "BUILD_FRONTEND=1"
if exist "dist\index.html" (
    powershell.exe -NoProfile -Command "$dist=(Get-Item 'dist\index.html').LastWriteTimeUtc; $latest=(Get-ChildItem 'src' -Recurse -File | Measure-Object -Property LastWriteTimeUtc -Maximum).Maximum; if ($latest -gt $dist) { exit 1 }"
    if errorlevel 1 set "BUILD_FRONTEND=1"
)

if "%BUILD_FRONTEND%"=="1" (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo Frontend source is newer than the website build. Install Node.js to rebuild it.
        pause
        exit /b 1
    )
    if not exist "node_modules" (
        call npm ci
        if errorlevel 1 exit /b 1
    )
    call npm run build
    if errorlevel 1 exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 exit /b 1
)

".venv\Scripts\python.exe" -c "import fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt
    if errorlevel 1 exit /b 1
)

echo Starting the website at http://127.0.0.1:8000 ...
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "$url='http://127.0.0.1:8000'; for ($i=0; $i -lt 40; $i++) { try { $null=Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1; Start-Process $url; exit } catch { Start-Sleep -Milliseconds 500 } }"
".venv\Scripts\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

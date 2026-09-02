@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0\.."

where msedge >nul 2>&1
if errorlevel 1 (
  echo 未找到 Microsoft Edge。闪记用 Edge 的应用窗口模式启动，这样开会时几乎是立刻出现。
  pause
  exit /b 1
)

if exist "dist\index.html" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
  exit /b %ERRORLEVEL%
)

where node >nul 2>&1
if errorlevel 1 (
  echo 请先安装 Node.js，然后在本目录运行 npm install 与 npm run build。
  pause
  exit /b 1
)

if not exist "node_modules" (
  call npm install
)

start "闪记" cmd /c "npm run preview"
timeout /t 1 /nobreak >nul
start "" msedge --app="http://127.0.0.1:47821" --user-data-dir="%LOCALAPPDATA%\FlashNote\edge-profile"
endlocal

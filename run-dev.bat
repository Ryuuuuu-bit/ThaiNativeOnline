@echo off
cd /d "%~dp0"
echo === npm install ===
call npm install
if errorlevel 1 (
  echo npm install failed
  pause
  exit /b 1
)
echo === npm run dev ===
call npm run dev
pause

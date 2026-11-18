@echo off
echo ============================================================
echo Starting EFOS AI Backend and Frontend Dev Servers...
echo ============================================================

echo Starting Backend Server on http://localhost:5000...
start "EFOS Backend" cmd /k "cd /d %~dp0\efos-ai\backend && npm run dev"

timeout /t 2 /nobreak >nul

echo Starting Frontend Server on http://localhost:3000...
start "EFOS Frontend" cmd /k "cd /d %~dp0\efos-ai\frontend && npm start"

echo.
echo Both servers have been launched!
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:5000
echo ============================================================
pause


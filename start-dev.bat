@echo off
echo ========================================================
echo   Starting PulsePoll Real-Time Live Polling System
echo ========================================================
echo.

echo Starting Go Gin Backend on http://localhost:8080 ...
start "PulsePoll Backend" cmd /k "cd backend && go run ./cmd/server"

timeout /t 2 /nobreak >nul

echo Starting React Frontend on http://localhost:5173 ...
start "PulsePoll Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo Both services are launching in separate windows!
echo - Frontend: http://localhost:5173 (or 5174)
echo - Backend:  http://localhost:8080
echo ========================================================

@echo off
title SteelOps Dev Runner

echo ===================================================
echo             SteelOps Development Runner            
echo ===================================================
echo.

if not exist "backend\.venv" (
    echo [ERROR] backend\.venv not found!
    echo Please initialize backend virtual environment first.
    echo.
    pause
    exit /b 1
)

if not exist "frontend\node_modules" (
    echo [INFO] frontend\node_modules not found. Installing dependencies via npm install...
    echo.
    pushd frontend
    call npm install
    popd
    echo.
    echo [INFO] Frontend dependencies installation completed.
    echo.
)

echo [START] Starting Backend Server (FastAPI)...
start "SteelOps Backend" cmd /k "cd backend && .venv\Scripts\uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [START] Starting Frontend Server (Next.js)...
start "SteelOps Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo Both servers have been launched in separate windows!
echo.
echo  - Backend API: http://127.0.0.1:8000
echo  - Frontend:    http://localhost:3000
echo.
echo Close the respective terminal windows to stop the servers.
echo ===================================================
echo.
pause

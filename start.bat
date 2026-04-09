@echo off
echo ===================================================
echo Starting Clinic Management System (Frontend & Backend)
echo ===================================================

echo [1/2] Starting Backend Server...
start "Backend" cmd /k "cd server && npm run dev"

echo [2/2] Starting Frontend App...
start "Frontend" cmd /k "cd client && npm run dev"

echo Done! Both servers are opening in new windows.

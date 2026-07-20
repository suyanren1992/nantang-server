@echo off
title Nantang Cloud Village - LAN Test

cd /d "%~dp0..\server"

REM Kill old process on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do taskkill /F /PID %%a 2>nul

REM Activate venv and start
call venv\Scripts\activate.bat

echo.
echo ========================================
echo   Nantang Cloud Village - LAN Test
echo ========================================
echo.
python -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); ip=s.getsockname()[0]; s.close(); print('   Local IP: '+ip); print('   Open in browser: http://'+ip+':8000')"
echo.
echo ========================================
echo.

uvicorn main:app --host 0.0.0.0 --port 8000

pause

@echo off
chcp 65001 >nul
title Colbeef Analyzer - Desarrollo
cd /d "%~dp0"

REM Modo desarrollo (recarga automatica al editar codigo)
set "SERVER_IP=192.168.20.205"
set "SERVER_PORT=9030"
set "HOST=0.0.0.0"
set "PORT=%SERVER_PORT%"
set "PUBLIC_URL=http://%SERVER_IP%:%SERVER_PORT%"
set "NODE_ENV=development"
set "DEV_BYPASS_AUTH=true"

set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%CD%\node_modules\.bin;%PATH%"

echo.
echo   Colbeef - Modo desarrollo
echo   =========================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado.
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    call npm install -g pnpm
)

if not exist "node_modules\.bin\vite.cmd" (
    call pnpm install
)

if not exist ".env" (
    echo [ERROR] Copia .env.example a .env
    pause
    exit /b 1
)

echo   URL red: http://%SERVER_IP%:%SERVER_PORT%/analyzer
echo   URL local: http://localhost:%SERVER_PORT%/analyzer
echo.

call pnpm run dev

pause

@echo off
chcp 65001 >nul
title Colbeef Analyzer - Servidor de Red
cd /d "%~dp0"

REM ============================================================
REM  Colbeef Analyzer — Arranque en servidor de red local
REM  IP del servidor: 192.168.20.205
REM ============================================================

set "SERVER_IP=192.168.20.205"
set "SERVER_PORT=5009"
set "HOST=0.0.0.0"
set "PORT=%SERVER_PORT%"
set "PUBLIC_URL=http://%SERVER_IP%:%SERVER_PORT%"
set "NODE_ENV=production"
set "DEV_BYPASS_AUTH=true"

set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"

echo.
echo   Colbeef - Analisis Ejecutivo Diario
echo   ===================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado.
    echo Descargalo desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if errorlevel 1 (
    echo Instalando pnpm...
    call npm install -g pnpm
)

if not exist ".env" (
    echo [ERROR] No existe el archivo .env
    echo Copia .env.example a .env y configura las variables.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Instalando dependencias ^(primera vez^)...
    call pnpm install
    if errorlevel 1 (
        echo [ERROR] Fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
    echo.
)

if not exist "dist\index.js" (
    echo Compilando aplicacion para produccion...
    call pnpm run build
    if errorlevel 1 (
        echo [ERROR] Fallo la compilacion.
        pause
        exit /b 1
    )
    echo.
)

echo   Servidor iniciando...
echo.
echo   URL para compartir en la red:
echo   http://%SERVER_IP%:%SERVER_PORT%/analyzer
echo.
echo   Acceso local en este equipo:
echo   http://localhost:%SERVER_PORT%/analyzer
echo.
echo   IMPORTANTE: Si otros no pueden entrar, abre el puerto
echo   %SERVER_PORT% en el Firewall de Windows para esta PC.
echo.
echo   Presiona Ctrl+C para detener el servidor.
echo.

node dist\index.js

echo.
echo Servidor detenido.
pause

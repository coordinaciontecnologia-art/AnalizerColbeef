@echo off
REM Ejecutar como Administrador (clic derecho - Ejecutar como administrador)
chcp 65001 >nul

set "PORT=5009"
set "RULE_NAME=Colbeef Analyzer (TCP %PORT%)"

echo Abriendo puerto %PORT% en el Firewall de Windows...

netsh advfirewall firewall delete rule name="%RULE_NAME%" >nul 2>&1
netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT%

if errorlevel 1 (
    echo [ERROR] Ejecuta este archivo como Administrador.
    pause
    exit /b 1
)

echo.
echo Puerta %PORT% abierta correctamente.
echo Otros equipos pueden acceder a: http://192.168.20.205:%PORT%/analyzer
echo.
pause

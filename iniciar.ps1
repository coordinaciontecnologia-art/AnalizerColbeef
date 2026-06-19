# Colbeef Analyzer — Script de inicio para Windows
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "  Colbeef — Analisis Ejecutivo Diario" -ForegroundColor Green
Write-Host "  =====================================" -ForegroundColor DarkGray
Write-Host ""

# Verificar Node.js
$nodePaths = @(
    "C:\Program Files\nodejs",
    "$env:APPDATA\npm"
)
foreach ($p in $nodePaths) {
    if (Test-Path $p) { $env:PATH = "$p;$env:PATH" }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "ERROR: Node.js no esta instalado." -ForegroundColor Red
    Write-Host ""
    Write-Host "Instala Node.js LTS desde: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Luego cierra y abre Cursor, y ejecuta este script de nuevo." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "Node.js: $(node --version)" -ForegroundColor Cyan

# Verificar pnpm
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    Write-Host "Instalando pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
}

Write-Host "pnpm: $(pnpm --version)" -ForegroundColor Cyan
Write-Host ""

# Instalar dependencias si no existen
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias (primera vez, puede tardar unos minutos)..." -ForegroundColor Yellow
    pnpm install
    Write-Host ""
}

# Verificar .env
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: No se encontro el archivo .env" -ForegroundColor Red
    Write-Host "Copia .env.example a .env y configura las variables." -ForegroundColor Yellow
    exit 1
}

Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Green
Write-Host "Abre en el navegador: http://localhost:9030/analyzer" -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener" -ForegroundColor DarkGray
Write-Host ""

pnpm run dev

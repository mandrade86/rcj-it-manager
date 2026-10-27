# Despliega RCJ IT Manager en un servidor Windows (Docker Desktop o Node).
#
# Uso:
#   .\scripts\deploy-windows.ps1                 # Docker: solo app (Mongo remoto)
#   .\scripts\deploy-windows.ps1 -Mode node      # Sin Docker: build + npm start
#   .\scripts\deploy-windows.ps1 -Pull           # git pull antes
#
# Requisitos Docker: Docker Desktop corriendo, archivo .env.production con MONGODB_URI
# Requisitos Node:   Node 22+, .env o .env.production con MONGODB_URI
param(
  [ValidateSet('docker', 'node')]
  [string]$Mode = 'docker',
  [switch]$Pull,
  [string]$EnvFile = '.env.production',
  [string]$ComposeFile = 'docker-compose.app.yml'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if ($Pull) {
  Write-Host "git pull…" -ForegroundColor Cyan
  git pull
}

if (-not (Test-Path $EnvFile)) {
  if (Test-Path '.env.production.example') {
    Copy-Item '.env.production.example' $EnvFile
    Write-Host "Creado $EnvFile desde el example. Edítalo (JWT_SECRET, MONGODB_URI) y vuelve a correr." -ForegroundColor Yellow
    exit 1
  }
  throw "Falta $EnvFile"
}

$content = Get-Content $EnvFile -Raw
if ($content -notmatch 'MONGODB_URI\s*=\s*\S+') {
  Write-Host "En $EnvFile define MONGODB_URI hacia el Mongo remoto, por ejemplo:" -ForegroundColor Yellow
  Write-Host '  MONGODB_URI=mongodb://appUser:CLAVE@172.16.146.20:27017/rcj_it_manager?authSource=admin'
  exit 1
}
if ($content -match 'JWT_SECRET=\s*$' -or $content -match 'JWT_SECRET=genera-un-secreto') {
  Write-Host "Cambia JWT_SECRET en $EnvFile antes de desplegar." -ForegroundColor Yellow
  exit 1
}

if ($Mode -eq 'docker') {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker no está instalado. Instala Docker Desktop o usa -Mode node'
  }
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Docker Desktop no está corriendo. Ábrelo e inténtalo de nuevo.'
  }
  Write-Host "Build + up ($ComposeFile)…" -ForegroundColor Cyan
  docker compose -f $ComposeFile --env-file $EnvFile up -d --build
  if ($LASTEXITCODE -ne 0) { throw "docker compose falló ($LASTEXITCODE)" }
  Write-Host ""
  Write-Host "OK. App en http://localhost:3001 (o la IP del servidor :3001)." -ForegroundColor Green
  Write-Host "Logs: docker compose -f $ComposeFile --env-file $EnvFile logs -f app"
  exit 0
}

# Mode node
Write-Host "npm install (root)…" -ForegroundColor Cyan
npm install --omit=dev
if (-not (Test-Path 'client\node_modules')) {
  Write-Host "npm install (client)…" -ForegroundColor Cyan
  Push-Location client
  npm install
  Pop-Location
}
Write-Host "Build frontend…" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'build falló' }

# Carga .env.production si no hay .env
if (-not (Test-Path '.env') -and (Test-Path $EnvFile)) {
  Copy-Item $EnvFile '.env' -Force
  Write-Host "Copiado $EnvFile → .env para npm start" -ForegroundColor Yellow
}

Write-Host "Iniciando API (producción)…" -ForegroundColor Cyan
Write-Host "Para dejarlo como servicio usa NSSM o pm2. Mientras tanto:" -ForegroundColor Yellow
Write-Host "  `$env:NODE_ENV='production'; npm start"
$env:NODE_ENV = 'production'
npm start

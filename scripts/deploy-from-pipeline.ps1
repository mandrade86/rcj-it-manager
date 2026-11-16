#Requires -RunAsAdministrator
<#
  Deploy usado por Azure Pipelines en el agente Windows (self-hosted).
  NO sobrescribe .env (secretos quedan en el servidor).

  Uso en el agente:
    .\scripts\deploy-from-pipeline.ps1 -Env Dev
    .\scripts\deploy-from-pipeline.ps1 -Env Prod

  Variables de entorno opcionales (pipeline):
    RCJ_DEPLOY_ROOT   → ruta del repo (default D:\rcj-it-manager)
    RCJ_SERVICE_NAME  → servicio Windows (default RCJITManager)
    RCJ_GIT_BRANCH    → rama a desplegar (default main)
#>
param(
  [ValidateSet('Dev', 'Prod')]
  [string]$Env = 'Dev',
  [string]$Root = $(if ($env:RCJ_DEPLOY_ROOT) { $env:RCJ_DEPLOY_ROOT } else { 'D:\rcj-it-manager' }),
  [string]$ServiceName = $(if ($env:RCJ_SERVICE_NAME) { $env:RCJ_SERVICE_NAME } else { 'RCJITManager' }),
  [string]$Branch = $(if ($env:RCJ_GIT_BRANCH) { $env:RCJ_GIT_BRANCH } else { 'main' })
)

$ErrorActionPreference = 'Stop'

Write-Host "=== Deploy $Env ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Branch: $Branch"
Write-Host "Service: $ServiceName"

if (-not (Test-Path -LiteralPath $Root)) {
  throw "No existe $Root. Clona el repo ahí antes del primer pipeline."
}

Set-Location -LiteralPath $Root

# Asegurar remoto Azure DevOps si existe RCJ_GIT_REMOTE
if ($env:RCJ_GIT_REMOTE) {
  $remotes = git remote
  if ($remotes -notcontains 'origin') {
    git remote add origin $env:RCJ_GIT_REMOTE
  } else {
    git remote set-url origin $env:RCJ_GIT_REMOTE
  }
}

Write-Host 'git fetch / reset…' -ForegroundColor Cyan
git fetch origin
git checkout $Branch
git reset --hard "origin/$Branch"

Write-Host 'npm install (root)…' -ForegroundColor Cyan
npm install --prefer-offline --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm install root falló' }

Write-Host 'npm install (client)…' -ForegroundColor Cyan
Push-Location client
npm install --prefer-offline --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'npm install client falló' }
Write-Host 'npm run build…' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'client build falló' }
Pop-Location

# No tocar .env — debe existir en el servidor
if (-not (Test-Path -LiteralPath (Join-Path $Root '.env'))) {
  Write-Host "AVISO: no hay .env en $Root — créalo antes (desde .env.development / .env.production)." -ForegroundColor Yellow
}

Write-Host "Reiniciando servicio $ServiceName…" -ForegroundColor Cyan
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  throw "Servicio Windows '$ServiceName' no encontrado. Instálalo con NSSM/pm2 antes."
}
Restart-Service -Name $ServiceName -Force
Start-Sleep -Seconds 3
$svc = Get-Service -Name $ServiceName
if ($svc.Status -ne 'Running') {
  throw "El servicio $ServiceName no quedó Running (estado: $($svc.Status))"
}

Write-Host "OK deploy $Env — $ServiceName Running" -ForegroundColor Green
try {
  $health = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/health' -UseBasicParsing -TimeoutSec 10
  Write-Host "Health: $($health.StatusCode) $($health.Content)"
} catch {
  Write-Host "Health check local falló (el servicio puede tardar unos segundos): $($_.Exception.Message)" -ForegroundColor Yellow
}

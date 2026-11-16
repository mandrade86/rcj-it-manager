<#
  Deploy usado por Azure Pipelines en el agente Windows (self-hosted).
  NO sobrescribe .env (secretos quedan en el servidor).
  El agente debe poder reiniciar RCJITManager (ideal: servicio del agente como Local System).

  Uso en el agente:
    .\scripts\deploy-from-pipeline.ps1 -Env Dev
    .\scripts\deploy-from-pipeline.ps1 -Env Prod

  Variables de entorno opcionales (pipeline):
    RCJ_DEPLOY_ROOT     → ruta del repo (default D:\rcj-it-manager o C:\apps\rcj-it-manager)
    RCJ_SERVICE_NAME    → servicio Windows (default RCJITManager)
    RCJ_GIT_BRANCH      → rama a desplegar (default main)
    RCJ_GIT_REMOTE      → URL del repo Azure
    SYSTEM_ACCESSTOKEN  → token OAuth del pipeline (clone/fetch)
#>
param(
  [ValidateSet('Dev', 'Prod')]
  [string]$Env = 'Dev',
  [string]$Root = '',
  [string]$ServiceName = $(if ($env:RCJ_SERVICE_NAME) { $env:RCJ_SERVICE_NAME } else { 'RCJITManager' }),
  [string]$Branch = $(if ($env:RCJ_GIT_BRANCH) { $env:RCJ_GIT_BRANCH } else { 'main' })
)

$ErrorActionPreference = 'Stop'

function Resolve-DeployRoot {
  if ($env:RCJ_DEPLOY_ROOT) { return $env:RCJ_DEPLOY_ROOT }
  if ($Root) { return $Root }
  if (Test-Path -LiteralPath 'D:\') { return 'D:\rcj-it-manager' }
  return 'C:\apps\rcj-it-manager'
}

function Invoke-GitAuth {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  if ($env:SYSTEM_ACCESSTOKEN) {
    $header = "AUTHORIZATION: bearer $($env:SYSTEM_ACCESSTOKEN)"
    & git -c "http.extraheader=$header" @GitArgs
  } else {
    & git @GitArgs
  }
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArgs -join ' ') falló (exit $LASTEXITCODE)"
  }
}

$Root = Resolve-DeployRoot
$remote = if ($env:RCJ_GIT_REMOTE) {
  $env:RCJ_GIT_REMOTE
} else {
  'https://dev.azure.com/RCJCorporation/RCJ-IT-MANAGER/_git/RCJ-IT-MANAGER'
}

Write-Host "=== Deploy $Env ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Branch: $Branch"
Write-Host "Service: $ServiceName"
Write-Host "Remote: $remote"

if (-not (Test-Path -LiteralPath $Root)) {
  $parent = Split-Path -Parent $Root
  if ($parent -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  Write-Host "Clonando repo en $Root…" -ForegroundColor Cyan
  Invoke-GitAuth clone --branch $Branch --single-branch $remote $Root
}

Set-Location -LiteralPath $Root

$remotes = @(git remote 2>$null)
if ($remotes -notcontains 'origin') {
  git remote add origin $remote
} else {
  git remote set-url origin $remote
}

Write-Host 'git fetch / reset…' -ForegroundColor Cyan
Invoke-GitAuth fetch origin
git checkout $Branch
if ($LASTEXITCODE -ne 0) { throw "git checkout $Branch falló" }
Invoke-GitAuth reset --hard "origin/$Branch"

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

$envFile = Join-Path $Root '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  $seed = if ($Env -eq 'Dev') {
    @(
      (Join-Path $Root '.env.development'),
      (Join-Path $Root '.env.development.example'),
      (Join-Path $Root '.env.example')
    )
  } else {
    @(
      (Join-Path $Root '.env.production'),
      (Join-Path $Root '.env.production.example'),
      (Join-Path $Root '.env.example')
    )
  }
  $from = $seed | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($from) {
    Copy-Item -LiteralPath $from -Destination $envFile
    Write-Host "Se creó .env desde $(Split-Path $from -Leaf). Revisa secretos en el servidor." -ForegroundColor Yellow
  } else {
    Write-Host "AVISO: no hay .env en $Root — créalo antes de usar la app." -ForegroundColor Yellow
  }
}

Write-Host "Reiniciando servicio $ServiceName…" -ForegroundColor Cyan
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  throw "Servicio Windows '$ServiceName' no encontrado en $Root. Instálalo con NSSM apuntando a esta carpeta, luego re-ejecuta el pipeline."
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

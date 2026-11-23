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

function Test-DriveReady {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
  try {
    $root = [System.IO.Path]::GetPathRoot($Path)
    if ([string]::IsNullOrWhiteSpace($root)) { return $false }
    return (Test-Path -LiteralPath $root)
  } catch {
    return $false
  }
}

function Resolve-DeployRoot {
  $candidates = @()
  if ($env:RCJ_DEPLOY_ROOT) { $candidates += $env:RCJ_DEPLOY_ROOT }
  if ($Root) { $candidates += $Root }
  $candidates += @('P:\rcj-it-manager', 'D:\rcj-it-manager', 'C:\apps\rcj-it-manager')

  foreach ($candidate in $candidates) {
    if (Test-DriveReady -Path $candidate) { return $candidate }
    Write-Host "Omitiendo $candidate (unidad no disponible)" -ForegroundColor Yellow
  }
  throw 'No hay unidad válida para el deploy. Define RCJ_DEPLOY_ROOT en una ruta existente (ej. C:\apps\rcj-it-manager).'
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
  # No intentar crear la raíz de unidad (D:\, C:\); solo subcarpetas
  if ($parent -and $parent -notmatch '^[A-Za-z]:\\?$' -and -not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  Write-Host "Clonando repo en $Root…" -ForegroundColor Cyan
  Invoke-GitAuth clone --branch $Branch --single-branch $remote $Root
}

Set-Location -LiteralPath $Root

# Evita "dubious ownership" (clone como Network Service vs usuario interactivo)
$safePath = ($Root -replace '\\', '/')
git config --global --add safe.directory $safePath 2>$null
git config --system --add safe.directory $safePath 2>$null

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
Write-Host 'npm run build (logLevel warn)…' -ForegroundColor Cyan
$env:CI = 'true'
# Menos ruido: el listado de chunks de Vite satura el log de Azure
npm run build -- --logLevel warn
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'client build falló' }
Pop-Location
Write-Host '##[section] Client build OK' -ForegroundColor Green
Write-Host "Build terminado: $(Get-Date -Format 'HH:mm:ss')"

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

Write-Host "##[section] Reinicio servicio $ServiceName" -ForegroundColor Cyan
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  Write-Host "AVISO: código desplegado en $Root pero no existe el servicio '$ServiceName'." -ForegroundColor Yellow
  Write-Host "Instala NSSM apuntando a $Root y re-ejecuta el pipeline." -ForegroundColor Yellow
  if ($env:RCJ_REQUIRE_SERVICE -eq '1') {
    throw "Servicio Windows '$ServiceName' no encontrado."
  }
  Write-Host "OK deploy $Env (sin reinicio de servicio)" -ForegroundColor Yellow
  exit 0
}

function Restart-RcjService {
  param([string]$Name)
  $errs = @()

  try {
    Restart-Service -Name $Name -Force -ErrorAction Stop
    return
  } catch {
    $errs += "Restart-Service: $($_.Exception.Message)"
  }

  $nssm = @(
    (Get-Command nssm -ErrorAction SilentlyContinue).Source
    'C:\nssm\nssm.exe'
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
  if ($nssm) {
    try {
      & $nssm restart $Name
      if ($LASTEXITCODE -eq 0) { return }
      $errs += "nssm restart exit $LASTEXITCODE"
    } catch {
      $errs += "nssm: $($_.Exception.Message)"
    }
  }

  try {
    & sc.exe stop $Name | Out-Null
    Start-Sleep -Seconds 2
    & sc.exe start $Name | Out-Null
    if ($LASTEXITCODE -eq 0) { return }
    $errs += "sc start exit $LASTEXITCODE"
  } catch {
    $errs += "sc: $($_.Exception.Message)"
  }

  throw @"
No se pudo reiniciar '$Name' (el agente no tiene permiso).
Detalle: $($errs -join ' | ')

En el servidor (PowerShell Admin, una vez):
  powershell -ExecutionPolicy Bypass -File $Root\scripts\grant-agent-service-control.ps1
Luego re-ejecuta el pipeline.
"@
}

Restart-RcjService -Name $ServiceName
Start-Sleep -Seconds 5
$svc = Get-Service -Name $ServiceName
if ($svc.Status -ne 'Running') {
  throw "El servicio $ServiceName no quedó Running (estado: $($svc.Status))"
}

Write-Host "OK deploy $Env — $ServiceName Running" -ForegroundColor Green
# Dev suele ser 3002; Prod 3001. Si .env no es legible (ACL solo Admin/SYSTEM), no fallar el deploy.
$healthPort = if ($Env -eq 'Dev') { 3002 } else { 3001 }
if ($env:RCJ_HEALTH_PORT) {
  $healthPort = [int]$env:RCJ_HEALTH_PORT
} else {
  $envPath = Join-Path $Root '.env'
  try {
    if (Test-Path -LiteralPath $envPath) {
      $m = Select-String -Path $envPath -Pattern '^\s*(?:PORT|APP_PORT)\s*=\s*(\d+)' -ErrorAction Stop |
        Select-Object -First 1
      if ($m) { $healthPort = [int]$m.Matches[0].Groups[1].Value }
    }
  } catch {
    Write-Host "No se pudo leer .env para PORT (usando $healthPort): $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
try {
  $health = Invoke-WebRequest -Uri "http://127.0.0.1:$healthPort/api/health" -UseBasicParsing -TimeoutSec 15
  Write-Host "Health (:$healthPort): $($health.StatusCode) $($health.Content)"
} catch {
  Write-Host "Health check local falló (:$healthPort): $($_.Exception.Message)" -ForegroundColor Yellow
}

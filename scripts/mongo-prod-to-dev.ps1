<#
  Copia la base de PRODUCCIÓN (rcj_it_manager) a DESARROLLO (rcj_it_manager_dev).

  Destino por defecto: Mongo Dev RCJ-LNX-SQL01 = 172.16.150.25

  Requisitos: mongodump + mongorestore (MongoDB Database Tools)
    https://www.mongodb.com/try/download/database-tools

  Ejemplos:

  # Prod en servidor Ubuntu (SSH + dump remoto), restore a Dev:
  .\scripts\mongo-prod-to-dev.ps1 -ProdSshHost 172.16.150.20 -ProdSshUser administrador

  # Prod con URI directa:
  .\scripts\mongo-prod-to-dev.ps1 -ProdUri "mongodb://172.16.x.x:27017"

  # Solo restore de un archive ya descargado:
  .\scripts\mongo-prod-to-dev.ps1 -Archive data\backups\rcj_it_manager-XXXX.archive -SkipExport
#>
param(
  [string]$ProdUri = '',
  [string]$ProdSshHost = '172.16.150.20',
  [string]$ProdSshUser = 'administrador',
  [string]$ProdRemoteRoot = '/opt/rcj-it-manager',
  [string]$DevHost = '172.16.150.25',
  [int]$DevPort = 27017,
  [string]$DevUri = '',
  [string]$SourceDb = 'rcj_it_manager',
  [string]$TargetDb = 'rcj_it_manager_dev',
  [string]$Archive = '',
  [switch]$SkipExport,
  # Por defecto SÍ hace --drop en destino. Usa -NoDrop para no borrar.
  [switch]$NoDrop
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Find-MongoTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "C:\Program Files\MongoDB\Tools\100\bin\$Name.exe",
    "C:\Program Files\MongoDB\Database Tools\bin\$Name.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}

$mongodump = Find-MongoTool 'mongodump'
$mongorestore = Find-MongoTool 'mongorestore'
if (-not $mongorestore) {
  throw "Falta mongorestore. Instala MongoDB Database Tools."
}

$OutDir = Join-Path $Root 'data\backups'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if (-not $DevUri) {
  $DevUri = "mongodb://${DevHost}:${DevPort}"
}
$doDrop = -not $NoDrop

Write-Host "Origen DB : $SourceDb" -ForegroundColor Cyan
Write-Host "Destino   : $DevUri  →  $TargetDb" -ForegroundColor Cyan
Write-Host ""

# ── 1) Export ────────────────────────────────────────────────────────────────
if (-not $SkipExport) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  if (-not $Archive) {
    $Archive = Join-Path $OutDir "$SourceDb-prod-$stamp.archive"
  }

  if ($ProdUri) {
    if (-not $mongodump) { throw 'Falta mongodump para export por URI.' }
    Write-Host "1) mongodump desde ProdUri…" -ForegroundColor Cyan
    $safe = $ProdUri -replace '://([^:]+):([^@]+)@', '://$1:***@'
    Write-Host "   $safe"
    & $mongodump --uri $ProdUri --db $SourceDb --archive=$Archive
    if ($LASTEXITCODE -ne 0) { throw "mongodump falló ($LASTEXITCODE)" }
  } else {
    Write-Host "1) Export vía SSH en $ProdSshUser@$ProdSshHost …" -ForegroundColor Cyan
    $remoteName = "$SourceDb-prod-$stamp.archive"
    $remotePath = "$ProdRemoteRoot/data/backups/$remoteName"
    $remoteCmd = @"
set -e
cd '$ProdRemoteRoot'
mkdir -p data/backups
bash scripts/mongo-export.sh --db $SourceDb --out data/backups/$remoteName
ls -lh data/backups/$remoteName
"@
    ssh "${ProdSshUser}@${ProdSshHost}" $remoteCmd
    if ($LASTEXITCODE -ne 0) { throw "Export SSH falló ($LASTEXITCODE)" }
    Write-Host "2) Descargando archive…" -ForegroundColor Cyan
    scp "${ProdSshUser}@${ProdSshHost}:${remotePath}" $Archive
    if ($LASTEXITCODE -ne 0) { throw "scp falló ($LASTEXITCODE)" }
  }
  Write-Host "   Archive: $Archive" -ForegroundColor Green
} else {
  if (-not $Archive -or -not (Test-Path $Archive)) {
    throw 'Con -SkipExport debes pasar -Archive ruta\al\archivo.archive'
  }
  $Archive = (Resolve-Path $Archive).Path
  Write-Host "1) Usando archive existente: $Archive" -ForegroundColor Cyan
}

# ── 2) Restore con rename de namespace prod → dev ─────────────────────────────
Write-Host "`n3) mongorestore → $TargetDb (nsFrom $SourceDb → $TargetDb)…" -ForegroundColor Cyan
Write-Host "   ADVERTENCIA: --drop borra colecciones existentes en $TargetDb" -ForegroundColor Yellow

$restoreArgs = @(
  '--uri', $DevUri,
  "--archive=$Archive",
  "--nsFrom=${SourceDb}.*",
  "--nsTo=${TargetDb}.*",
  "--nsInclude=${SourceDb}.*"
)
if ($doDrop) { $restoreArgs += '--drop' }

& $mongorestore @restoreArgs
if ($LASTEXITCODE -ne 0) { throw "mongorestore falló ($LASTEXITCODE)" }

Write-Host "`nOK. Dev debe usar:" -ForegroundColor Green
Write-Host "  MONGODB_URI=mongodb://${DevHost}:${DevPort}/$TargetDb"
Write-Host "Luego: Restart-Service RCJITManager"
Write-Host "Prueba: Invoke-WebRequest http://127.0.0.1:3001/api/health -UseBasicParsing"

# Genera un dump de Mongo en el servidor Ubuntu y lo descarga a data/backups/
#
# Uso (PowerShell, desde la raíz del repo o cualquier ruta):
#   .\scripts\mongo-pull-from-server.ps1
#   .\scripts\mongo-pull-from-server.ps1 -Dev
#   .\scripts\mongo-pull-from-server.ps1 -HostServer 172.16.150.20 -User administrador
#
# Requisitos: VPN/red RCJ, OpenSSH (ssh/scp), acceso al servidor.
param(
  [string]$HostServer = '172.16.150.20',
  [string]$User = 'administraador',
  [string]$RemoteRoot = '/opt/rcj-it-manager',
  [switch]$Dev,
  [string]$OutDir = ''
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not $OutDir) {
  $OutDir = Join-Path $Root 'data\backups'
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Db = if ($Dev) { 'rcj_it_manager_dev' } else { 'rcj_it_manager' }
$ExportArgs = if ($Dev) { '--dev' } else { '' }
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$RemoteName = "$Db-$Stamp.archive"
$RemotePath = "$RemoteRoot/data/backups/$RemoteName"
$LocalPath = Join-Path $OutDir $RemoteName
$Target = "${User}@${HostServer}"

Write-Host "1) Generando dump en el servidor ($Db)…" -ForegroundColor Cyan
$remoteCmd = @"
set -e
cd '$RemoteRoot'
mkdir -p data/backups
bash scripts/mongo-export.sh $ExportArgs --out data/backups/$RemoteName
ls -lh data/backups/$RemoteName
"@

ssh $Target $remoteCmd
if ($LASTEXITCODE -ne 0) {
  throw "Falló el export en el servidor (código $LASTEXITCODE). ¿VPN/red y contraseña OK?"
}

Write-Host "2) Descargando a $LocalPath …" -ForegroundColor Cyan
scp "${Target}:${RemotePath}" $LocalPath
if ($LASTEXITCODE -ne 0) {
  throw "Falló scp (código $LASTEXITCODE)."
}

$size = (Get-Item $LocalPath).Length
Write-Host ""
Write-Host "Listo: $LocalPath ($([math]::Round($size/1MB, 2)) MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Restaurar en Mongo local (CLI):" -ForegroundColor Yellow
Write-Host "  mongorestore --uri `"mongodb://127.0.0.1:27017`" --archive=`"$LocalPath`" --nsInclude=`"$Db.*`" --drop"
Write-Host ""
Write-Host "O en MongoDB Compass: conecta a mongodb://127.0.0.1:27017 y usa mongorestore,"
Write-Host "  o importa colecciones JSON si exportaste con --json (ver deploy/WINDOWS.md)."

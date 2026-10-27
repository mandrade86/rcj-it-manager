# Restaura un .archive (mongodump) en MongoDB (local o remoto).
#
# Uso local:
#   .\scripts\mongo-import-local.ps1 data\backups\rcj_it_manager-XXXX.archive -Drop
#
# Uso remoto (recomendado: parámetros sueltos, sin armar URI a mano):
#   .\scripts\mongo-import-local.ps1 data\backups\rcj_it_manager-XXXX.archive `
#     -MongoHost 172.16.146.20 -User appUser -Password '***' -AuthSource admin -Drop
#
# O con URI completa (un solo :puerto):
#   .\scripts\mongo-import-local.ps1 data\backups\....archive `
#     -Uri "mongodb://appUser:CLAVE@172.16.146.20:27017/?authSource=admin" -Drop
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Archive,
  [string]$Uri = '',
  [string]$MongoHost = '',
  [int]$Port = 27017,
  [string]$User = '',
  [string]$Password = '',
  [string]$AuthSource = 'admin',
  [string]$Database = 'rcj_it_manager',
  [switch]$Drop
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not (Test-Path $Archive)) {
  $try = Join-Path $Root $Archive
  if (Test-Path $try) { $Archive = $try }
  else { throw "No existe el archivo: $Archive" }
}
$Archive = (Resolve-Path $Archive).Path

function Encode-UriComponent([string]$s) {
  [uri]::EscapeDataString($s)
}

if ($MongoHost) {
  if ($User -and $Password) {
    $u = Encode-UriComponent $User
    $p = Encode-UriComponent $Password
    $Uri = "mongodb://${u}:${p}@${MongoHost}:${Port}/?authSource=$AuthSource"
  } else {
    $Uri = "mongodb://${MongoHost}:${Port}"
  }
} elseif (-not $Uri) {
  $Uri = 'mongodb://127.0.0.1:27017'
}

# Corrige URI con puerto duplicado: host:27017:27017 → host:27017
if ($Uri -match ':\d+:\d+') {
  $fixed = [regex]::Replace($Uri, ':(\d+):\d+', ':$1')
  Write-Host "URI corregida (puerto duplicado): $fixed" -ForegroundColor Yellow
  $Uri = $fixed
}

$mongorestore = Get-Command mongorestore -ErrorAction SilentlyContinue
if (-not $mongorestore) {
  $candidates = @(
    'C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe',
    'C:\Program Files\MongoDB\Database Tools\bin\mongorestore.exe'
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $mongorestore = @{ Source = $c }; break }
  }
}
if (-not $mongorestore) {
  throw @"
No se encontró mongorestore.exe.
Instala MongoDB Database Tools:
  https://www.mongodb.com/try/download/database-tools
"@
}

$exe = if ($mongorestore.Source) { $mongorestore.Source } else { $mongorestore.Path }
$restoreArgs = @('--uri', $Uri, "--archive=$Archive", "--nsInclude=$Database.*")
if ($Drop) { $restoreArgs += '--drop' }

$safeUri = $Uri -replace '://([^:]+):([^@]+)@', '://$1:***@'
Write-Host "Restaurando $Database en $safeUri …" -ForegroundColor Cyan
& $exe @restoreArgs
if ($LASTEXITCODE -ne 0) { throw "mongorestore falló ($LASTEXITCODE)" }
Write-Host "Restore OK. Abre Compass con la misma conexión → base $Database" -ForegroundColor Green

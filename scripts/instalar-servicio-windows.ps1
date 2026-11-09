<#
.SYNOPSIS
  Instala NSSM (si falta) y registra RCJ IT Manager como servicio de Windows.

.DESCRIPTION
  - Descarga NSSM 2.24 en C:\nssm (o usa -NssmExe si ya lo tienes).
  - Crea o actualiza el servicio: arranque automático, reinicio si falla, logs en .\logs.
  - Restringe los permisos del .env a Administradores y SYSTEM.
  - Arranca el servicio y verifica /api/health.

  Ejecutar en PowerShell como Administrador, desde la carpeta del proyecto:
    cd D:\rcj-it-manager
    powershell -ExecutionPolicy Bypass -File .\scripts\instalar-servicio-windows.ps1

  Volver a ejecutarlo es seguro: actualiza la configuración del servicio existente.
#>
param(
  [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
  [string]$ServiceName = 'RCJITManager',
  [string]$NssmDir = 'C:\nssm',
  [string]$NssmExe = '',
  [switch]$SinPermisosEnv
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Paso($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Aviso($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Falla($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) { Falla 'Abre PowerShell como Administrador y vuelve a ejecutar el script.' }

$AppDir = (Resolve-Path $AppDir).Path
Paso "Proyecto: $AppDir"

$envFile = Join-Path $AppDir '.env'
if (-not (Test-Path $envFile)) { Falla "No existe $envFile. Créalo (MONGODB_URI, JWT_SECRET, PORT, ...) antes de instalar." }

$tsxCli = Join-Path $AppDir 'node_modules\tsx\dist\cli.mjs'
if (-not (Test-Path $tsxCli)) { Falla "No existe $tsxCli. Ejecuta 'npm install' y 'npm run build' en $AppDir." }

$port = 3001
$lineaPort = Select-String -Path $envFile -Pattern '^\s*PORT\s*=\s*(\d+)' | Select-Object -First 1
if ($lineaPort) { $port = [int]$lineaPort.Matches[0].Groups[1].Value }
Ok ".env encontrado (puerto $port)"

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Falla 'No se encontró node.exe en el PATH. Instala Node.js LTS.' }
Ok "Node: $node ($(& $node --version))"

# ── NSSM ──────────────────────────────────────────────────────────────────────
Paso 'NSSM'
if (-not $NssmExe) {
  $enPath = (Get-Command nssm -ErrorAction SilentlyContinue).Source
  if ($enPath) { $NssmExe = $enPath } else { $NssmExe = Join-Path $NssmDir 'nssm.exe' }
}

if (-not (Test-Path $NssmExe)) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $tmpZip = Join-Path $env:TEMP 'nssm.zip'
  $tmpDir = Join-Path $env:TEMP 'nssm-extract'
  $urls = @(
    'https://nssm.cc/release/nssm-2.24.zip',
    'https://nssm.cc/ci/nssm-2.24-101-g897c7ad.zip'
  )
  $descargado = $false
  foreach ($u in $urls) {
    try {
      Write-Host "    Descargando $u"
      Invoke-WebRequest -Uri $u -OutFile $tmpZip -UseBasicParsing -TimeoutSec 60
      $descargado = $true
      break
    } catch {
      Aviso "No se pudo descargar ($($_.Exception.Message))"
    }
  }
  if (-not $descargado) {
    Falla "No se pudo descargar NSSM. Descárgalo a mano desde https://nssm.cc/download, copia win64\nssm.exe a $NssmDir y vuelve a ejecutar."
  }
  if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
  Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
  $exe = Get-ChildItem $tmpDir -Recurse -Filter nssm.exe | Where-Object { $_.FullName -match '\\win64\\' } | Select-Object -First 1
  if (-not $exe) { Falla 'El zip de NSSM no contiene win64\nssm.exe.' }
  New-Item -ItemType Directory -Force $NssmDir | Out-Null
  Copy-Item $exe.FullName (Join-Path $NssmDir 'nssm.exe') -Force
  $NssmExe = Join-Path $NssmDir 'nssm.exe'
  Remove-Item $tmpZip, $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  if (($machinePath -split ';') -notcontains $NssmDir) {
    [Environment]::SetEnvironmentVariable('Path', "$machinePath;$NssmDir", 'Machine')
    Ok "$NssmDir agregado al PATH del sistema (abre una consola nueva para usar 'nssm')"
  }
}
Ok "NSSM: $NssmExe"

function Nssm {
  & $NssmExe @args 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Falla "nssm $($args -join ' ') terminó con código $LASTEXITCODE" }
}

# ── Puerto libre ──────────────────────────────────────────────────────────────
Paso 'Servicio'
$existe = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($existe -and $existe.Status -ne 'Stopped') {
  Write-Host "    Deteniendo servicio existente..."
  Stop-Service $ServiceName -Force
  Start-Sleep -Seconds 2
}

$ocupado = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($ocupado) {
  $proc = Get-Process -Id $ocupado.OwningProcess -ErrorAction SilentlyContinue
  Falla "El puerto $port está ocupado por '$($proc.ProcessName)' (PID $($ocupado.OwningProcess)). Cierra la consola de 'npm start' o ejecuta 'pm2 kill' y vuelve a intentar."
}

# ── Crear / actualizar servicio ───────────────────────────────────────────────
$logs = Join-Path $AppDir 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null

if (-not $existe) {
  Nssm install $ServiceName $node
  Ok "Servicio $ServiceName creado"
} else {
  Nssm set $ServiceName Application $node
  Ok "Servicio $ServiceName actualizado"
}
Nssm set $ServiceName AppParameters 'node_modules\tsx\dist\cli.mjs server\index.ts'
Nssm set $ServiceName AppDirectory $AppDir
Nssm set $ServiceName DisplayName 'RCJ IT Manager'
Nssm set $ServiceName Description "Portal RCJ IT Manager (Node, puerto $port)"
Nssm set $ServiceName Start SERVICE_AUTO_START
Nssm set $ServiceName AppEnvironmentExtra 'NODE_ENV=production'
Nssm set $ServiceName AppStdout (Join-Path $logs 'servicio.log')
Nssm set $ServiceName AppStderr (Join-Path $logs 'servicio-error.log')
Nssm set $ServiceName AppRotateFiles 1
Nssm set $ServiceName AppRotateOnline 1
Nssm set $ServiceName AppRotateBytes 10485760
Nssm set $ServiceName AppExit Default Restart
Nssm set $ServiceName AppRestartDelay 5000
Nssm set $ServiceName AppStopMethodConsole 10000
Ok 'Arranque automático, reinicio si falla, logs en .\logs'

# ── Permisos del .env ─────────────────────────────────────────────────────────
if (-not $SinPermisosEnv) {
  Paso 'Permisos de .env (solo Administradores y SYSTEM)'
  & icacls $envFile /inheritance:r /grant:r '*S-1-5-32-544:F' '*S-1-5-18:R' | Out-Null
  if ($LASTEXITCODE -ne 0) { Aviso 'No se pudieron ajustar los permisos del .env' } else { Ok 'Listo' }
}

# ── Arrancar y verificar ──────────────────────────────────────────────────────
Paso 'Arrancando'
Start-Service $ServiceName
$health = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 3
    if ($health.ok) { break }
  } catch { }
}

$estado = (Get-Service $ServiceName).Status
if (-not $health -or -not $health.ok) {
  Write-Host "    Estado del servicio: $estado" -ForegroundColor Yellow
  Write-Host "    Últimas líneas de servicio-error.log:" -ForegroundColor Yellow
  Get-Content (Join-Path $logs 'servicio-error.log') -Tail 20 -ErrorAction SilentlyContinue
  Falla "La app no respondió en http://127.0.0.1:$port/api/health"
}

Ok "Servicio: $estado"
Ok "Health: ok=$($health.ok) mongo=$($health.mongo)"
if ($health.mongo -ne 'connected') {
  Aviso 'La API responde pero Mongo aún no está conectado. Revisa MONGODB_URI y el acceso al servidor de base de datos.'
}

Write-Host @"

Listo. Comandos útiles:
  Get-Service $ServiceName
  Restart-Service $ServiceName
  Get-Content $logs\servicio-error.log -Tail 50
Para publicar cambios: git pull; npm install; npm run build; Restart-Service $ServiceName
"@

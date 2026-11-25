<#
  Arregla 503 en https://dev-portal.rcjcorp.hn/
  - Verifica Node :3001
  - Encuentra el sitio IIS por binding del host
  - Arranca App Pool
  - Escribe web.config reverse proxy → 127.0.0.1:3001
  - Habilita ARR proxy

  PowerShell Admin en el servidor Dev:
    powershell -ExecutionPolicy Bypass -File .\scripts\fix-dev-portal-503.ps1
#>
param(
  [string]$HostName = 'dev-portal.rcjcorp.hn',
  [int]$NodePort = 3001,
  [string]$ServiceName = 'RCJITManager'
)

$ErrorActionPreference = 'Stop'

function Assert-Admin {
  $ok = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $ok) { throw 'Ejecuta PowerShell como Administrador.' }
}

Assert-Admin
Import-Module WebAdministration

Write-Host "=== 1) Servicio Node ===" -ForegroundColor Cyan
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
  if ($svc.Status -ne 'Running') {
    Start-Service $ServiceName
    Start-Sleep 5
  }
  Write-Host "  $ServiceName = $((Get-Service $ServiceName).Status)"
} else {
  Write-Host "  Servicio $ServiceName no existe — se asume node manual en :$NodePort" -ForegroundColor Yellow
}

try {
  $health = Invoke-WebRequest "http://127.0.0.1:$NodePort/api/health" -UseBasicParsing -TimeoutSec 8
  Write-Host "  health :$NodePort -> $($health.StatusCode) $($health.Content)" -ForegroundColor Green
} catch {
  throw "Node no responde en :$NodePort. Arranca RCJITManager o npm start. $($_.Exception.Message)"
}

Write-Host "`n=== 2) Buscar sitio IIS por host $HostName ===" -ForegroundColor Cyan
$site = $null
foreach ($w in Get-Website) {
  foreach ($b in $w.bindings.Collection) {
    # bindingInformation: ip:port:hostname
    $parts = $b.bindingInformation -split ':', 3
    $hn = if ($parts.Count -ge 3) { $parts[2] } else { '' }
    if ($hn -and ($hn -eq $HostName -or $hn -like "*$HostName*" -or $HostName -like "*$hn*")) {
      $site = $w
      Write-Host "  Encontrado: $($w.Name)  binding=$($b.protocol) $($b.bindingInformation)" -ForegroundColor Green
      break
    }
  }
  if ($site) { break }
}

if (-not $site) {
  Write-Host "  No hay binding exacto. Sitios:" -ForegroundColor Yellow
  Get-Website | ForEach-Object {
    $binds = ($_.bindings.Collection | ForEach-Object { "$($_.protocol) $($_.bindingInformation)" }) -join ' | '
    Write-Host ("    {0}  path={1}  {2}" -f $_.Name, $_.physicalPath, $binds)
  }
  $name = Read-Host "Escribe el Name del sitio IIS a usar"
  $site = Get-Website -Name $name
}

$siteName = $site.Name
$phys = $site.physicalPath
$pool = $site.applicationPool
Write-Host "  Sitio=$siteName  Pool=$pool  Path=$phys"

if (-not (Test-Path -LiteralPath $phys)) {
  New-Item -ItemType Directory -Path $phys -Force | Out-Null
  Write-Host "  Creada carpeta física $phys" -ForegroundColor Yellow
}

Write-Host "`n=== 3) App Pool ===" -ForegroundColor Cyan
$state = (Get-WebAppPoolState -Name $pool).Value
Write-Host "  Estado actual: $state"
if ($state -ne 'Started') {
  Start-WebAppPool -Name $pool
  Start-Sleep 2
}
# Quitar Rapid-Fail si el pool se cae
Set-ItemProperty "IIS:\AppPools\$pool" -Name failure.rapidFailProtection -Value $false
Restart-WebAppPool -Name $pool
Start-Sleep 2
Write-Host "  App Pool ahora: $((Get-WebAppPoolState -Name $pool).Value)" -ForegroundColor Green

Write-Host "`n=== 4) ARR Enable proxy ===" -ForegroundColor Cyan
try {
  Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'enabled' -Value $true
  Write-Host "  proxy enabled=true" -ForegroundColor Green
} catch {
  Write-Host "  No se pudo habilitar ARR: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "  Instala Application Request Routing 3.0 si falta." -ForegroundColor Yellow
}

Write-Host "`n=== 5) web.config reverse proxy → :$NodePort ===" -ForegroundColor Cyan
$cfg = Join-Path $phys 'web.config'
if (Test-Path $cfg) {
  Copy-Item $cfg "$cfg.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')" -Force
}
@"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:$NodePort/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <httpErrors existingResponse="PassThrough" />
  </system.webServer>
</configuration>
"@ | Set-Content -Path $cfg -Encoding UTF8
Write-Host "  Escrito $cfg" -ForegroundColor Green

# Permitir serverVariables si hace falta en el futuro
try {
  Add-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" `
    -Filter "system.webServer/rewrite/allowedServerVariables" `
    -Name "." -Value @{name='HTTP_AUTHORIZATION'} -ErrorAction SilentlyContinue | Out-Null
} catch { }

Write-Host "`n=== 6) Pruebas ===" -ForegroundColor Cyan
Start-Sleep 2
try {
  $r1 = Invoke-WebRequest "http://127.0.0.1:$NodePort/api/health" -UseBasicParsing -TimeoutSec 5
  Write-Host "  directo Node: $($r1.StatusCode) $($r1.Content)" -ForegroundColor Green
} catch {
  Write-Host "  directo Node FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

foreach ($proto in @('http', 'https')) {
  try {
    # -SkipCertificateCheck no existe en Windows PowerShell 5; ignorar SSL errors
    if ($proto -eq 'https') {
      [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    }
    $r = Invoke-WebRequest "${proto}://127.0.0.1/api/health" -Headers @{ Host = $HostName } -UseBasicParsing -TimeoutSec 8
    Write-Host "  $proto Host=$HostName -> $($r.StatusCode) $($r.Content)" -ForegroundColor Green
  } catch {
    Write-Host "  $proto Host=$HostName -> $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host "`nAbre https://$HostName/ (Ctrl+F5)." -ForegroundColor Cyan
Write-Host "Si sigue 503: mira Event Viewer → Windows Logs → Application (IIS / WAS)."

#Requires -RunAsAdministrator
<#
  Configura bot.rcjcorp.hn en IIS (mismo sitio que el portal → Node :3001).
  Requisito: DNS A/CNAME de bot.rcjcorp.hn → IP pública del servidor.
  Certificado: idealmente *.rcjcorp.hn (o un cert con ese SAN).

  Uso:
    cd D:\rcj-it-manager\deploy
    .\setup-bot-hostname.ps1
    .\setup-bot-hostname.ps1 -SiteName "rcj-it-manager" -HostName "bot.rcjcorp.hn"
#>
param(
  [string]$SiteName = 'rcj-it-manager',
  [string]$HostName = 'bot.rcjcorp.hn',
  [int]$Port = 443
)

$ErrorActionPreference = 'Stop'
Import-Module WebAdministration -ErrorAction Stop
$appcmd = Join-Path $env:windir 'system32\inetsrv\appcmd.exe'

Write-Host "== Sitio IIS: $SiteName ==" -ForegroundColor Cyan
$site = Get-Website -Name $SiteName -ErrorAction Stop
Write-Host "  physicalPath: $($site.physicalPath)"

Write-Host '== Authorization en ARR (por si faltaba) ==' -ForegroundColor Cyan
& $appcmd set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_AUTHORIZATION']" /commit:apphost 2>$null
& $appcmd set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_X_AUTHORIZATION']" /commit:apphost 2>$null

Write-Host "== Binding https:${Port}:${HostName} ==" -ForegroundColor Cyan
$existing = Get-WebBinding -Name $SiteName -Protocol https -ErrorAction SilentlyContinue |
  Where-Object { $_.bindingInformation -match ":${Port}:$([regex]::Escape($HostName))$" }

if ($existing) {
  Write-Host '  Binding ya existe' -ForegroundColor Green
} else {
  # Cert: preferir *.rcjcorp.hn o el del hostname
  $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object {
    ($_.DnsNameList | ForEach-Object { $_.Unicode }) -contains $HostName -or
    ($_.DnsNameList | ForEach-Object { $_.Unicode }) -contains '*.rcjcorp.hn' -or
    $_.Subject -match 'rcjcorp\.hn'
  } | Sort-Object NotAfter -Descending | Select-Object -First 1

  if (-not $cert) {
    throw "No hay certificado en LocalMachine\My para $HostName o *.rcjcorp.hn. Instala el cert y reintenta."
  }
  Write-Host "  Cert: $($cert.Subject) thumb=$($cert.Thumbprint)"

  New-WebBinding -Name $SiteName -Protocol https -Port $Port -HostHeader $HostName -SslFlags 1
  # Asignar certificado al binding (SNI)
  $bind = Get-WebBinding -Name $SiteName -Protocol https |
    Where-Object { $_.bindingInformation -eq "*:${Port}:${HostName}" } |
    Select-Object -First 1
  if (-not $bind) {
    throw 'Binding creado pero no se pudo localizar para asignar certificado.'
  }
  $bind.AddSslCertificate($cert.Thumbprint, 'My')
  Write-Host '  Binding + certificado OK' -ForegroundColor Green
}

# Asegurar web.config con reinjection de Authorization
$physical = [Environment]::ExpandEnvironmentVariables($site.physicalPath)
$webConfigPath = Join-Path $physical 'web.config'
if (-not (Test-Path $webConfigPath)) {
  Write-Host '  AVISO: no hay web.config; corre antes .\fix-iis-pmo-auth.ps1' -ForegroundColor Yellow
} else {
  $xml = Get-Content -LiteralPath $webConfigPath -Raw
  if ($xml -notmatch 'HTTP_AUTHORIZATION') {
    Write-Host '  AVISO: web.config sin HTTP_AUTHORIZATION — corre .\fix-iis-pmo-auth.ps1' -ForegroundColor Yellow
  } else {
    Write-Host '  web.config con Authorization OK' -ForegroundColor Green
  }
}

Write-Host ''
Write-Host 'Siguiente:' -ForegroundColor Cyan
Write-Host "  1) DNS: $HostName → IP pública del servidor (igual que el portal)"
Write-Host '  2) Azure Bot → Messaging endpoint:'
Write-Host "       https://${HostName}/api/pmo/messages" -ForegroundColor Yellow
Write-Host '  3) Apply → Test in Web Chat → hola'
Write-Host '  4) Prueba:'
Write-Host "       curl.exe -sk https://${HostName}/api/pmo/bot-status"
Write-Host "       curl.exe -sk -H `"Authorization: Bearer TEST`" https://${HostName}/api/pmo/headers-echo"

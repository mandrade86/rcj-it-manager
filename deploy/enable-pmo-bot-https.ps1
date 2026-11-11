#Requires -RunAsAdministrator
<#
  Bypass IIS/ARR para el bot PMO Personal.
  ARR quita Authorization → auth=false. Este script:
    1) Exporta el certificado HTTPS de portal.rcjcorp.hn
    2) Abre firewall TCP 3443
    3) Escribe variables en .env
    4) Reinicia el servicio Node

  Luego en Azure Bot → Configuration → Messaging endpoint:
    https://portal.rcjcorp.hn:3443/api/pmo/messages

  Uso:
    cd D:\rcj-it-manager\deploy
    .\enable-pmo-bot-https.ps1
#>
param(
  [string]$SiteName = 'rcj-it-manager',
  [string]$HostName = 'portal.rcjcorp.hn',
  [int]$HttpsPort = 3443,
  [string]$RepoRoot = 'D:\rcj-it-manager',
  [string]$ServiceName = 'rcj-it-manager',
  [string]$PfxPassword = 'PmoBotLocalOnly'
)

$ErrorActionPreference = 'Stop'

Write-Host '== 1) Buscar certificado ==' -ForegroundColor Cyan
Import-Module WebAdministration -ErrorAction Stop

$binding = Get-WebBinding -Name $SiteName -Protocol https -ErrorAction SilentlyContinue |
  Where-Object { $_.bindingInformation -match [regex]::Escape($HostName) } |
  Select-Object -First 1

$thumb = $null
if ($binding) {
  try {
    $thumb = $binding.certificateHash
  } catch {}
  if (-not $thumb) {
    # bindingInformation / certificateHash vía appcmd
    $appcmd = Join-Path $env:windir 'system32\inetsrv\appcmd.exe'
    $raw = & $appcmd list site "$SiteName" /config 2>$null | Out-String
    if ($raw -match 'certificateHash="([A-F0-9]+)"') {
      $thumb = $Matches[1]
    }
  }
}

$cert = $null
if ($thumb) {
  $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $thumb } | Select-Object -First 1
}
if (-not $cert) {
  $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object {
    $_.Subject -match [regex]::Escape($HostName) -or
    ($_.DnsNameList -and ($_.DnsNameList | ForEach-Object { $_.Unicode }) -contains $HostName)
  } | Sort-Object NotAfter -Descending | Select-Object -First 1
}
if (-not $cert) {
  throw "No se encontró certificado para $HostName / sitio $SiteName. Indica el thumbprint manualmente exportando el PFX."
}
Write-Host "  Subject: $($cert.Subject)"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  HasPrivateKey: $($cert.HasPrivateKey)"

$sslDir = Join-Path $RepoRoot 'data\ssl'
New-Item -ItemType Directory -Force -Path $sslDir | Out-Null
$pfxPath = Join-Path $sslDir 'portal-bot.pfx'
$secure = ConvertTo-SecureString -String $PfxPassword -Force -AsPlainText

Write-Host '== 2) Exportar PFX ==' -ForegroundColor Cyan
try {
  Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secure | Out-Null
} catch {
  throw @"
No se pudo exportar la clave privada.
En IIS / Certificados: el certificado debe permitir exportar la clave privada,
o exporta manualmente a: $pfxPath
Error: $($_.Exception.Message)
"@
}
Write-Host "  OK: $pfxPath" -ForegroundColor Green

Write-Host "== 3) Firewall TCP $HttpsPort ==" -ForegroundColor Cyan
$ruleName = "RCJ PMO Bot HTTPS $HttpsPort"
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $HttpsPort -Action Allow | Out-Null
Write-Host '  Regla creada' -ForegroundColor Green

Write-Host '== 4) Variables en .env ==' -ForegroundColor Cyan
$envPath = Join-Path $RepoRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "No existe $envPath"
}
$envText = Get-Content -LiteralPath $envPath -Raw
function Set-EnvLine([string]$text, [string]$key, [string]$value) {
  $line = "$key=$value"
  if ($text -match "(?m)^$key=") {
    return [regex]::Replace($text, "(?m)^$key=.*$", $line)
  }
  if ($text -and -not $text.EndsWith("`n")) { $text += "`r`n" }
  return $text + $line + "`r`n"
}
$pfxRel = 'data/ssl/portal-bot.pfx'
$envText = Set-EnvLine $envText 'PMO_BOT_HTTPS_PORT' "$HttpsPort"
$envText = Set-EnvLine $envText 'PMO_BOT_SSL_PFX' $pfxRel
$envText = Set-EnvLine $envText 'PMO_BOT_SSL_PASSPHRASE' $PfxPassword
Set-Content -LiteralPath $envPath -Value $envText -Encoding UTF8
Write-Host '  PMO_BOT_HTTPS_PORT / PMO_BOT_SSL_PFX / PMO_BOT_SSL_PASSPHRASE' -ForegroundColor Green

Write-Host '== 5) Reiniciar servicio Node ==' -ForegroundColor Cyan
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
  Restart-Service -Name $ServiceName -Force
  Write-Host "  Reiniciado: $ServiceName" -ForegroundColor Green
} else {
  Write-Host "  Servicio '$ServiceName' no encontrado. Reinicia Node/NSSM a mano." -ForegroundColor Yellow
  Write-Host '  Servicios:'
  Get-Service | Where-Object { $_.Name -match 'rcj|pmo|it-manager|node' } | Format-Table Name, Status
}

Write-Host ''
Write-Host '== 6) Azure (manual) ==' -ForegroundColor Cyan
Write-Host "Abre Azure Bot → Configuration → Messaging endpoint y pon:"
Write-Host "  https://${HostName}:${HttpsPort}/api/pmo/messages" -ForegroundColor Yellow
Write-Host ''
Write-Host 'Prueba Web Chat. En el log debe salir auth=true y la línea:'
Write-Host "  PMO Personal bot HTTPS (bypass IIS): https://0.0.0.0:$HttpsPort/api/pmo/messages"

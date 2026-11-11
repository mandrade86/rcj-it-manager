#Requires -RunAsAdministrator
<#
  Verifica que PMO_BOT_APP_ID + PASSWORD + TENANT pueden obtener un token de Entra ID.
  Si esto falla, Web Chat nunca va a autenticar bien.

    cd D:\rcj-it-manager\deploy
    .\test-pmo-bot-creds.ps1
#>
$ErrorActionPreference = 'Stop'
$envPath = 'D:\rcj-it-manager\.env'
if (-not (Test-Path $envPath)) { throw "No existe $envPath" }

function Get-EnvValue([string]$text, [string]$key) {
  if ($text -match "(?m)^$key=(.*)$") {
    $v = $Matches[1].Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    return $v.Trim()
  }
  return ''
}

$raw = Get-Content -LiteralPath $envPath -Raw
$appId = Get-EnvValue $raw 'PMO_BOT_APP_ID'
$secret = Get-EnvValue $raw 'PMO_BOT_APP_PASSWORD'
$tenant = Get-EnvValue $raw 'PMO_BOT_TENANT_ID'
$type = Get-EnvValue $raw 'PMO_BOT_APP_TYPE'

Write-Host "AppId:  $appId"
Write-Host "Type:   $type"
Write-Host "Tenant: $tenant"
Write-Host "Secret length: $($secret.Length) (no se muestra)"

if (-not $appId -or -not $secret -or -not $tenant) {
  throw 'Faltan PMO_BOT_APP_ID / PMO_BOT_APP_PASSWORD / PMO_BOT_TENANT_ID en .env'
}

$tokenUrl = "https://login.microsoftonline.com/$tenant/oauth2/v2.0/token"
$body = @{
  grant_type    = 'client_credentials'
  client_id     = $appId
  client_secret = $secret
  scope         = 'https://api.botframework.com/.default'
}

try {
  $resp = Invoke-RestMethod -Method Post -Uri $tokenUrl -Body $body -ContentType 'application/x-www-form-urlencoded'
  if ($resp.access_token) {
    Write-Host 'TOKEN OK — el secreto y el tenant son válidos para Bot Framework.' -ForegroundColor Green
  } else {
    Write-Host ($resp | ConvertTo-Json -Depth 5) -ForegroundColor Yellow
  }
} catch {
  Write-Host 'TOKEN FAIL — revisa el client secret en Entra ID (Certificates & secrets) y PMO_BOT_APP_PASSWORD.' -ForegroundColor Red
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}

Write-Host ''
Write-Host 'Ahora, con el log abierto, en Azure Web Chat escribe hola.'
Write-Host 'Debes ver: [pmo-bot] POST ... type=message'
Write-Host 'Si NO aparece esa línea, Sophos/Azure no está llegando a :443 /api/pmo/messages'

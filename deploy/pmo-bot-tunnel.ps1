#Requires -RunAsAdministrator
<#
  Túnel temporal para que Azure (Internet) llegue al bot en :3443
  sin abrir el puerto en el firewall.

  Requisito: Node ya escuchando en https://127.0.0.1:3443
  (enable-pmo-bot-https.ps1 + servicio RCJITManager).

  Uso:
    cd D:\rcj-it-manager\deploy
    .\pmo-bot-tunnel.ps1

  Copia la URL https://xxxx.trycloudflare.com que imprime cloudflared
  y en Azure Bot → Configuration → Messaging endpoint pon:

    https://xxxx.trycloudflare.com/api/pmo/messages

  Save → Test in Web Chat → hola

  Esto es para PRUEBA. En producción: publicar TCP 3443 o túnel con nombre.
#>
$ErrorActionPreference = 'Stop'

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  Write-Host 'Instalando cloudflared...' -ForegroundColor Cyan
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'User')
  $cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
  if (-not $cloudflared) {
    throw 'No se encontró cloudflared tras instalar. Cierra y abre PowerShell e inténtalo de nuevo.'
  }
}

Write-Host 'Comprobando bot local :3443 ...' -ForegroundColor Cyan
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if ($curl) {
  & curl.exe -sk https://127.0.0.1:3443/api/pmo/bot-status
  Write-Host ''
}

Write-Host ''
Write-Host 'Iniciando túnel. Busca una línea: https://....trycloudflare.com' -ForegroundColor Yellow
Write-Host 'Azure Messaging endpoint = esa URL + /api/pmo/messages' -ForegroundColor Yellow
Write-Host 'Ctrl+C para detener el túnel.' -ForegroundColor DarkGray
Write-Host ''

& cloudflared tunnel --url https://127.0.0.1:3443 --no-tls-verify

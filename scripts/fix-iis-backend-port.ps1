<#
  Busca sitios IIS cuyo web.config apunte a 127.0.0.1:PUERTO_VIEJO
  y lo cambia a 127.0.0.1:PUERTO_NUEVO. Reinicia el App Pool.

  Dev (app en 3001, IIS aún en 3002) — PowerShell Admin:
    powershell -ExecutionPolicy Bypass -File .\scripts\fix-iis-backend-port.ps1 -FromPort 3002 -ToPort 3001

  Solo listar sin cambiar:
    .\scripts\fix-iis-backend-port.ps1 -FromPort 3002 -ToPort 3001 -WhatIf
#>
param(
  [int]$FromPort = 3002,
  [int]$ToPort = 3001,
  [string]$HostHint = 'dev-portal',
  [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) { throw 'Ejecuta como Administrador.' }

Import-Module WebAdministration -ErrorAction SilentlyContinue

Write-Host "=== Backend Node ===" -ForegroundColor Cyan
try {
  $h = Invoke-WebRequest "http://127.0.0.1:$ToPort/api/health" -UseBasicParsing -TimeoutSec 5
  Write-Host "OK :$ToPort -> $($h.Content)" -ForegroundColor Green
} catch {
  Write-Host "AVISO: nada responde en :$ToPort — arranca RCJITManager primero." -ForegroundColor Yellow
  Write-Host $_.Exception.Message
}

Write-Host "`n=== Sitios IIS ===" -ForegroundColor Cyan
Get-Website | ForEach-Object {
  $binds = ($_.bindings.Collection | ForEach-Object { $_.bindingInformation }) -join ', '
  Write-Host ("{0,-30} {1,-10} {2}" -f $_.Name, $_.State, $_.physicalPath)
  Write-Host ("  bindings: {0}" -f $binds)
}

$pattern = "127\.0\.0\.1:$FromPort"
$replacement = "127.0.0.1:$ToPort"
$roots = @('C:\inetpub', 'C:\Sites', 'D:\', 'P:\', 'E:\') | Where-Object { Test-Path $_ }

Write-Host "`n=== Buscando web.config con $pattern ===" -ForegroundColor Cyan
$hits = @()
foreach ($root in $roots) {
  Get-ChildItem $root -Filter web.config -Recurse -ErrorAction SilentlyContinue -Force |
    ForEach-Object {
      try {
        $text = Get-Content $_.FullName -Raw -ErrorAction Stop
        if ($text -match $pattern) {
          $hits += [pscustomobject]@{ Path = $_.FullName; Text = $text }
          Write-Host "  $($_.FullName)" -ForegroundColor Yellow
        }
      } catch { }
    }
}

if (-not $hits.Count) {
  Write-Host "No se encontró web.config con $pattern." -ForegroundColor Red
  Write-Host "Busca a mano en IIS Manager → sitio dev-portal → URL Rewrite → backend."
  exit 1
}

foreach ($hit in $hits) {
  Write-Host "`nActualizando $($hit.Path)" -ForegroundColor Cyan
  if ($WhatIf) {
    Write-Host "  [WhatIf] $pattern -> $replacement"
    continue
  }
  $backup = "$($hit.Path).bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item $hit.Path $backup -Force
  $newText = $hit.Text -replace $pattern, $replacement
  Set-Content -Path $hit.Path -Value $newText -Encoding UTF8
  Write-Host "  Backup: $backup"
  Write-Host "  OK: ahora apunta a $replacement" -ForegroundColor Green
}

Write-Host "`n=== Reinicio App Pools ===" -ForegroundColor Cyan
Get-Website | ForEach-Object {
  $name = $_.Name
  $pool = $_.applicationPool
  if ($name -match $HostHint -or $name -match 'rcj|portal|dev') {
    try {
      Restart-WebAppPool -Name $pool
      Write-Host "  Restart-WebAppPool $pool (sitio $name)" -ForegroundColor Green
    } catch {
      Write-Host "  No se pudo reiniciar pool $pool: $($_.Exception.Message)" -ForegroundColor Yellow
    }
  }
}

Start-Sleep -Seconds 2
Write-Host "`n=== Prueba por Host header ===" -ForegroundColor Cyan
foreach ($hostName in @('dev-portal.rcjcorp.hn', 'portal-dev.rcjcorp.hn')) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1/api/health" -Headers @{ Host = $hostName } -UseBasicParsing -TimeoutSec 8
    Write-Host "  $hostName -> $($r.StatusCode) $($r.Content)" -ForegroundColor Green
  } catch {
    Write-Host "  $hostName -> $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host "`nListo. Recarga https://dev-portal.rcjcorp.hn/" -ForegroundColor Green

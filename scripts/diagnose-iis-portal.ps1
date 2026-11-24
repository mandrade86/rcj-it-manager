<#
  Diagnóstico IIS + Node para el portal Dev.
  PowerShell Admin:
    powershell -ExecutionPolicy Bypass -File .\scripts\diagnose-iis-portal.ps1
#>
param(
  [string[]]$HostHints = @('dev-portal', 'portal-dev', 'rcj', 'portal')
)

$ErrorActionPreference = 'Continue'

Write-Host "=== 1) Node local ===" -ForegroundColor Cyan
foreach ($p in 3001, 3002) {
  $listen = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  try {
    $h = Invoke-WebRequest "http://127.0.0.1:$p/api/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "  :$p LISTEN=$([bool]$listen) health=$($h.StatusCode) $($h.Content)" -ForegroundColor Green
  } catch {
    Write-Host "  :$p LISTEN=$([bool]$listen) health=FAIL $($_.Exception.Message)" -ForegroundColor Yellow
  }
}
Get-Service RCJITManager -ErrorAction SilentlyContinue | Format-Table Status, Name, DisplayName

Write-Host "`n=== 2) Sitios IIS ===" -ForegroundColor Cyan
Import-Module WebAdministration -ErrorAction SilentlyContinue
Get-Website | ForEach-Object {
  $binds = @($_.bindings.Collection | ForEach-Object {
    "$($_.protocol) $($_.bindingInformation)"
  }) -join ' | '
  $mark = ''
  foreach ($h in $HostHints) {
    if ($_.Name -match $h -or $binds -match $h) { $mark = ' <== candidato'; break }
  }
  Write-Host ("{0}{1}" -f $_.Name, $mark) -ForegroundColor $(if ($mark) { 'Yellow' } else { 'White' })
  Write-Host ("  State={0}  Pool={1}" -f $_.State, $_.applicationPool)
  Write-Host ("  PhysicalPath={0}" -f $_.physicalPath)
  Write-Host ("  Bindings={0}" -f $binds)
  $pool = Get-WebAppPoolState -Name $_.applicationPool -ErrorAction SilentlyContinue
  if ($pool) { Write-Host ("  AppPoolState={0}" -f $pool.Value) }
}

Write-Host "`n=== 3) Buscar rewrite / puertos en web.config ===" -ForegroundColor Cyan
$roots = @('C:\inetpub', 'C:\Sites', 'C:\www', 'D:\', 'P:\', 'E:\') | Where-Object { Test-Path $_ }
foreach ($root in $roots) {
  Get-ChildItem $root -Filter web.config -Recurse -ErrorAction SilentlyContinue -Force |
    ForEach-Object {
      $t = ''
      try { $t = Get-Content $_.FullName -Raw -ErrorAction Stop } catch { return }
      if ($t -match '127\.0\.0\.1:\d+|localhost:\d+|Rewrite|proxy|arr' ) {
        Write-Host "  $($_.FullName)" -ForegroundColor Yellow
        ($t -split "`n" | Where-Object { $_ -match '127\.0\.0\.1|localhost:\d+|url=|Rewrite' }) |
          Select-Object -First 8 |
          ForEach-Object { Write-Host "    $($_.Trim())" }
      }
    }
}

Write-Host "`n=== 4) applicationHost.config (reglas globales) ===" -ForegroundColor Cyan
$ah = "$env:windir\System32\inetsrv\config\applicationHost.config"
if (Test-Path $ah) {
  Select-String -Path $ah -Pattern '127\.0\.0\.1:30|localhost:30|dev-portal|portal-dev' -ErrorAction SilentlyContinue |
    Select-Object -First 20 |
    ForEach-Object { Write-Host "  $($_.Line.Trim())" }
}

Write-Host "`n=== 5) ARR proxy habilitado? ===" -ForegroundColor Cyan
try {
  $proxy = Get-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name 'enabled' -ErrorAction Stop
  Write-Host "  ARR proxy enabled = $($proxy.Value)"
} catch {
  Write-Host "  No se pudo leer proxy ARR (¿ARR instalado?): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== 6) Prueba Host header ===" -ForegroundColor Cyan
foreach ($hn in @('dev-portal.rcjcorp.hn', 'portal-dev.rcjcorp.hn', 'localhost')) {
  try {
    $r = Invoke-WebRequest "http://127.0.0.1/api/health" -Headers @{ Host = $hn } -UseBasicParsing -TimeoutSec 5
    Write-Host "  Host=$hn -> $($r.StatusCode) $($r.Content)" -ForegroundColor Green
  } catch {
    Write-Host "  Host=$hn -> $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host "`nListo. Pega esta salida completa en el chat." -ForegroundColor Cyan

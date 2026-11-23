<#
  Concede al agente Azure (Servicio de red) permiso de Start/Stop/Restart
  sobre RCJITManager. Sin esto el pipeline falla con:
  "No se puede abrir el servicio RCJITManager".

  PowerShell como Administrador (una vez en el servidor Dev/Prod):
    powershell -ExecutionPolicy Bypass -File .\scripts\grant-agent-service-control.ps1
#>
param(
  [string]$ServiceName = 'RCJITManager',
  # SDDL short name for NT AUTHORITY\NETWORK SERVICE
  [string]$TrusteeSddl = 'NS'
)

$ErrorActionPreference = 'Stop'

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) { throw 'Ejecuta como Administrador.' }

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) { throw "No existe el servicio '$ServiceName'." }

# Derechos: query config/status, start, stop, pause, interrogate, read control
$ace = "(A;;CCLCSWRPWPDTLOCRRC;;;$TrusteeSddl)"

$raw = & sc.exe sdshow $ServiceName 2>&1 | Out-String
$sddl = ($raw -split "`r?`n" | Where-Object { $_ -match '^\s*D:' } | Select-Object -First 1)
if (-not $sddl) { $sddl = ($raw -replace '\s+', ' ').Trim() }
$sddl = $sddl.Trim()
if (-not $sddl) { throw "sc sdshow $ServiceName no devolvió SDDL." }

if ($sddl -match [regex]::Escape(";;;$TrusteeSddl)")) {
  Write-Host "Ya tiene ACE para $TrusteeSddl — OK" -ForegroundColor Green
  Write-Host $sddl
  exit 0
}

if ($sddl -notmatch '^D:') {
  throw "SDDL inesperado: $sddl"
}

$newSddl = $sddl -replace '^D:', "D:$ace"
Write-Host "SDDL anterior: $sddl"
Write-Host "SDDL nuevo:    $newSddl"

& sc.exe sdset $ServiceName $newSddl | Out-Null
if ($LASTEXITCODE -ne 0) { throw "sc sdset falló (exit $LASTEXITCODE)" }

Write-Host "OK: $TrusteeSddl puede controlar '$ServiceName'." -ForegroundColor Green
Write-Host "Re-ejecuta el pipeline Deploy Dev."

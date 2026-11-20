<#
  Marca P:\rcj-it-manager (u otra ruta) como safe.directory para Git.
  Útil cuando el agente (Servicio de red) clonó el repo y tu usuario recibe
  "detected dubious ownership".

  PowerShell como Administrador (recomendado, queda para todos):
    powershell -ExecutionPolicy Bypass -File .\scripts\fix-git-safe-directory.ps1

  Solo tu usuario (sin admin):
    powershell -ExecutionPolicy Bypass -File .\scripts\fix-git-safe-directory.ps1 -SoloUsuario
#>
param(
  [string]$RepoPath = 'P:\rcj-it-manager',
  [switch]$SoloUsuario
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "No existe $RepoPath"
}

$safe = ((Resolve-Path -LiteralPath $RepoPath).Path -replace '\\', '/')
Write-Host "safe.directory = $safe"

if ($SoloUsuario) {
  git config --global --add safe.directory $safe
  Write-Host "OK (global de este usuario)" -ForegroundColor Green
  exit 0
}

$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) {
  throw 'Ejecuta como Administrador, o usa -SoloUsuario'
}

git config --system --add safe.directory $safe
git config --global --add safe.directory $safe
Write-Host "OK (system + global)" -ForegroundColor Green
Write-Host "Prueba: cd $RepoPath; git status"

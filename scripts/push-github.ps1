# Crea el repo en GitHub y hace push (requiere: gh auth login)
# Uso: .\scripts\push-github.ps1
#      .\scripts\push-github.ps1 -RepoName rcj-it-manager -Private
param(
  [string]$RepoName = 'rcj-it-manager',
  [switch]$Private = $true,
  [switch]$Public
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host 'Instala GitHub CLI: https://cli.github.com/'
  exit 1
}

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Inicia sesión en GitHub:'
  gh auth login
}

$visibility = if ($Public) { '--public' } else { '--private' }

if (git rev-parse HEAD 2>$null) {
  Write-Host 'Commit inicial ya existe.'
} else {
  git add -A
  git commit -m @'
Initial commit: RCJ IT Manager

App full-stack local (React, Express, MongoDB) con Plan IT 2026,
equipo, capacitaciones, gastos OPEX, KPIs y despliegue Docker.
'@
}

$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creando repositorio $RepoName en GitHub…"
  gh repo create $RepoName $visibility --source=. --remote=origin --description 'RCJ IT Manager — Plan IT 2026'
} else {
  Write-Host "Remote origin ya configurado: $remote"
}

Write-Host 'Push a origin main…'
git push -u origin main
Write-Host 'Listo. URL:'
gh repo view --web 2>$null | Out-Null
gh repo view --json url -q .url

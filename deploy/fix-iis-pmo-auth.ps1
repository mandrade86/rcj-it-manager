#Requires -RunAsAdministrator
<#
  Arregla Authorization hacia Node (auth=false en [pmo-bot]).
  Ejecutar en el SERVIDOR del portal, PowerShell Admin:

    cd D:\rcj-it-manager\deploy
    .\fix-iis-pmo-auth.ps1 -SiteName "portal.rcjcorp.hn"

  Si no encuentra la carpeta del sitio:

    .\fix-iis-pmo-auth.ps1 -SiteName "portal.rcjcorp.hn" -PhysicalPath "C:\inetpub\wwwroot\portal"
#>
param(
  [string]$SiteName = '',
  [string]$Backend = 'http://127.0.0.1:3001',
  [string]$PhysicalPath = ''
)

$ErrorActionPreference = 'Stop'
$appcmd = Join-Path $env:windir 'system32\inetsrv\appcmd.exe'
if (-not (Test-Path $appcmd)) {
  throw 'IIS appcmd no encontrado. ¿Está instalado IIS?'
}

function Get-SitePhysicalPath {
  param([string]$Name)

  # 1) WebAdministration (más fiable)
  try {
    Import-Module WebAdministration -ErrorAction Stop
    $site = Get-Website -Name $Name -ErrorAction Stop
    $p = $site.physicalPath
    if ($p) {
      # Expande %SystemDrive% etc.
      $p = [Environment]::ExpandEnvironmentVariables($p)
      if (Test-Path -LiteralPath $p) { return $p }
    }
  } catch {
    Write-Host "  (WebAdministration: $($_.Exception.Message))" -ForegroundColor DarkYellow
  }

  # 2) appcmd list app
  try {
    $raw = & $appcmd list app /site.name:"$Name" /text:path 2>$null
    $appPath = @($raw | Where-Object { $_ -and $_.ToString().Trim() }) | Select-Object -First 1
    if (-not $appPath) { $appPath = '/' }
    $vraw = & $appcmd list vdir "$Name$appPath" /text:physicalPath 2>$null
    $p = @($vraw | Where-Object { $_ -and $_.ToString().Trim() }) | Select-Object -First 1
    if ($p) {
      $p = [Environment]::ExpandEnvironmentVariables($p.ToString().Trim())
      if (Test-Path -LiteralPath $p) { return $p }
    }
  } catch {
    Write-Host "  (appcmd app: $($_.Exception.Message))" -ForegroundColor DarkYellow
  }

  # 3) appcmd list vdir SITE/
  foreach ($key in @("$Name/", "${Name}/")) {
    $vraw = & $appcmd list vdir $key /text:physicalPath 2>$null
    $p = @($vraw | Where-Object { $_ -and $_.ToString().Trim() }) | Select-Object -First 1
    if ($p) {
      $p = [Environment]::ExpandEnvironmentVariables($p.ToString().Trim())
      if (Test-Path -LiteralPath $p) { return $p }
    }
  }

  # 4) listar todos los vdir y filtrar
  $all = & $appcmd list vdir 2>$null
  foreach ($line in @($all)) {
    if ($line -match [regex]::Escape("VDIR `"$Name/") -and $line -match 'physicalPath:"([^"]+)"') {
      $p = [Environment]::ExpandEnvironmentVariables($Matches[1])
      if (Test-Path -LiteralPath $p) { return $p }
    }
  }

  return $null
}

Write-Host '== 1) ARR proxy + serverVariables ==' -ForegroundColor Cyan
& $appcmd unlock config -section:system.webServer/proxy 2>$null
& $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /commit:apphost

foreach ($var in @('HTTP_AUTHORIZATION', 'HTTP_X_AUTHORIZATION')) {
  $out = & $appcmd set config -section:system.webServer/rewrite/allowedServerVariables "/+[name='$var']" /commit:apphost 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -and $out -notmatch 'already exists|duplicate|ya existe') {
    Write-Host $out -ForegroundColor Yellow
  } else {
    Write-Host "  allowed: $var"
  }
}

Write-Host '== 2) Sitios IIS ==' -ForegroundColor Cyan
& $appcmd list sites
if (-not $SiteName) {
  try {
    Import-Module WebAdministration -ErrorAction Stop
    $guess = Get-Website | Where-Object { $_.Name -match 'portal|rcjcorp|rcj' } | Select-Object -First 1
    if ($guess) {
      $SiteName = $guess.Name
      Write-Host "Usando sitio: $SiteName" -ForegroundColor Green
    }
  } catch {}
  if (-not $SiteName) {
    throw 'Indica -SiteName "NombreExactoDelSitio" (mira la lista arriba).'
  }
}

Write-Host "== 3) Auth del sitio: $SiteName ==" -ForegroundColor Cyan
& $appcmd set config "$SiteName" /section:anonymousAuthentication /enabled:true /commit:apphost
& $appcmd set config "$SiteName" /section:windowsAuthentication /enabled:false /commit:apphost

Write-Host '== 4) Ubicación física del sitio ==' -ForegroundColor Cyan
$physical = $PhysicalPath
if ($physical) {
  $physical = [Environment]::ExpandEnvironmentVariables($physical)
} else {
  $physical = Get-SitePhysicalPath -Name $SiteName
}

if (-not $physical -or -not (Test-Path -LiteralPath $physical)) {
  Write-Host ''
  Write-Host 'No se encontró la carpeta del sitio. En IIS Manager:' -ForegroundColor Yellow
  Write-Host '  Sitios → tu sitio → panel derecho Basic Settings → Physical path'
  Write-Host ''
  Write-Host 'Luego vuelve a correr:' -ForegroundColor Yellow
  Write-Host "  .\fix-iis-pmo-auth.ps1 -SiteName `"$SiteName`" -PhysicalPath `"C:\ruta\del\sitio`""
  Write-Host ''
  Write-Host 'O lista rutas con:' -ForegroundColor Yellow
  Write-Host '  Import-Module WebAdministration; Get-Website | Format-Table Name, physicalPath'
  throw "physicalPath vacío para '$SiteName'"
}
Write-Host "  path: $physical"

$webConfigPath = Join-Path $physical 'web.config'
$backup = Join-Path $physical ("web.config.bak-{0:yyyyMMdd-HHmmss}" -f (Get-Date))

$webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por fix-iis-pmo-auth.ps1 — Authorization hacia Node -->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyInboundRule1" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="$Backend/{R:1}" />
          <serverVariables>
            <set name="HTTP_AUTHORIZATION" value="{HTTP_AUTHORIZATION}" />
            <set name="HTTP_X_AUTHORIZATION" value="{HTTP_AUTHORIZATION}" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
"@

if (Test-Path -LiteralPath $webConfigPath) {
  Copy-Item -LiteralPath $webConfigPath -Destination $backup -Force
  Write-Host "  backup: $backup" -ForegroundColor Yellow
}

Set-Content -LiteralPath $webConfigPath -Value $webConfig -Encoding UTF8
Write-Host "  escrito: $webConfigPath" -ForegroundColor Green

Write-Host '== 5) iisreset ==' -ForegroundColor Cyan
iisreset

Write-Host ''
Write-Host 'Listo. Prueba Azure Web Chat y mira el log del servicio:' -ForegroundColor Green
Write-Host '  Debe decir: [pmo-bot] ... auth=true'
Write-Host 'Si el sitio cae (500), restaura el backup y revisa allowedServerVariables.'

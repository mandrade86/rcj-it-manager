#Requires -RunAsAdministrator
<#
  Arregla Authorization hacia Node (auth=false en [pmo-bot]).
  Ejecutar en el SERVIDOR del portal, PowerShell Admin:

    cd D:\rcj-it-manager\deploy   # o la ruta real del repo en el servidor
    .\fix-iis-pmo-auth.ps1 -SiteName "portal.rcjcorp.hn"

  Si no sabes el nombre del sitio, omite -SiteName y el script lista sitios.
#>
param(
  [string]$SiteName = '',
  [string]$Backend = 'http://127.0.0.1:3001'
)

$ErrorActionPreference = 'Stop'
$appcmd = Join-Path $env:windir 'system32\inetsrv\appcmd.exe'
if (-not (Test-Path $appcmd)) {
  throw 'IIS appcmd no encontrado. ¿Está instalado IIS?'
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
$sitesXml = & $appcmd list sites /xml
[xml]$sitesDoc = $sitesXml
$sites = @($sitesDoc.appcmd.SITE)
if (-not $sites -or $sites.Count -eq 0) {
  # fallback texto
  & $appcmd list sites
  throw 'No se pudieron listar sitios. Pasa -SiteName manualmente.'
}

if (-not $SiteName) {
  Write-Host 'Sitios encontrados:'
  foreach ($s in $sites) {
    Write-Host ("  - {0}" -f $s.SITE.NAME)
  }
  # Heurística: nombre con portal o rcj
  $guess = $sites | Where-Object {
    $n = $_.SITE.NAME
    $n -match 'portal|rcjcorp|rcj'
  } | Select-Object -First 1
  if ($guess) {
    $SiteName = $guess.SITE.NAME
    Write-Host "Usando sitio: $SiteName" -ForegroundColor Green
  } else {
    throw 'Indica -SiteName "NombreExactoDelSitio"'
  }
}

Write-Host "== 3) Auth del sitio: $SiteName ==" -ForegroundColor Cyan
& $appcmd set config "$SiteName" /section:anonymousAuthentication /enabled:true /commit:apphost
& $appcmd set config "$SiteName" /section:windowsAuthentication /enabled:false /commit:apphost

Write-Host '== 4) Ubicación física del sitio ==' -ForegroundColor Cyan
$vdir = & $appcmd list vdir "$SiteName/" /text:physicalPath
$physical = ($vdir | Select-Object -First 1).ToString().Trim()
if (-not $physical -or -not (Test-Path $physical)) {
  throw "No se encontró physicalPath para $SiteName (obtuve: '$physical')"
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

if (Test-Path $webConfigPath) {
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

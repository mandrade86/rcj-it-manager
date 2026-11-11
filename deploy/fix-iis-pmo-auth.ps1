#Requires -RunAsAdministrator
<#
  Reinyecta Authorization a través de IIS/ARR (para usar :443 sin puerto extra).

    cd D:\rcj-it-manager\deploy
    .\fix-iis-pmo-auth.ps1 -SiteName "rcj-it-manager" -PhysicalPath "D:\rcj-it-manager"
#>
param(
  [string]$SiteName = 'rcj-it-manager',
  [string]$Backend = 'http://127.0.0.1:3001',
  [string]$PhysicalPath = 'D:\rcj-it-manager'
)

$ErrorActionPreference = 'Stop'
$appcmd = Join-Path $env:windir 'system32\inetsrv\appcmd.exe'
if (-not (Test-Path $appcmd)) { throw 'IIS appcmd no encontrado.' }

Import-Module WebAdministration -ErrorAction SilentlyContinue

Write-Host '== 1) ARR proxy + allowedServerVariables ==' -ForegroundColor Cyan
& $appcmd unlock config -section:system.webServer/proxy 2>$null
& $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /commit:apphost

foreach ($var in @('HTTP_AUTHORIZATION', 'HTTP_X_AUTHORIZATION')) {
  $out = & $appcmd set config -section:system.webServer/rewrite/allowedServerVariables "/+[name='$var']" /commit:apphost 2>&1 | Out-String
  if ($out -match 'already exists|duplicate|ya existe' -or $LASTEXITCODE -eq 0) {
    Write-Host "  allowed: $var"
  } else {
    Write-Host $out -ForegroundColor Yellow
  }
}

Write-Host "== 2) Auth del sitio $SiteName (Anonymous on / Windows off) ==" -ForegroundColor Cyan
& $appcmd set config "$SiteName" /section:anonymousAuthentication /enabled:true /commit:apphost
& $appcmd set config "$SiteName" /section:windowsAuthentication /enabled:false /commit:apphost
foreach ($sec in @('basicAuthentication', 'digestAuthentication', 'clientCertificateMappingAuthentication', 'iisClientCertificateMappingAuthentication')) {
  & $appcmd set config "$SiteName" "/section:$sec" /enabled:false /commit:apphost 2>$null
}

$physical = [Environment]::ExpandEnvironmentVariables($PhysicalPath)
if (-not (Test-Path -LiteralPath $physical)) {
  throw "PhysicalPath no existe: $physical"
}
Write-Host "== 3) web.config en $physical ==" -ForegroundColor Cyan

$webConfigPath = Join-Path $physical 'web.config'
$backup = Join-Path $physical ("web.config.bak-{0:yyyyMMdd-HHmmss}" -f (Get-Date))
if (Test-Path -LiteralPath $webConfigPath) {
  Copy-Item -LiteralPath $webConfigPath -Destination $backup -Force
  Write-Host "  backup: $backup" -ForegroundColor Yellow
}

$webConfig = @"
<?xml version="1.0" encoding="UTF-8"?>
<!-- Generado por fix-iis-pmo-auth.ps1 -->
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="PmoCaptureAuthorization" stopProcessing="false">
          <match url=".*" />
          <conditions>
            <add input="{HTTP_AUTHORIZATION}" pattern=".+" />
          </conditions>
          <serverVariables>
            <set name="HTTP_X_AUTHORIZATION" value="{HTTP_AUTHORIZATION}" replace="true" />
          </serverVariables>
          <action type="None" />
        </rule>
        <rule name="ReverseProxyInboundRule1" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="$Backend/{R:1}" />
          <serverVariables>
            <set name="HTTP_AUTHORIZATION" value="{HTTP_AUTHORIZATION}" replace="true" />
            <set name="HTTP_X_AUTHORIZATION" value="{HTTP_X_AUTHORIZATION}" replace="true" />
          </serverVariables>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
"@

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($webConfigPath, $webConfig, $utf8)
Write-Host "  escrito: $webConfigPath" -ForegroundColor Green

Write-Host '== 4) iisreset ==' -ForegroundColor Cyan
iisreset

Write-Host ''
Write-Host 'Prueba (desde el servidor):' -ForegroundColor Green
Write-Host '  curl.exe -sk -H "Authorization: Bearer TEST-IIS" https://portal.rcjcorp.hn/api/pmo/headers-echo'
Write-Host 'Debe decir: "authorization":true  (o al menos "x_authorization":true)'
Write-Host ''
Write-Host 'Si ambos son false: Sophos (WAF) está quitando el header ANTES de IIS.'
Write-Host 'Excepción WAF para /api/pmo/* — ver PMO-IIS-AUTH.md'

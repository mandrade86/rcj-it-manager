# PMO Personal: Authorization llega como `auth=false`

Azure/Teams **sí** pegan a Node, pero IIS/ARR elimina el header `Authorization`.
Sin ese header el Bot Framework no valida y no responde.

## Opción A — Arreglar IIS (recomendado)

### 1. Comandos (PowerShell **Administrador**)

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" unlock config -section:system.webServer/proxy
& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /commit:apphost

& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_AUTHORIZATION']" /commit:apphost
& "$env:windir\system32\inetsrv\appcmd.exe" set config -section:system.webServer/rewrite/allowedServerVariables /+"[name='HTTP_X_AUTHORIZATION']" /commit:apphost
```

Si dice que ya existe la variable, ignora el error.

### 2. Authentication del sitio

IIS Manager → sitio **portal.rcjcorp.hn** → **Authentication**:

- Anonymous Authentication → **Enabled**
- Windows Authentication → **Disabled**
- Basic / Digest → Disabled

### 3. web.config

Copia el contenido de [`iis-portal.web.config.example`](iis-portal.web.config.example) al `web.config` del sitio.
El bloque `<serverVariables>` debe estar **dentro** de `<rule>`.

```powershell
iisreset
```

### 4. Verificar

```powershell
Get-Content D:\rcj-it-manager\logs\servicio.log -Wait -Tail 5
```

Azure → Test in Web Chat → `hola`

Debes ver: `auth=true`

En el log también verás `headers=...`. Si no aparece `authorization` en la lista, IIS sigue quitándolo.

### 5. Si la UI de IIS es más fiable que el XML

1. IIS → sitio → URL Rewrite → tu regla ReverseProxy…
2. Panel derecho → **View Server Variables…** / Server Variables → Add  
   - Name: `HTTP_AUTHORIZATION`  
   - Value: `{HTTP_AUTHORIZATION}`
3. Add también `HTTP_X_AUTHORIZATION` = `{HTTP_AUTHORIZATION}`
4. Apply → `iisreset`

## Opción B — Bypass IIS (si A no funciona)

Exponer Node en un puerto HTTPS propio solo para el bot (sin ARR), por ejemplo `3443`, y en Azure Bot poner:

```text
https://portal.rcjcorp.hn:3443/api/pmo/messages
```

Eso requiere certificado en Node y abrir el puerto en el firewall. Pídelo si la opción A sigue en `auth=false`.

# Hostnames del messaging endpoint — PMO Personal

| Ambiente | Messaging endpoint |
|---|---|
| **Producción** | `https://bot.rcjcorp.hn/api/pmo/messages` |
| **Desarrollo** | `https://dev-bot.rcjcorp.hn/api/pmo/messages` |

Puerto **443** (sin `:3443`).

## 1. DNS

| Host | Apunta a |
|---|---|
| `bot.rcjcorp.hn` | IP pública del servidor de **producción** |
| `dev-bot.rcjcorp.hn` | IP pública del servidor de **desarrollo** (o la misma si es un solo box) |

## 2. IIS

**Producción**

```powershell
cd D:\rcj-it-manager
git pull
cd deploy
.\setup-bot-hostname.ps1
# default: -HostName bot.rcjcorp.hn
```

**Desarrollo**

```powershell
cd D:\rcj-it-manager\deploy
.\setup-bot-hostname.ps1 -HostName "dev-bot.rcjcorp.hn"
```

Si Authorization falla (`auth=false`):

```powershell
.\fix-iis-pmo-auth.ps1 -SiteName "rcj-it-manager" -PhysicalPath "D:\rcj-it-manager"
```

## 3. Azure Bot

Usa el endpoint del ambiente correspondiente:

```text
# Prod
https://bot.rcjcorp.hn/api/pmo/messages

# Dev
https://dev-bot.rcjcorp.hn/api/pmo/messages
```

**Apply** → Test in Web Chat → `hola`.

## 4. Comprobar

```powershell
# Prod
curl.exe -sk https://bot.rcjcorp.hn/api/pmo/bot-status
curl.exe -sk -H "Authorization: Bearer TEST" https://bot.rcjcorp.hn/api/pmo/headers-echo

# Dev
curl.exe -sk https://dev-bot.rcjcorp.hn/api/pmo/bot-status
curl.exe -sk -H "Authorization: Bearer TEST" https://dev-bot.rcjcorp.hn/api/pmo/headers-echo

Get-Content D:\rcj-it-manager\logs\servicio.log -Wait -Tail 5
```

`headers-echo` → `"authorization":true`. Web Chat → `[pmo-bot] ... type=message`.

## 5. Teams app

El manifest incluye ambos hosts en `validDomains`. Regenera el ZIP si cambias el manifest y súbelo a Teams.

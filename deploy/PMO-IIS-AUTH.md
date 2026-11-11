# Authorization en :443 (IIS/ARR + Sophos)

Azure debe usar:

```text
https://portal.rcjcorp.hn/api/pmo/messages
```

Sin puerto extra. Si llega `auth=false`, el header se pierde en **Sophos** o en **IIS/ARR**.

## 1) Diagnóstico (obligatorio)

En el servidor (tras `git pull` + `Restart-Service RCJITManager`):

```powershell
curl.exe -sk -H "Authorization: Bearer TEST-IIS" https://portal.rcjcorp.hn/api/pmo/headers-echo
```

| Resultado | Significado |
|---|---|
| `"authorization":true` | IIS/ARR OK → prueba Web Chat |
| `"x_authorization":true` y authorization false | ARR casi OK; Node ya copia `x-authorization` |
| **ambos false** | El header **no llega** a Node → suele ser **Sophos WAF** (o auth de IIS) |

Comparar sin IIS (bypass local):

```powershell
curl.exe -sk -H "Authorization: Bearer TEST-IIS" https://127.0.0.1:3443/api/pmo/headers-echo
```

(Ahí debería ser `authorization:true` si el bypass sigue activo.)

## 2) Arreglar IIS/ARR

```powershell
cd D:\rcj-it-manager\deploy
.\fix-iis-pmo-auth.ps1 -SiteName "rcj-it-manager" -PhysicalPath "D:\rcj-it-manager"
```

Vuelve a correr el `headers-echo` del paso 1.

## 3) Si sigue false → excepción en Sophos

El WAF / HTTP protection de Sophos a veces **elimina `Authorization`** en HTTPS inspeccionado.

En Sophos Firewall:

1. **Protect → Web server protection** (o **WAF**) → el sitio / protected zone de `portal.rcjcorp.hn`
2. **Exceptions** → Add:
   - Path / URL: `/api/pmo/*` (o host `portal.rcjcorp.hn` + path)
   - Skip / disable: **HTTP header filtering**, **Authentication**, **Protocol enforcement** agresivo que toque headers
3. Si usan **DPI / Decrypt & scan HTTPS** hacia el portal: añade excepción para no alterar headers de `/api/pmo/*`, o bypass WAF solo para esa ruta
4. **Rules and policies**: confirma que no haya una regla de “Remove headers” / rewrite que borre `Authorization`

También revisa **Authentication → Web authentication** / captive: no debe aplicarse a esa ruta.

Tras guardar, otra vez:

```powershell
curl.exe -sk -H "Authorization: Bearer TEST-IIS" https://portal.rcjcorp.hn/api/pmo/headers-echo
```

## 4) Azure

Con `authorization:true` en el echo:

1. Messaging endpoint: `https://portal.rcjcorp.hn/api/pmo/messages`
2. Save → Web Chat → `hola`
3. Log: `auth=true`

## Plan B (si Sophos no puede exceptuar)

Publicar otro puerto (8443/3443) o túnel — ver secciones anteriores / `enable-pmo-bot-https.ps1`.

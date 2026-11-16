# bot.rcjcorporacion.com — Messaging endpoint del PMO Personal

Azure / Teams deben pegar aquí (puerto **443**, sin `:3443`):

```text
https://bot.rcjcorporacion.com/api/pmo/messages
```

## 1. DNS

Registro **A** (o CNAME) `bot.rcjcorporacion.com` → misma IP pública que atiende el portal.

## 2. IIS (servidor)

```powershell
cd D:\rcj-it-manager
git pull
cd deploy
.\setup-bot-hostname.ps1
```

Eso agrega el binding HTTPS SNI en el sitio `rcj-it-manager` y reutiliza el reverse proxy a Node `:3001` (con reinjection de `Authorization`).

## 3. Azure Bot

Configuration → Messaging endpoint:

```text
https://bot.rcjcorporacion.com/api/pmo/messages
```

**Apply** → Test in Web Chat → `hola`.

## 4. Comprobar

```powershell
curl.exe -sk https://bot.rcjcorporacion.com/api/pmo/bot-status
curl.exe -sk -H "Authorization: Bearer TEST" https://bot.rcjcorporacion.com/api/pmo/headers-echo
Get-Content D:\rcj-it-manager\logs\servicio.log -Wait -Tail 5
```

`headers-echo` debe dar `"authorization":true`. Web Chat debe generar `[pmo-bot] ... type=message`.

## 5. Teams app

Tras Web Chat OK, regenera el ZIP del manifest (ya incluye `bot.rcjcorporacion.com` en `validDomains`) y súbelo a Teams.

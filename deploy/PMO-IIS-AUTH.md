# PMO Personal: `auth=false` (IIS quita Authorization)

Azure/Teams llegan a Node, pero **IIS/ARR elimina `Authorization`**.
Sin ese header el bot no valida ni responde.

Sitio IIS: **`rcj-it-manager`** → `D:\rcj-it-manager` → binding `portal.rcjcorp.hn:443`.

## Opción B — Bypass IIS en :3443

Node escucha HTTPS en **3443** (ARR no toca el token).

```powershell
cd D:\rcj-it-manager
git pull
cd deploy
.\enable-pmo-bot-https.ps1
Restart-Service RCJITManager
```

**Importante:** Azure está en Internet. Si `Test-NetConnection portal.rcjcorp.hn -Port 3443`
da timeout desde fuera de la red RCJ, el puerto **no está publicado** (NAT/firewall).
El 443 del portal sí suele estarlo; el 3443 hay que abrirlo o usar un túnel.

### B1 — Pedir a redes (producción)

Publicar **TCP 3443** hacia el servidor del portal (`172.16.146.19` o la IP interna real),
misma IP pública que ya atiende `portal.rcjcorp.hn:443`.

Messaging endpoint:

```text
https://portal.rcjcorp.hn:3443/api/pmo/messages
```

### B2 — Túnel temporal (prueba hoy, sin abrir firewall)

Con el bot ya en `:3443`:

```powershell
cd D:\rcj-it-manager\deploy
.\pmo-bot-tunnel.ps1
```

Copia `https://xxxx.trycloudflare.com` y en Azure:

```text
https://xxxx.trycloudflare.com/api/pmo/messages
```

Web Chat → `hola` → en el log `auth=true`.

Si el export del certificado falla (clave no exportable), exporta el PFX a mano desde
`certlm.msc` → Personal → Certificates → `*.rcjcorp.hn` → Export with private key →
`D:\rcj-it-manager\data\ssl\portal-bot.pfx` y vuelve a correr `enable-pmo-bot-https.ps1`.

## Opción A — Reenviar Authorization con ARR

Solo si quieres insistir con el proxy en `:443`:

```powershell
cd D:\rcj-it-manager\deploy
.\fix-iis-pmo-auth.ps1 -SiteName "rcj-it-manager" -PhysicalPath "D:\rcj-it-manager"
```

Si tras eso sigue `auth=false`, usa la **Opción B**.

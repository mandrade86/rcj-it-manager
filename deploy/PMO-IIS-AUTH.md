# PMO Personal: `auth=false` (IIS quita Authorization)

Azure/Teams llegan a Node, pero **IIS/ARR elimina `Authorization`**.
Sin ese header el bot no valida ni responde.

Sitio IIS: **`rcj-it-manager`** → `D:\rcj-it-manager` → binding `portal.rcjcorp.hn:443`.

## Opción B — Bypass IIS (recomendado si A falló)

Node escucha HTTPS en el **puerto 3443** con el mismo certificado del portal.
Azure habla directo con Node; ARR no toca el token.

```powershell
cd D:\rcj-it-manager
git pull
cd deploy
.\enable-pmo-bot-https.ps1
```

Luego en **Azure Bot → Configuration → Messaging endpoint**:

```text
https://portal.rcjcorp.hn:3443/api/pmo/messages
```

Guarda → Test in Web Chat → `hola`.

En el log debe verse:

```text
PMO Personal bot HTTPS (bypass IIS): https://0.0.0.0:3443/api/pmo/messages
[pmo-bot] POST /api/pmo/messages auth=true ...
```

Si el export del certificado falla (clave no exportable), exporta el PFX a mano desde
`certlm.msc` → Personal → Certificates → portal… → Export with private key →
`D:\rcj-it-manager\data\ssl\portal-bot.pfx` y vuelve a correr el script (o edita `.env`).

## Opción A — Reenviar Authorization con ARR

Solo si quieres insistir con el proxy en `:443`:

```powershell
cd D:\rcj-it-manager\deploy
.\fix-iis-pmo-auth.ps1 -SiteName "rcj-it-manager" -PhysicalPath "D:\rcj-it-manager"
```

Si tras eso sigue `auth=false`, usa la **Opción B**.

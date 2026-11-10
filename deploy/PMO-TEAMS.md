# PMO Personal — Bot de Teams + API del portal

El bot **PMO Personal** responde en chat 1:1 de Teams y envía avisos proactivos (asignaciones, digest) usando los proyectos y tareas de MongoDB en `portal.rcjcorp.hn`.

## Qué hace

| Canal | Qué |
|---|---|
| Chat Teams | `resumen`, `atrasados`, `riesgos`, `proyecto INV-001`, `portafolio`, `ayuda` |
| Avisos | Al agregar integrante/responsable o asignar tarea (tarjeta firmada **PMO Personal**) |
| Digest | Resumen personal (y portafolio si hay permiso) vía `POST /api/pmo/digest/enviar` |

## API del portal

Autenticadas con JWT del portal:

- `GET /api/pmo/briefing/personal`
- `GET /api/pmo/briefing/portafolio?departamento_id=`
- `POST /api/pmo/preguntar` body `{ "texto": "resumen" }`

Públicas (sin JWT):

- `POST /api/pmo/messages` — Bot Framework (valida App ID/Password)
- `POST /api/pmo/digest/enviar` — header `x-pmo-digest-key: <PMO_DIGEST_KEY>`

## Permisos

| Clave | Efecto |
|---|---|
| `pmo:personal` | Briefing y chat personal (también vale `proyectos:ver` o `dashboard:ver`) |
| `pmo:portafolio` | Vista jefatura (también vale `proyectos:ver-todos` o `*`) |

Asigna `pmo:portafolio` a jefatura / PMO en **Admin → Roles**.

## Variables de entorno

```env
# Avisos proactivos (flujo Power Automate existente)
TEAMS_WEBHOOK_URL=https://...

# Bot conversacional (Azure Bot / Entra ID)
PMO_BOT_APP_ID=
PMO_BOT_APP_PASSWORD=
PMO_BOT_TENANT_ID=
# SingleTenant | MultiTenant (default MultiTenant)
PMO_BOT_APP_TYPE=MultiTenant

# Digest
PMO_DIGEST_KEY=genera-una-clave-larga
# Opcional: el propio Node envía digests cada N horas
PMO_DIGEST_CRON=false
PMO_DIGEST_INTERVAL_HOURS=24

APP_PUBLIC_URL=https://portal.rcjcorp.hn
```

## 1. Crear el bot en Azure

1. Entra a [Azure Portal](https://portal.azure.com) → **App registrations** → **New registration**  
   - Name: `PMO Personal`  
   - Accounts: multitenant o solo tu organización (`PMO_BOT_APP_TYPE` / `PMO_BOT_TENANT_ID`).
2. Copia el **Application (client) ID** → `PMO_BOT_APP_ID`.
3. **Certificates & secrets** → New client secret → `PMO_BOT_APP_PASSWORD`.
4. Crea un recurso **Azure Bot** (Bot Services) y asocia ese App ID.  
   - Messaging endpoint: `https://portal.rcjcorp.hn/api/pmo/messages`  
   - Canal: **Microsoft Teams**.
5. En el servidor Windows:

```powershell
cd D:\rcj-it-manager
# Agrega las variables al .env (o AppEnvironmentExtra de NSSM)
notepad .env
git pull
npm install
Restart-Service RCJITManager
```

Comprueba: el log debe decir `PMO Personal bot: endpoint /api/pmo/messages listo`.

## 2. Empaquetar e instalar la app en Teams

Plantilla en [`deploy/teams-pmo-personal/`](teams-pmo-personal/):

1. Edita `manifest.json`: reemplaza `YOUR_BOT_APP_ID` por el mismo `PMO_BOT_APP_ID`.
2. Genera iconos `color.png` (192×192) y `outline.png` (32×32) o usa los placeholders.
3. Empaqueta un ZIP con `manifest.json`, `color.png`, `outline.png` (raíz del zip, sin carpeta extra).
4. Teams → Apps → Manage your apps → **Upload a custom app** (o catálogo de la organización).
5. Abre **PMO Personal** y envía `ayuda`.

## 3. Digest automático

### Opción A — Programador de tareas de Windows

```powershell
# Cada día laborable a las 7:30
$action = New-ScheduledTaskAction -Execute 'curl.exe' -Argument '-s -X POST -H "x-pmo-digest-key: TU_CLAVE" https://portal.rcjcorp.hn/api/pmo/digest/enviar'
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At 7:30am
Register-ScheduledTask -TaskName 'RCJ-PMO-Digest' -Action $action -Trigger $trigger -RunLevel Highest
```

### Opción B — Power Automate

Flujo recurrente → HTTP POST a `https://portal.rcjcorp.hn/api/pmo/digest/enviar` con header `x-pmo-digest-key`.

### Opción C — Cron en Node

En `.env`: `PMO_DIGEST_CRON=true` y reinicia el servicio.

Prueba manual:

```powershell
curl.exe -s -X POST -H "x-pmo-digest-key: TU_CLAVE" http://127.0.0.1:3001/api/pmo/digest/enviar
```

## 4. Checklist de prueba

1. [ ] `GET /api/health` OK tras reinicio.
2. [ ] Con JWT: `POST /api/pmo/preguntar` `{ "texto": "resumen" }` devuelve texto.
3. [ ] Agregar participante a un proyecto → Teams con marca **PMO Personal**.
4. [ ] Chat Teams: `ayuda`, `resumen`, `atrasados`, `proyecto <código>`.
5. [ ] Usuario con `pmo:portafolio`: `portafolio` responde conteos.
6. [ ] Usuario sin portafolio: `portafolio` explica que no tiene permiso.
7. [ ] Digest con clave correcta → `{ ok: true, personal_enviados: ... }`.

## Notas

- El correo de Teams debe coincidir con `Usuario.email` del portal.
- Los avisos proactivos siguen usando `TEAMS_WEBHOOK_URL` (flujo Power Automate); el chat conversacional usa el Bot Framework.
- v1 no escribe en la base (solo consulta) ni usa GPT.

# Azure DevOps — pipelines separados Dev / Prod

| Pipeline | Archivo | Cuándo corre |
|---|---|---|
| **Desarrollo** | `azure-pipelines.yml` | Automático en cada push a `main` |
| **Producción** | `azure-pipelines-prod.yml` | Solo **manual** + aprobación del admin |

| | Dev | Prod |
|---|---|---|
| Portal | `portal-dev.rcjcorp.hn` | `portal.rcjcorp.hn` |
| Bot | `dev-bot.rcjcorp.hn` | `bot.rcjcorp.hn` |
| Carpeta | `P:\rcj-it-manager` | `C:\apps\rcj-it-manager` |
| Servicio | `RCJITManager` | `RCJITManager` |
| Agent pool | `Default` | `PowerBiProduction` |
| Environment | `development` | `production` (con Approvals) |

---

## 1. Repo

Proyecto: [RCJ-IT-MANAGER](https://dev.azure.com/RCJCorporation/RCJ-IT-MANAGER)

```powershell
git remote add azure https://dev.azure.com/RCJCorporation/RCJ-IT-MANAGER/_git/RCJ-IT-MANAGER
git push -u azure main
```

---

## 2. Environments

1. Pipelines → **Environments**
   - `development` — sin approvals
   - `production` — **Approvals** con el administrador
2. Agent pools:
   - Dev → **Default** (autoriza en el pipeline Dev)
   - Prod → **PowerBiProduction** (autoriza en el pipeline Prod)

---

## 3. Crear los dos pipelines

### Dev (ya debería existir)

1. Pipelines → New pipeline → Azure Repos → Existing YAML → `/azure-pipelines.yml`
2. Nombre sugerido: `RCJ IT Manager — Dev`

Flujo:

```text
push main → Build → Deploy Dev (P:\rcj-it-manager) → fin
```

### Prod (nuevo, separado)

1. Pipelines → New pipeline → Azure Repos → Existing YAML → `/azure-pipelines-prod.yml`
2. Nombre sugerido: `RCJ IT Manager — Prod`
3. **Trigger:** ninguno (el YAML tiene `trigger: none`)
4. Para publicar: **Run pipeline** → elige rama `main` → espera **aprobación** en environment `production`

---

## 4. Agente Dev (unidad P:)

```powershell
# En el servidor Dev — PowerShell Admin
cd C:\azagent
.\config.cmd
# URL: https://dev.azure.com/RCJCorporation
# Pool: Default
# Agent name: rcj-dev-01
.\svc.cmd install
.\svc.cmd start
```

App + NSSM:

```powershell
cd P:\rcj-it-manager
git config --global --add safe.directory P:/rcj-it-manager
if (-not (Test-Path .env)) { Copy-Item .env.development.example .env; notepad .env }
powershell -ExecutionPolicy Bypass -File .\scripts\instalar-servicio-windows.ps1 -AppDir P:\rcj-it-manager
```

---

## 5. Agente Prod (pool `PowerBiProduction`)

Usa el agente ya registrado en **PowerBiProduction** (servidor de producción).

1. Autoriza ese pool en el pipeline Prod si Azure lo pide.
2. Carpeta app: `C:\apps\rcj-it-manager`, `.env` desde `.env.production.example`, NSSM `RCJITManager`.
3. Pipeline **Prod** → Run a mano → aprueba el environment `production`.

---

## 6. Secretos

El pipeline **no** copia `.env`:

- Dev: `P:\rcj-it-manager\.env` — Mongo en **RCJ-lnx-sql01 (`172.16.150.25`)**:  
  `MONGODB_URI=mongodb://172.16.150.25:27017/rcj_it_manager_dev`
- Prod: `C:\apps\rcj-it-manager\.env`

Script de deploy: [`scripts/deploy-from-pipeline.ps1`](../scripts/deploy-from-pipeline.ps1).

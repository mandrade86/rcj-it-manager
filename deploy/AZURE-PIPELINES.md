# Azure DevOps — repo + pipeline Dev/Prod

Objetivo:

| Ambiente | Cuándo despliega |
|---|---|
| **Desarrollo** | Automático en cada push a `main` |
| **Producción** | Solo si un **administrador aprueba** en Azure DevOps |

Hosts típicos:

| | Dev | Prod |
|---|---|---|
| Portal | `portal-dev.rcjcorp.hn` | `portal.rcjcorp.hn` |
| Bot | `dev-bot.rcjcorp.hn` | `bot.rcjcorp.hn` |
| Carpeta | `D:\rcj-it-manager` | `D:\rcj-it-manager` |
| Servicio | `RCJITManager` | `RCJITManager` |

---

## 1. Crear el proyecto y el repo en Azure DevOps

Proyecto: [RCJ-IT-MANAGER](https://dev.azure.com/RCJCorporation/RCJ-IT-MANAGER)

Remote ya configurado en este clone:

```powershell
git remote add azure https://dev.azure.com/RCJCorporation/RCJ-IT-MANAGER/_git/RCJ-IT-MANAGER
git push -u azure main
```

GitHub queda como `origin` (espejo opcional); Azure como `azure`.

---

## 2. Environments + aprobación de producción

1. Pipelines → **Environments** → New environment:
   - `development` (sin approvals)
   - `production`
2. Abre **production** → **Approvals and checks** → **Approvals**  
   - Approvers: tu usuario admin (y quien deba autorizar)  
   - Timeout: p. ej. 72 horas  
   - Instructions: “Revisar cambio en desarrollo antes de aprobar producción”

Sin este paso, el stage Prod arranca solo (no queremos eso).

---

## 3. Agentes self-hosted (Windows)

Por defecto el YAML usa el pool **`Default`** (`agentPoolDev` / `agentPoolProd` en `azure-pipelines.yml`).

En el servidor de **desarrollo** (PowerShell Admin):

1. Azure DevOps → Project settings → **Agent pools** → abre **Default** (o crea uno y cambia el nombre en el YAML).
2. Add agent → Windows → descarga el ZIP.
3. En el servidor:

```powershell
# Ejemplo
cd C:\azagent
.\config.cmd
# URL: https://dev.azure.com/RCJCorporation
# Auth: PAT con Agent Pools (read, manage)
# Pool: Default
# Agent name: rcj-dev-01
.\run.cmd
# Instalar como servicio:
.\svc.cmd install
.\svc.cmd start
```

Si el pipeline dice “pool not authorized”, al primer run autoriza el pool en el diálogo de Azure DevOps.

4. El pipeline **clona solo** en `D:\rcj-it-manager` si no existe (si no hay `D:\`, usa `C:\apps\rcj-it-manager`).  
   Después debes tener el servicio Windows y el `.env` (el script puede sembrar `.env` desde el example la primera vez).

5. Node 22+, Git, servicio `RCJITManager` (NSSM) apuntando a esa carpeta.
6. La cuenta del agente debe poder reiniciar el servicio, p. ej. ejecutar el agente como **Local System** o darle derecho a `RCJITManager` (`sc.exe sdset` / grupo Administrators).

---

## 4. Crear el pipeline

1. Pipelines → New pipeline → Azure Repos Git → selecciona el repo.  
2. Existing Azure Pipelines YAML file → `/azure-pipelines.yml`.  
3. Run.

Flujo:

```text
push main → Build (agente Default) → DeployDev (auto) → [espera aprobación] → DeployProd
```

> No usa agentes Microsoft hosted (`ubuntu-latest`): la org no necesita comprar paralelismo hosted.

Cuando termine Dev, Azure pide **Review** en Prod; el admin aprueba o rechaza.

---

## 5. Variables / secretos

El pipeline **no** copia `.env`. Los secretos viven solo en cada servidor:

- Dev: `D:\rcj-it-manager\.env` (basado en `.env.development`)
- Prod: `D:\rcj-it-manager\.env` (basado en `.env.production`)

Si cambias rutas o nombre de servicio, edita `env:` en `azure-pipelines.yml` (`RCJ_DEPLOY_ROOT`, `RCJ_SERVICE_NAME`).

---

## 6. Un solo servidor para Dev y Prod

Si Dev y Prod están en la **misma** máquina (no recomendado, pero posible):

- Un solo agent pool (ej. `RCJ-Windows-Dev`)
- En YAML, pon el mismo `pool.name` en ambos stages
- Usa carpetas distintas, ej. `D:\rcj-it-manager-dev` y `D:\rcj-it-manager` vía `RCJ_DEPLOY_ROOT`

---

## 7. Checklist

- [ ] Repo en Azure DevOps  
- [ ] Environments `development` y `production`  
- [ ] Approval en `production`  
- [ ] Agent pools Dev / Prod con agentes online  
- [ ] Clone + `.env` + servicio en cada servidor  
- [ ] Pipeline creado desde `azure-pipelines.yml`  
- [ ] Push a `main` → Dev despliega solo  
- [ ] Prod espera tu aprobación  

Script de deploy: [`scripts/deploy-from-pipeline.ps1`](../scripts/deploy-from-pipeline.ps1).

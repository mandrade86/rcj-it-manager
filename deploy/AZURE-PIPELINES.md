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

1. Entra a [https://dev.azure.com](https://dev.azure.com) → New project → **RCJ IT Manager**.
2. **Repos** → Import repository (desde GitHub `mandrade86/rcj-it-manager`)  
   **o** en tu PC:

```powershell
cd D:\rcj-it-manager   # o tu clone
git remote add azure https://dev.azure.com/TU_ORG/RCJ%20IT%20Manager/_git/rcj-it-manager
git push -u azure main
```

3. Deja GitHub como espejo opcional (`origin`) o cambia `origin` a Azure.

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

El pipeline usa pools:

- `RCJ-Windows-Dev` → servidor de desarrollo  
- `RCJ-Windows-Prod` → servidor de producción  

En cada servidor (PowerShell Admin):

1. Azure DevOps → Project settings → **Agent pools** → New pool `RCJ-Windows-Dev` (y otro `RCJ-Windows-Prod`).
2. Add agent → Windows → descarga el ZIP.
3. En el servidor:

```powershell
# Ejemplo
cd C:\azagent
.\config.cmd
# URL: https://dev.azure.com/TU_ORG
# Auth: PAT con Agent Pools (read, manage)
# Pool: RCJ-Windows-Dev  (o Prod)
# Agent name: rcj-dev-01
.\run.cmd
# Instalar como servicio:
.\svc.cmd install
.\svc.cmd start
```

4. En el servidor ya debe existir el clone:

```powershell
git clone https://dev.azure.com/TU_ORG/RCJ%20IT%20Manager/_git/rcj-it-manager D:\rcj-it-manager
# .env ya configurado (no lo genera el pipeline)
```

5. Node 22+, Git, servicio `RCJITManager` (NSSM) corriendo.
6. La cuenta del agente debe poder reiniciar el servicio, p. ej. ejecutar el agente como **Local System** o darle derecho a `RCJITManager` (`sc.exe sdset` / grupo Administrators).

---

## 4. Crear el pipeline

1. Pipelines → New pipeline → Azure Repos Git → selecciona el repo.  
2. Existing Azure Pipelines YAML file → `/azure-pipelines.yml`.  
3. Run.

Flujo:

```text
push main → Build (ubuntu) → DeployDev (auto) → [espera aprobación] → DeployProd
```

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

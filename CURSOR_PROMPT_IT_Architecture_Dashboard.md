# CURSOR PROMPT — Módulo IT Architecture Dashboard (Datos Dinámicos)
## RCJ IT Manager · Módulo exclusivo del Departamento IT · v2.0

> **Cómo usar:** Pega este texto completo en el chat de Cursor y pídele que lo implemente paso a paso.
> Todos los paths son relativos al root del proyecto `rcj-it-manager/`.

---

## CONTEXTO DEL PROYECTO

Estás en **RCJ IT Manager** — stack: React 19 + Vite + TypeScript (cliente), Express 5 + Mongoose + MongoDB (servidor).

**Patrones que YA existen y debes seguir exactamente:**

| Qué | Dónde | Patrón |
|-----|-------|--------|
| Modelos | `server/db/models/*.ts` | Mongoose + `mongoose.models.X ?? mongoose.model(...)` |
| Rutas | `server/routes/*.ts` | Express Router + `requirePermiso()` del middleware |
| Registro rutas | `server/index.ts` | `app.use('/api/...', router)` después de `app.use('/api', requireAuth)` |
| Seed / init data | `server/db/initData.ts` | Funciones `ensureXxx()` llamadas en `main()` |
| Cliente API | `client/src/lib/api/*.ts` | `fetch('/api/...')` con `interceptors.ts` para el token |
| Permisos server | `requirePermiso('nombre:accion')` | En cada ruta sensible |
| Permisos client | `useAuthStore(s => s.hasPermiso('nombre:accion'))` | Para mostrar/ocultar UI |

---

## OBJETIVO

Crear el módulo **"Arquitectura IT"** (`/it/arquitectura`) con **datos dinámicos en MongoDB**.
El módulo tiene 5 tabs. **3 de ellos son 100% dinámicos** (CRUD completo). Los otros 2 son
referencia estática que no necesita BD.

| Tab | Dinámico | Descripción |
|-----|----------|-------------|
| 🗺 Mapa de Sistemas | ✅ SÍ | 8 sistemas RCJ — estado, stack, integraciones, notas |
| ⚡ API Reference | ✅ SÍ | Catálogo de endpoints por sistema |
| ✅ Dev Checklist | ✅ SÍ | Items de checklist configurables (config global) |
| ⚠️ Tech Debt | ✅ SÍ | Deuda técnica con severidad, roadmap, estado |
| 🏗 Infraestructura | ❌ NO | Diagrama SVG estático (no cambia) |

---

## PARTE 1 — BACKEND (servidor)

### 1.1 — Nuevos Modelos Mongoose

**Crear `server/db/models/SistemaIT.ts`:**

```typescript
import mongoose, { Schema } from 'mongoose'

export const SISTEMA_ESTADOS = ['stable', 'warning', 'legacy'] as const
export type SistemaEstado = (typeof SISTEMA_ESTADOS)[number]

const SistemaITSchema = new Schema(
  {
    nombre:        { type: String, required: true },
    descripcion:   { type: String, default: '' },
    estado:        { type: String, enum: SISTEMA_ESTADOS, default: 'stable' },
    stack:         { type: String, required: true },          // "NestJS · React · SQL Server"
    integraciones: { type: String, default: '' },             // "SAP B1, Office 365"
    responsable:   { type: String, default: '' },             // "Dev Team"
    notas:         { type: String, default: '' },
    tags:          { type: [String], default: [] },           // ["NestJS", "React", "Estable"]
    orden:         { type: Number, default: 0 },              // para ordenar en el grid
    activo:        { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const SistemaIT =
  mongoose.models.SistemaIT ?? mongoose.model('SistemaIT', SistemaITSchema)
```

---

**Crear `server/db/models/DeudaTecnica.ts`:**

```typescript
import mongoose, { Schema } from 'mongoose'

export const DEUDA_SEVERIDADES = ['high', 'medium', 'low'] as const
export const DEUDA_ESTADOS = ['abierta', 'en_progreso', 'resuelta'] as const

const DeudaTecnicaSchema = new Schema(
  {
    titulo:                    { type: String, required: true },
    sistema:                   { type: String, required: true }, // nombre libre del sistema afectado
    severidad:                 { type: String, enum: DEUDA_SEVERIDADES, default: 'medium' },
    riesgo:                    { type: String, default: '' },    // "Seguridad", "Mantenibilidad", etc.
    descripcion:               { type: String, default: '' },
    urgencia:                  { type: Number, default: 50, min: 0, max: 100 }, // 0-100
    estado:                    { type: String, enum: DEUDA_ESTADOS, default: 'abierta' },
    responsable:               { type: String, default: '' },
    trimestre_roadmap:         { type: String, default: '' },   // "Q3 2026", "Q4 2026"
    fecha_estimada_resolucion: { type: Date },
    creado_por_id:             { type: Schema.Types.ObjectId, ref: 'Usuario' },
    creado_por_nombre:         { type: String },
  },
  { timestamps: true },
)

export const DeudaTecnica =
  mongoose.models.DeudaTecnica ?? mongoose.model('DeudaTecnica', DeudaTecnicaSchema)
```

---

**Crear `server/db/models/ApiEndpointIT.ts`:**

```typescript
import mongoose, { Schema } from 'mongoose'

export const ENDPOINT_METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const ApiEndpointITSchema = new Schema(
  {
    grupo:       { type: String, required: true },  // "eTickets", "eProc", "SAP B1 Proxy", "Auth"
    metodo:      { type: String, enum: ENDPOINT_METODOS, required: true },
    path:        { type: String, required: true },  // "/api/v1/tickets"
    descripcion: { type: String, default: '' },
    version:     { type: String, default: 'v1' },
    notas:       { type: String, default: '' },
    activo:      { type: Boolean, default: true },
    orden:       { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const ApiEndpointIT =
  mongoose.models.ApiEndpointIT ?? mongoose.model('ApiEndpointIT', ApiEndpointITSchema)
```

---

**Crear `server/db/models/ChecklistItemIT.ts`:**

```typescript
import mongoose, { Schema } from 'mongoose'

const ChecklistItemITSchema = new Schema(
  {
    categoria: { type: String, required: true },  // "Seguridad", "Base de Datos", "Arquitectura"
    texto:     { type: String, required: true },
    orden:     { type: Number, default: 0 },
    activo:    { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const ChecklistItemIT =
  mongoose.models.ChecklistItemIT ?? mongoose.model('ChecklistItemIT', ChecklistItemITSchema)
```

---

### 1.2 — Registrar modelos en `server/db/models/index.ts`

Agregar al final del archivo (siguiendo el patrón existente):

```typescript
export * from './SistemaIT.js'
export * from './DeudaTecnica.js'
export * from './ApiEndpointIT.js'
export * from './ChecklistItemIT.js'
```

---

### 1.3 — Rutas API

**Crear `server/routes/itArquitectura.ts`:**

```typescript
import { Router } from 'express'
import { SistemaIT } from '../db/models/SistemaIT.js'
import { DeudaTecnica } from '../db/models/DeudaTecnica.js'
import { ApiEndpointIT } from '../db/models/ApiEndpointIT.js'
import { ChecklistItemIT } from '../db/models/ChecklistItemIT.js'
import { requirePermiso } from '../middleware/requireAuth.js'

export const itArquitecturaRouter = Router()

const canView  = requirePermiso('it:arquitectura:ver')
const canEdit  = requirePermiso('it:arquitectura:editar')

// ── SISTEMAS IT ──────────────────────────────────────────────
itArquitecturaRouter.get('/sistemas', canView, async (_req, res) => {
  const items = await SistemaIT.find({ activo: true }).sort({ orden: 1, nombre: 1 }).lean()
  res.json({ success: true, data: items })
})

itArquitecturaRouter.post('/sistemas', canEdit, async (req, res) => {
  const item = await SistemaIT.create(req.body)
  res.status(201).json({ success: true, data: item })
})

itArquitecturaRouter.put('/sistemas/:id', canEdit, async (req, res) => {
  const item = await SistemaIT.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!item) { res.status(404).json({ success: false, message: 'Sistema no encontrado' }); return }
  res.json({ success: true, data: item })
})

itArquitecturaRouter.delete('/sistemas/:id', canEdit, async (req, res) => {
  await SistemaIT.findByIdAndUpdate(req.params.id, { activo: false })
  res.json({ success: true, message: 'Sistema desactivado' })
})

// ── DEUDA TÉCNICA ────────────────────────────────────────────
itArquitecturaRouter.get('/deuda-tecnica', canView, async (_req, res) => {
  const items = await DeudaTecnica.find()
    .sort({ severidad: 1, urgencia: -1 })
    .lean()
  res.json({ success: true, data: items })
})

itArquitecturaRouter.post('/deuda-tecnica', canEdit, async (req, res) => {
  const user = req.user!
  const item = await DeudaTecnica.create({
    ...req.body,
    creado_por_id: user._id,
    creado_por_nombre: user.nombre,
  })
  res.status(201).json({ success: true, data: item })
})

itArquitecturaRouter.put('/deuda-tecnica/:id', canEdit, async (req, res) => {
  const item = await DeudaTecnica.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!item) { res.status(404).json({ success: false, message: 'Item no encontrado' }); return }
  res.json({ success: true, data: item })
})

itArquitecturaRouter.delete('/deuda-tecnica/:id', canEdit, async (req, res) => {
  await DeudaTecnica.findByIdAndDelete(req.params.id)
  res.json({ success: true, message: 'Item eliminado' })
})

// ── ENDPOINTS API ────────────────────────────────────────────
itArquitecturaRouter.get('/endpoints', canView, async (_req, res) => {
  const items = await ApiEndpointIT.find({ activo: true }).sort({ grupo: 1, orden: 1 }).lean()
  res.json({ success: true, data: items })
})

itArquitecturaRouter.post('/endpoints', canEdit, async (req, res) => {
  const item = await ApiEndpointIT.create(req.body)
  res.status(201).json({ success: true, data: item })
})

itArquitecturaRouter.put('/endpoints/:id', canEdit, async (req, res) => {
  const item = await ApiEndpointIT.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
  if (!item) { res.status(404).json({ success: false, message: 'Endpoint no encontrado' }); return }
  res.json({ success: true, data: item })
})

itArquitecturaRouter.delete('/endpoints/:id', canEdit, async (req, res) => {
  await ApiEndpointIT.findByIdAndUpdate(req.params.id, { activo: false })
  res.json({ success: true, message: 'Endpoint desactivado' })
})

// ── CHECKLIST ITEMS ──────────────────────────────────────────
itArquitecturaRouter.get('/checklist-items', canView, async (_req, res) => {
  const items = await ChecklistItemIT.find({ activo: true }).sort({ categoria: 1, orden: 1 }).lean()
  res.json({ success: true, data: items })
})

itArquitecturaRouter.post('/checklist-items', canEdit, async (req, res) => {
  const item = await ChecklistItemIT.create(req.body)
  res.status(201).json({ success: true, data: item })
})

itArquitecturaRouter.put('/checklist-items/:id', canEdit, async (req, res) => {
  const item = await ChecklistItemIT.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!item) { res.status(404).json({ success: false, message: 'Item no encontrado' }); return }
  res.json({ success: true, data: item })
})

itArquitecturaRouter.delete('/checklist-items/:id', canEdit, async (req, res) => {
  await ChecklistItemIT.findByIdAndUpdate(req.params.id, { activo: false })
  res.json({ success: true, message: 'Item desactivado' })
})
```

---

### 1.4 — Registrar ruta en `server/index.ts`

Agregar en la sección de imports:
```typescript
import { itArquitecturaRouter } from './routes/itArquitectura.js'
```

Agregar en la sección de rutas (después de `app.use('/api', requireAuth)`):
```typescript
app.use('/api/it', itArquitecturaRouter)
```

---

### 1.5 — Seed data en `server/db/initData.ts`

Agregar la función `ensureITArquitecturaData()` al final del archivo y llamarla en `main()`:

```typescript
// Importar modelos al inicio del archivo
import { SistemaIT } from './models/SistemaIT.js'
import { DeudaTecnica } from './models/DeudaTecnica.js'
import { ApiEndpointIT } from './models/ApiEndpointIT.js'
import { ChecklistItemIT } from './models/ChecklistItemIT.js'

export async function ensureITArquitecturaData() {
  // Solo insertar si la colección está vacía
  const [sistCount, deudaCount, epCount, clCount] = await Promise.all([
    SistemaIT.countDocuments(),
    DeudaTecnica.countDocuments(),
    ApiEndpointIT.countDocuments(),
    ChecklistItemIT.countDocuments(),
  ])

  if (sistCount === 0) {
    await SistemaIT.insertMany([
      { nombre: 'SAP Business One HANA', estado: 'stable',  stack: 'SAP B1 · HANA · SQL Server',            integraciones: 'eTickets, eProc, eCash, APIs REST',      responsable: 'Equipo ERP',       notas: 'ERP central. Todas las integraciones financieras pasan por aquí. Cambios requieren análisis de impacto completo.', tags: ['ERP','HANA','Financiero','Crítico'],     orden: 1 },
      { nombre: 'eTickets',              estado: 'stable',  stack: 'NestJS · React · SQL Server',            integraciones: 'SAP B1, Office 365, AWS S3',             responsable: 'Dev Team',         notas: 'Arquitectura limpia NestJS. Candidato para modelo base de otros sistemas.',                                         tags: ['NestJS','React','Tickets','Estable'],   orden: 2 },
      { nombre: 'eProc',                 estado: 'warning', stack: 'Node.js · React · SQL Server',           integraciones: 'SAP B1, Proveedores externos',           responsable: 'Dev Team',         notas: 'Lógica mezclada en controllers. Refactorización prioridad Q4 2026.',                                                 tags: ['Procurement','Deuda','Refactorizar'],   orden: 3 },
      { nombre: 'eLab',                  estado: 'stable',  stack: 'Node.js · React · MongoDB',              integraciones: 'SQL Server, AWS',                        responsable: 'Dev Team',         notas: 'Gestión de laboratorio. Logs pendientes de estructurar.',                                                            tags: ['Lab','MongoDB','React','Estable'],      orden: 4 },
      { nombre: 'eCash',                 estado: 'warning', stack: 'Node.js · React · SQL Server',           integraciones: 'SAP B1, Bancos',                         responsable: 'Dev Team',         notas: 'Procesos de cierre aún manuales. Completar flujos es prioridad Q4 2026.',                                            tags: ['Cash','Financiero','Parcial'],          orden: 5 },
      { nombre: 'IIS Windows Server',    estado: 'legacy',  stack: 'IIS · ASP.NET / Aplicaciones legacy',   integraciones: 'Varios sistemas internos',               responsable: 'IT Ops',           notas: 'Sin actualizar. Migración a Ubuntu+Nginx planificada Q3 2026.',                                                      tags: ['Legacy','Windows','Migrar','⚠️'],       orden: 6 },
      { nombre: 'AWS Cloud',             estado: 'stable',  stack: 'EC2 · RDS · S3 · CloudWatch',           integraciones: 'Todos los sistemas',                     responsable: 'IT Ops / DevOps',  notas: 'Infraestructura cloud principal. Expandir CloudWatch para monitoring centralizado.',                                  tags: ['Cloud','EC2','S3','RDS'],               orden: 7 },
      { nombre: 'Office 365 / M365',     estado: 'stable',  stack: 'M365 · Exchange · Power Automate',      integraciones: 'eTickets, Teams, Power BI',              responsable: 'IT Admin',         notas: 'Power Automate activo en flujos de aprobación.',                                                                     tags: ['M365','Power Automate','Teams'],        orden: 8 },
    ])
  }

  if (deudaCount === 0) {
    await DeudaTecnica.insertMany([
      { titulo: 'eProc — Sin estándares unificados',        sistema: 'eProc',       severidad: 'high',   riesgo: 'Mantenibilidad', urgencia: 80, estado: 'abierta',     trimestre_roadmap: 'Q4 2026', descripcion: 'Lógica mezclada en controllers. Sin DTOs ni validación centralizada. Difícil de extender y testear.' },
      { titulo: 'IIS Windows — Migración pendiente',        sistema: 'IIS Legacy',  severidad: 'high',   riesgo: 'Seguridad',      urgencia: 75, estado: 'en_progreso', trimestre_roadmap: 'Q3 2026', descripcion: 'Aplicaciones sin actualizar. Dependencias obsoletas. Riesgo de vulnerabilidades CVE activas.' },
      { titulo: 'eCash — Sistema parcialmente desarrollado',sistema: 'eCash',        severidad: 'high',   riesgo: 'Operacional',    urgencia: 70, estado: 'abierta',     trimestre_roadmap: 'Q4 2026', descripcion: 'Flujos incompletos. Dependencia manual en procesos de cierre. Sin auditoría de transacciones.' },
      { titulo: 'APIs sin documentación Swagger',           sistema: 'Todos',        severidad: 'medium', riesgo: 'Onboarding',     urgencia: 50, estado: 'abierta',     trimestre_roadmap: 'Q3 2026', descripcion: 'Endpoints sin documentar dificultan incorporación de nuevos devs e integración entre sistemas.' },
      { titulo: 'Sin CI/CD en sistemas internos',           sistema: 'DevOps',       severidad: 'medium', riesgo: 'Calidad',        urgencia: 45, estado: 'abierta',     trimestre_roadmap: 'Q4 2026', descripcion: 'Deploys manuales. Sin pipelines de pruebas automáticas. Riesgo de regresiones en producción.' },
      { titulo: 'Logs no estructurados en eLab',            sistema: 'eLab',         severidad: 'low',    riesgo: 'Monitoreo',      urgencia: 25, estado: 'abierta',     trimestre_roadmap: 'Q1 2027', descripcion: 'console.log en producción. Sin correlación de requests. Dificulta debugging en incidentes.' },
    ])
  }

  if (epCount === 0) {
    await ApiEndpointIT.insertMany([
      // eTickets
      { grupo: 'eTickets',     metodo: 'GET',    path: '/api/v1/tickets',              descripcion: 'Listar tickets',        orden: 1 },
      { grupo: 'eTickets',     metodo: 'POST',   path: '/api/v1/tickets',              descripcion: 'Crear ticket',          orden: 2 },
      { grupo: 'eTickets',     metodo: 'GET',    path: '/api/v1/tickets/:id',          descripcion: 'Detalle de ticket',     orden: 3 },
      { grupo: 'eTickets',     metodo: 'PUT',    path: '/api/v1/tickets/:id/status',   descripcion: 'Cambiar estado',        orden: 4 },
      // eProc
      { grupo: 'eProc',        metodo: 'GET',    path: '/api/v1/purchases/orders',     descripcion: 'Órdenes de compra',     orden: 1 },
      { grupo: 'eProc',        metodo: 'POST',   path: '/api/v1/purchases/approve',    descripcion: 'Aprobar orden',         orden: 2 },
      { grupo: 'eProc',        metodo: 'GET',    path: '/api/v1/suppliers',            descripcion: 'Proveedores',           orden: 3 },
      // SAP B1 Proxy
      { grupo: 'SAP B1 Proxy', metodo: 'GET',    path: '/api/v1/sap/items/:code',      descripcion: 'Artículo SAP',          orden: 1 },
      { grupo: 'SAP B1 Proxy', metodo: 'GET',    path: '/api/v1/sap/partners/:id',     descripcion: 'Business Partner',      orden: 2 },
      { grupo: 'SAP B1 Proxy', metodo: 'POST',   path: '/api/v1/sap/invoices',         descripcion: 'Crear factura',         orden: 3 },
      // Auth
      { grupo: 'Auth',         metodo: 'POST',   path: '/api/v1/auth/login',           descripcion: 'Login corporativo',     orden: 1 },
      { grupo: 'Auth',         metodo: 'POST',   path: '/api/v1/auth/refresh',         descripcion: 'Refresh token',         orden: 2 },
      { grupo: 'Auth',         metodo: 'DELETE', path: '/api/v1/auth/logout',          descripcion: 'Cerrar sesión',         orden: 3 },
    ])
  }

  if (clCount === 0) {
    await ChecklistItemIT.insertMany([
      // Seguridad
      { categoria: 'Seguridad',     texto: 'No hay credenciales hardcodeadas en el código',                       orden: 1 },
      { categoria: 'Seguridad',     texto: 'Inputs validados y sanitizados (Joi / class-validator)',              orden: 2 },
      { categoria: 'Seguridad',     texto: 'CORS configurado solo para dominios autorizados',                     orden: 3 },
      { categoria: 'Seguridad',     texto: 'Rate limiting activo en endpoints públicos',                          orden: 4 },
      { categoria: 'Seguridad',     texto: 'JWT validado correctamente (exp, iss, rol)',                          orden: 5 },
      // Base de Datos
      { categoria: 'Base de Datos', texto: 'Sin SELECT *, campos explícitos siempre',                            orden: 1 },
      { categoria: 'Base de Datos', texto: 'Queries parametrizadas (no concatenación de strings)',               orden: 2 },
      { categoria: 'Base de Datos', texto: 'Índices apropiados en campos de búsqueda frecuente',                 orden: 3 },
      // Arquitectura
      { categoria: 'Arquitectura',  texto: 'Lógica de negocio en Services, no en Controllers',                   orden: 1 },
      { categoria: 'Arquitectura',  texto: 'Variables de entorno en .env (nunca en código)',                     orden: 2 },
      { categoria: 'Arquitectura',  texto: 'Manejo de errores centralizado (filters/interceptors)',              orden: 3 },
      { categoria: 'Arquitectura',  texto: 'Logs estructurados con Winston (no console.log en prod)',            orden: 4 },
      // Integraciones
      { categoria: 'Integraciones', texto: 'Retry logic con backoff exponencial en llamadas externas',           orden: 1 },
      { categoria: 'Integraciones', texto: 'Timeout definido en todas las llamadas a servicios externos',        orden: 2 },
      { categoria: 'Integraciones', texto: 'Auditoría de operaciones críticas (SAP B1, eCash)',                  orden: 3 },
    ])
  }
}
```

Llamar al final de la función `main()` en `server/index.ts`:
```typescript
await ensureITArquitecturaData()
```

---

## PARTE 2 — FRONTEND (cliente)

### 2.1 — Tipos TypeScript

**Crear `client/src/types/itArquitectura.ts`:**

```typescript
export interface SistemaIT {
  _id: string
  nombre: string
  descripcion: string
  estado: 'stable' | 'warning' | 'legacy'
  stack: string
  integraciones: string
  responsable: string
  notas: string
  tags: string[]
  orden: number
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface DeudaTecnica {
  _id: string
  titulo: string
  sistema: string
  severidad: 'high' | 'medium' | 'low'
  riesgo: string
  descripcion: string
  urgencia: number
  estado: 'abierta' | 'en_progreso' | 'resuelta'
  responsable: string
  trimestre_roadmap: string
  fecha_estimada_resolucion?: string
  creado_por_nombre?: string
  createdAt: string
}

export interface ApiEndpointIT {
  _id: string
  grupo: string
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  descripcion: string
  version: string
  notas: string
  activo: boolean
  orden: number
}

export interface ChecklistItemIT {
  _id: string
  categoria: string
  texto: string
  orden: number
  activo: boolean
}
```

---

### 2.2 — Funciones API cliente

**Crear `client/src/lib/api/itArquitectura.ts`:**

Sigue exactamente el mismo patrón de `client/src/lib/api/proyectos.ts` —
usa `fetch` con el token de `interceptors.ts`. No uses axios ni librerías externas.

```typescript
import type { SistemaIT, DeudaTecnica, ApiEndpointIT, ChecklistItemIT } from '@/types/itArquitectura'

// ── helper para manejar errores (igual que en otros archivos de lib/api) ──
async function parseError(res: Response): Promise<string> {
  try { const j = (await res.json()) as { error?: string }; return j.error ?? res.statusText }
  catch { return res.statusText }
}

// ── SISTEMAS IT ──────────────────────────────────────────────────────────
export async function getSistemasITApi(): Promise<SistemaIT[]> {
  const res = await fetch('/api/it/sistemas')
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: SistemaIT[] }
  return json.data
}

export async function createSistemaITApi(body: Partial<SistemaIT>): Promise<SistemaIT> {
  const res = await fetch('/api/it/sistemas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: SistemaIT }
  return json.data
}

export async function updateSistemaITApi(id: string, body: Partial<SistemaIT>): Promise<SistemaIT> {
  const res = await fetch(`/api/it/sistemas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: SistemaIT }
  return json.data
}

export async function deleteSistemaITApi(id: string): Promise<void> {
  const res = await fetch(`/api/it/sistemas/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

// ── DEUDA TÉCNICA ────────────────────────────────────────────────────────
export async function getDeudaTecnicaApi(): Promise<DeudaTecnica[]> {
  const res = await fetch('/api/it/deuda-tecnica')
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: DeudaTecnica[] }
  return json.data
}

export async function createDeudaTecnicaApi(body: Partial<DeudaTecnica>): Promise<DeudaTecnica> {
  const res = await fetch('/api/it/deuda-tecnica', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: DeudaTecnica }
  return json.data
}

export async function updateDeudaTecnicaApi(id: string, body: Partial<DeudaTecnica>): Promise<DeudaTecnica> {
  const res = await fetch(`/api/it/deuda-tecnica/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: DeudaTecnica }
  return json.data
}

export async function deleteDeudaTecnicaApi(id: string): Promise<void> {
  const res = await fetch(`/api/it/deuda-tecnica/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

// ── API ENDPOINTS ────────────────────────────────────────────────────────
export async function getApiEndpointsITApi(): Promise<ApiEndpointIT[]> {
  const res = await fetch('/api/it/endpoints')
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: ApiEndpointIT[] }
  return json.data
}

export async function createApiEndpointITApi(body: Partial<ApiEndpointIT>): Promise<ApiEndpointIT> {
  const res = await fetch('/api/it/endpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: ApiEndpointIT }
  return json.data
}

export async function updateApiEndpointITApi(id: string, body: Partial<ApiEndpointIT>): Promise<ApiEndpointIT> {
  const res = await fetch(`/api/it/endpoints/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: ApiEndpointIT }
  return json.data
}

// ── CHECKLIST ITEMS ──────────────────────────────────────────────────────
export async function getChecklistItemsITApi(): Promise<ChecklistItemIT[]> {
  const res = await fetch('/api/it/checklist-items')
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: ChecklistItemIT[] }
  return json.data
}

export async function createChecklistItemITApi(body: Partial<ChecklistItemIT>): Promise<ChecklistItemIT> {
  const res = await fetch('/api/it/checklist-items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const json = await res.json() as { data: ChecklistItemIT }
  return json.data
}
```

---

### 2.3 — Hooks de datos (useEffect + useState)

**Crear `client/src/pages/it/hooks/useITData.ts`:**

```typescript
import { useState, useEffect, useCallback } from 'react'
import {
  getSistemasITApi, createSistemaITApi, updateSistemaITApi, deleteSistemaITApi,
  getDeudaTecnicaApi, createDeudaTecnicaApi, updateDeudaTecnicaApi, deleteDeudaTecnicaApi,
  getApiEndpointsITApi, createApiEndpointITApi, updateApiEndpointITApi,
  getChecklistItemsITApi, createChecklistItemITApi,
} from '@/lib/api/itArquitectura'
import type { SistemaIT, DeudaTecnica, ApiEndpointIT, ChecklistItemIT } from '@/types/itArquitectura'

// Hook genérico para fetch con loading/error
function useFetch<T>(fetchFn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchFn())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => { load() }, [load])

  return { data, loading, error, reload: load }
}

export function useSistemasIT() {
  const { data: sistemas, loading, error, reload } = useFetch(getSistemasITApi)
  const [saving, setSaving] = useState(false)

  const update = async (id: string, body: Partial<SistemaIT>) => {
    setSaving(true)
    await updateSistemaITApi(id, body)
    await reload()
    setSaving(false)
  }

  const create = async (body: Partial<SistemaIT>) => {
    setSaving(true)
    await createSistemaITApi(body)
    await reload()
    setSaving(false)
  }

  const remove = async (id: string) => {
    await deleteSistemaITApi(id)
    await reload()
  }

  return { sistemas: sistemas ?? [], loading, error, saving, update, create, remove }
}

export function useDeudaTecnica() {
  const { data: deuda, loading, error, reload } = useFetch(getDeudaTecnicaApi)
  const [saving, setSaving] = useState(false)

  const update = async (id: string, body: Partial<DeudaTecnica>) => {
    setSaving(true)
    await updateDeudaTecnicaApi(id, body)
    await reload()
    setSaving(false)
  }

  const create = async (body: Partial<DeudaTecnica>) => {
    setSaving(true)
    await createDeudaTecnicaApi(body)
    await reload()
    setSaving(false)
  }

  const remove = async (id: string) => {
    await deleteDeudaTecnicaApi(id)
    await reload()
  }

  return { deuda: deuda ?? [], loading, error, saving, update, create, remove }
}

export function useApiEndpointsIT() {
  const { data: endpoints, loading, error, reload } = useFetch(getApiEndpointsITApi)

  const create = async (body: Partial<ApiEndpointIT>) => {
    await createApiEndpointITApi(body)
    await reload()
  }

  const update = async (id: string, body: Partial<ApiEndpointIT>) => {
    await updateApiEndpointITApi(id, body)
    await reload()
  }

  return { endpoints: endpoints ?? [], loading, error, create, update }
}

export function useChecklistItemsIT() {
  const { data: items, loading, error, reload } = useFetch(getChecklistItemsITApi)

  const create = async (body: Partial<ChecklistItemIT>) => {
    await createChecklistItemITApi(body)
    await reload()
  }

  return { items: items ?? [], loading, error, create }
}
```

---

## PARTE 3 — ARCHIVOS A CREAR (resumen)

### Estructura de carpetas:

```
client/src/
├── types/
│   └── itArquitectura.ts                   ← NUEVO
├── lib/api/
│   └── itArquitectura.ts                   ← NUEVO
└── pages/it/
    ├── hooks/
    │   └── useITData.ts                    ← NUEVO
    ├── components/
    │   ├── SystemsMap.tsx                  ← NUEVO (usa useSistemasIT())
    │   ├── ApiReference.tsx                ← NUEVO (usa useApiEndpointsIT())
    │   ├── DevChecklist.tsx                ← NUEVO (usa useChecklistItemsIT())
    │   ├── TechDebtTracker.tsx             ← NUEVO (usa useDeudaTecnica())
    │   ├── InfrastructureMap.tsx           ← NUEVO (SVG estático)
    │   └── dialogs/
    │       ├── SistemaDialog.tsx           ← NUEVO (form crear/editar sistema)
    │       ├── DeudaDialog.tsx             ← NUEVO (form crear/editar deuda)
    │       └── EndpointDialog.tsx          ← NUEVO (form agregar endpoint)
    └── ArquitecturaDashboardPage.tsx       ← NUEVO

server/
├── db/models/
│   ├── SistemaIT.ts                        ← NUEVO
│   ├── DeudaTecnica.ts                     ← NUEVO
│   ├── ApiEndpointIT.ts                    ← NUEVO
│   └── ChecklistItemIT.ts                  ← NUEVO
└── routes/
    └── itArquitectura.ts                   ← NUEVO
```

### Archivos a modificar:

```
server/db/models/index.ts    ← agregar 4 exports nuevos
server/db/initData.ts        ← agregar ensureITArquitecturaData()
server/index.ts              ← import router + app.use('/api/it', ...)
client/src/AppRoutes.tsx     ← agregar ruta /it/arquitectura con ProtectedRoute
client/src/components/layout/AppSidebar.tsx  ← agregar nav item "Arquitectura IT"
```

---

## PARTE 4 — ESPECIFICACIÓN DE COMPONENTES

### `SystemsMap.tsx` — usa `useSistemasIT()`

- Muestra skeleton de carga mientras `loading === true`
- Grid 3 columnas con tarjetas clickeables
- Cada tarjeta: dot de estado (verde/amarillo/rojo), nombre, stack
- Clic → panel expandido debajo con todos los campos
- Si `hasPermiso('it:arquitectura:editar')`: botón "Editar" en cada tarjeta que abre `SistemaDialog`
- Botón "+ Nuevo Sistema" visible solo con permiso de edición
- SVG del flujo de integraciones (estático, no cambia con los datos)

### `ApiReference.tsx` — usa `useApiEndpointsIT()`

- Columna izquierda: bloques de código estáticos (respuesta estándar + headers requeridos)
- Columna derecha: lista dinámica de endpoints agrupados por `grupo`
- Si `hasPermiso('it:arquitectura:editar')`: botón "+ Endpoint" que abre `EndpointDialog`
- Método badge coloreado: GET=verde, POST=azul, PUT=amarillo, DELETE=rojo, PATCH=naranja

### `DevChecklist.tsx` — usa `useChecklistItemsIT()`

- `useState<Set<string>>(new Set())` para los items marcados (local, no persiste — es una herramienta de uso puntual)
- Agrupa por `categoria`
- Header: "X / {total} verificados" + barra de progreso
- Si `hasPermiso('it:arquitectura:editar')`: botón "+ Item" para agregar nuevos items al catálogo

### `TechDebtTracker.tsx` — usa `useDeudaTecnica()`

- Lista de items ordenada por severidad (high → medium → low)
- Borde izquierdo coloreado por severidad (`border-l-4`)
- Badge de estado: "abierta" (rojo), "en_progreso" (amarillo), "resuelta" (verde)
- Barra de urgencia (0-100)
- Si `hasPermiso('it:arquitectura:editar')`: botón "Editar" + "Marcar resuelta"
- Botón "+ Nueva deuda" visible con permiso
- Gráfica de barras (Recharts `BarChart`) con conteo por severidad
- Roadmap: agrupa items por `trimestre_roadmap` y los muestra en timeline

### `InfrastructureMap.tsx` — completamente estático

SVG inline con 4 capas (Edge, AWS, On-Premise, Apps). Sin datos dinámicos.

---

## PARTE 5 — RUTAS Y SIDEBAR

### `AppRoutes.tsx` — agregar:
```tsx
import { ArquitecturaDashboardPage } from '@/pages/it/ArquitecturaDashboardPage'

// Dentro de MainLayout:
<Route element={<ProtectedRoute permiso="it:arquitectura:ver" />}>
  <Route path="it/arquitectura" element={<ArquitecturaDashboardPage />} />
</Route>
```

### `AppSidebar.tsx` — agregar:
```tsx
// Imports
import { Server } from 'lucide-react'

// En el componente, leer permiso
const mostrarArqIT = hasPermiso('it:arquitectura:ver') || hasPermiso('*')

// En el <nav>, antes de los adminItems:
{mostrarArqIT && (
  <>
    <GroupLabel icon={Server} label="IT Técnico" collapsed={collapsed} />
    <div className="flex flex-col gap-0.5">
      <NavItem to="/it/arquitectura" label="Arquitectura IT" icon={Server} collapsed={collapsed} />
    </div>
  </>
)}
```

---

## RESUMEN DE PERMISOS NUEVOS

| Permiso | Quién lo necesita |
|---------|-------------------|
| `it:arquitectura:ver` | Cualquier usuario del depto IT |
| `it:arquitectura:editar` | Jefe IT / admin — puede crear/modificar datos |

Agregar estos permisos al rol IT en la BD (colección `roles`) o directamente al usuario administrador.
Con permiso `*` (superadmin) ya tiene acceso a todo.

---

## ORDEN DE IMPLEMENTACIÓN

1. Crear los 4 modelos Mongoose (`SistemaIT`, `DeudaTecnica`, `ApiEndpointIT`, `ChecklistItemIT`)
2. Actualizar `server/db/models/index.ts`
3. Crear `server/routes/itArquitectura.ts`
4. Actualizar `server/index.ts` (import + `app.use`)
5. Agregar `ensureITArquitecturaData()` en `server/db/initData.ts` y llamarla en `main()`
6. Crear `client/src/types/itArquitectura.ts`
7. Crear `client/src/lib/api/itArquitectura.ts`
8. Crear `client/src/pages/it/hooks/useITData.ts`
9. Crear los 5 componentes de tab + los 3 dialogs
10. Crear `ArquitecturaDashboardPage.tsx`
11. Modificar `AppRoutes.tsx`
12. Modificar `AppSidebar.tsx`

---

*Prompt v2.0 — Datos dinámicos MongoDB · RCJ IT Manager · Mayo 2026*

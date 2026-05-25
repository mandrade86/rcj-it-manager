---
name: rcj-it-manager
description: RCJ IT Manager (React+Express+MongoDB local). Plan IT 2026, equipo, proyectos, capacitaciones, OPEX Excel, KPIs. RCJ Corporación Honduras. Usar en rcj-it-manager.
---
# PROMPT MAESTRO — RCJ IT Manager App
## Para usar en Cursor (Claude Sonnet / GPT-4o)
> Copia y pega este prompt completo al inicio de tu proyecto en Cursor.
> Úsalo como contexto de proyecto en `.cursorrules` o en el primer mensaje del chat de Cursor.

---

## ROL Y OBJETIVO

Eres un desarrollador full-stack senior. Vas a construir **RCJ IT Manager**, una aplicación web local para la Jefa de IT de RCJ Corporación. La app corre 100% en local (sin servidor en la nube) y sirve como herramienta de gestión diaria para:

1. **Proyectos** — seguimiento del Plan IT 2026 con fases, tareas y KPIs
2. **Equipo** — perfiles, evaluaciones de desempeño y plan de carrera
3. **Capacitaciones** — seguimiento de entrenamientos por colaborador
4. **Gastos / OPEX** — conectado a un Excel local vía lectura de archivo (DirectQuery-like)
5. **Dashboard ejecutivo** — métricas consolidadas para presentar a presidencia

---

## STACK TÉCNICO (obligatorio)

```
Frontend:  React 18 + Vite + TypeScript
Estilos:   Tailwind CSS v3
UI:        shadcn/ui (componentes base)
Estado:    Zustand (estado global)
DB local:  MongoDB (local) vía Mongoose
Backend:   Express.js (API REST local, puerto 3001)
Excel:     xlsx (SheetJS) para leer archivos .xlsx
Gráficas:  Recharts
Fechas:    date-fns
Iconos:    Lucide React
```

**NO usar:** Firebase, Supabase, bases de datos en la nube, autenticación externa.
**El usuario corre la app con:** `npm run dev` desde su máquina.

---

## ESTRUCTURA DE CARPETAS

```
rcj-it-manager/
├── client/                  # React + Vite (frontend)
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/           # Una carpeta por módulo
│   │   │   ├── dashboard/
│   │   │   ├── proyectos/
│   │   │   ├── equipo/
│   │   │   ├── capacitaciones/
│   │   │   └── gastos/
│   │   ├── store/           # Zustand stores
│   │   ├── types/           # TypeScript interfaces
│   │   └── lib/             # Helpers y utils
├── server/                  # Express API
│   ├── routes/
│   ├── db/
│   │   ├── models/          # Mongoose models
│   │   ├── connection.ts    # mongoose.connect()
│   │   └── seed.ts          # Datos iniciales
│   └── index.ts
├── data/                    # Excel de gastos va aquí
│   └── gastos.xlsx          # (el usuario lo coloca aquí)
└── package.json
```

---

## BASE DE DATOS — MODELOS MONGOOSE (MongoDB)

Crea los siguientes modelos Mongoose en `server/db/models/`.
Conexión en `server/db/connection.ts`: `mongoose.connect('mongodb://127.0.0.1:27017/rcj_it_manager')`.

```typescript
// models/Colaborador.ts
const ColaboradorSchema = new Schema({
  codigo:          { type: String, required: true, unique: true }, // IT-01, IT-04A, etc.
  nombre:          { type: String, required: true },
  puesto:          { type: String, required: true },
  codigo_puesto:   { type: String, required: true },               // IT-01 a IT-06B
  frente:          { type: String, enum: ['Desarrollo', 'Infraestructura', 'Jefatura'], required: true },
  nivel:           { type: String, enum: ['Junior', 'Mid-Senior', 'Senior', null] },
  fecha_ingreso:   { type: Date },
  estado:          { type: String, enum: ['Activo', 'Por contratar', 'Futuro'], default: 'Activo' },
  salario_mensual: { type: Number },
  notas:           { type: String },
}, { timestamps: true });

// models/Proyecto.ts
const ProyectoSchema = new Schema({
  _id:              { type: String },                              // INV-001, AD-001, etc.
  nombre:           { type: String, required: true },
  eje:              { type: String, enum: ['Infraestructura','Seguridad','Red','Software','Gobierno IT','Talento'], required: true },
  fase:             { type: Number, enum: [1, 2, 3], required: true },
  responsable:      { type: String },
  fecha_inicio:     { type: Date },
  fecha_fin:        { type: Date },
  prioridad:        { type: String, enum: ['Alta','Media','Baja'], default: 'Media' },
  estado:           { type: String, enum: ['Planificado','Activo','Completado','Bloqueado'], default: 'Planificado' },
  meta_kpi:         { type: String },
  porcentaje_avance:{ type: Number, default: 0 },
  notas:            { type: String },
}, { timestamps: true });

// models/Tarea.ts
const TareaSchema = new Schema({
  proyecto_id:      { type: String, ref: 'Proyecto', required: true },
  nombre:           { type: String, required: true },
  descripcion:      { type: String },
  responsable:      { type: String },
  fecha_inicio:     { type: Date },
  fecha_fin:        { type: Date },
  kpi:              { type: String },
  fuente_medicion:  { type: String },
  estado:           { type: String, enum: ['Pendiente','En progreso','Completado','Bloqueado'], default: 'Pendiente' },
  porcentaje:       { type: Number, default: 0 },
  eje:              { type: String },
}, { timestamps: true });

// models/Evaluacion.ts  (rúbrica de desarrolladores)
const CriterioSchema = new Schema({
  categoria:     String,   // Fundamentos | Desarrollo | Herramientas | Competencias
  criterio:      String,
  calificacion:  { type: String, enum: ['No cumple','En desarrollo','Cumple','Supera'] },
  comentario:    String,
  accion_mejora: String,
});

const EvaluacionSchema = new Schema({
  colaborador_id:       { type: Schema.Types.ObjectId, ref: 'Colaborador', required: true },
  fecha:                { type: Date, required: true },
  evaluado_por:         { type: String },
  nivel_actual:         { type: String, enum: ['Junior','Mid-Senior','Senior'] },
  resultado_global:     { type: String, enum: ['No cumple','En desarrollo','Cumple','Supera'] },
  decision:             { type: String, enum: ['Promover','Continuar','Plan de mejora'] },
  criterios:            [CriterioSchema],                          // array con los 14 criterios
  comentarios:          { type: String },
  firmas: {
    colaborador:  { type: Boolean, default: false },
    coordinador:  { type: Boolean, default: false },
    jefe:         { type: Boolean, default: false },
    rrhh:         { type: Boolean, default: false },
  },
}, { timestamps: true });

// models/PlanCarrera.ts  (checklist N2→Coord / Jr→Senior)
const PlanCarreraItemSchema = new Schema({
  codigo:          String,  // A1, B2, C3…
  seccion:         String,  // A. Formación | B. Conocimientos…
  requisito:       { type: String, required: true },
  tipo_requisito:  { type: String, enum: ['Indispensable','Recomendado'] },
  plazo_estimado:  String,
  recurso:         String,
  estado:          { type: String, enum: ['Pendiente','En progreso','Completado'], default: 'Pendiente' },
  notas:           String,
});

const PlanCarreraSchema = new Schema({
  colaborador_id:          { type: Schema.Types.ObjectId, ref: 'Colaborador', required: true },
  tipo:                    { type: String, enum: ['N2_a_Coord','Jr_a_Mid','Mid_a_Senior'], required: true },
  fecha_inicio:            { type: Date },
  periodo_estimado:        { type: String },
  responsable_seguimiento: { type: String },
  items:                   [PlanCarreraItemSchema],               // embed completo del checklist
}, { timestamps: true });

// models/Capacitacion.ts
const CapacitacionSchema = new Schema({
  nombre:       { type: String, required: true },
  proveedor:    { type: String, enum: ['Udemy','Interno','SAP','RRHH','Otro'] },
  modalidad:    { type: String, enum: ['Online','Presencial','Mixto'] },
  duracion_horas: Number,
  costo:        Number,
  fecha_inicio: Date,
  fecha_fin:    Date,
  estado:       { type: String, enum: ['Pendiente','En progreso','Completado'], default: 'Pendiente' },
  asignados: [{
    colaborador_id:   { type: Schema.Types.ObjectId, ref: 'Colaborador' },
    estado:           { type: String, enum: ['Pendiente','En progreso','Completado'], default: 'Pendiente' },
    fecha_completado: Date,
    calificacion:     Number,
    certificado:      String,
  }],
}, { timestamps: true });

// models/KPI.ts
const KpiRegistroSchema = new Schema({
  fecha: { type: Date, required: true },
  valor: Number,
  notas: String,
});

const KpiSchema = new Schema({
  eje:         { type: String, required: true },
  nombre:      { type: String, required: true },
  descripcion: String,
  meta:        String,
  unidad:      String,
  frecuencia:  { type: String, enum: ['Mensual','Trimestral','Único'] },
  responsable: String,
  registros:   [KpiRegistroSchema],                               // historial embebido
}, { timestamps: true });

// models/Config.ts
const ConfigSchema = new Schema({
  clave: { type: String, required: true, unique: true },
  valor: String,
});
```

---

## DATOS INICIALES — `server/db/seed.ts`

Precarga estos datos en el seed (ya validados con los perfiles de puesto reales):

### Puestos del equipo RCJ IT (colaboradores de ejemplo)
```typescript
const PUESTOS = [
  { codigo: 'IT-01', nombre: 'Jefe de IT', frente: 'Jefatura', salario: 0, estado: 'Activo' },
  { codigo: 'IT-02', nombre: 'Coordinador de Desarrollo IT', frente: 'Desarrollo', salario: 35000, estado: 'Por contratar' },
  { codigo: 'IT-03', nombre: 'Coordinador de Infraestructura IT', frente: 'Infraestructura', salario: 35000, estado: 'Por contratar' },
  { codigo: 'IT-04A', nombre: 'Programador Junior', frente: 'Desarrollo', nivel: 'Junior', salario: 25000, estado: 'Por contratar' },
  { codigo: 'IT-04B', nombre: 'Programador Mid-Senior', frente: 'Desarrollo', nivel: 'Mid-Senior', salario: 28500, estado: 'Por contratar' },
  { codigo: 'IT-04C', nombre: 'Programador Senior', frente: 'Desarrollo', nivel: 'Senior', salario: 0, estado: 'Futuro' },
  { codigo: 'IT-06A', nombre: 'Oficial de Soporte Técnico N1', frente: 'Infraestructura', salario: 20000, estado: 'Por contratar' },
  { codigo: 'IT-06B', nombre: 'Oficial de Soporte Técnico N2', frente: 'Infraestructura', salario: 25000, estado: 'Activo' },
]
```

### Proyectos (18 proyectos del Plan IT 2026)
Carga los 18 proyectos con sus IDs, fases, ejes, fechas y KPIs tal como están en el Excel `Plan_IT_2026_RCJ_PM.xlsx` entregado.

### KPIs base (5 metas anuales)
```typescript
const KPIS_BASE = [
  { eje: 'Infraestructura', nombre: 'Uptime servicios tier A', meta: '≥ 99.7%', unidad: '%', frecuencia: 'Mensual' },
  { eje: 'Infraestructura', nombre: 'Reducción incidentes críticos', meta: '-40%', unidad: '%', frecuencia: 'Trimestral' },
  { eje: 'Seguridad', nombre: 'Cobertura EDR', meta: '≥ 98%', unidad: '%', frecuencia: 'Mensual' },
  { eje: 'Seguridad', nombre: 'Usuarios con MFA', meta: '100%', unidad: '%', frecuencia: 'Mensual' },
  { eje: 'Red', nombre: 'SLA enlace WAN', meta: 'Firmado', unidad: 'Estado', frecuencia: 'Único' },
  { eje: 'Software', nombre: 'MTTFR tickets P1', meta: '< 4h', unidad: 'horas', frecuencia: 'Mensual' },
  { eje: 'Software', nombre: 'Resolución N1', meta: '≥ 70%', unidad: '%', frecuencia: 'Mensual' },
  { eje: 'Gobierno IT', nombre: 'Proyectos con caso de negocio', meta: '100%', unidad: '%', frecuencia: 'Mensual' },
  { eje: 'Gobierno IT', nombre: 'Reducción OPEX TI', meta: '15-25%', unidad: '%', frecuencia: 'Trimestral' },
  { eje: 'Talento', nombre: 'Coordinadores contratados', meta: '2', unidad: 'personas', frecuencia: 'Único' },
]
```

### Checklist N2 → Coordinador (carga todos los items de `Evaluacion_de_N2_a_Coor.xlsx`)
Secciones A, B, C, D, E, F con sus códigos, descripción, tipo (Indispensable/Recomendado), plazo y recurso.

### Criterios de evaluación desarrolladores (de `Developers.xlsx`)
Categorías: Fundamentos, Desarrollo, Herramientas, Competencias — con los 14 criterios y sus descripciones por nivel (Junior/Mid-Senior/Senior).

---

## MÓDULOS — ESPECIFICACIÓN DETALLADA

### 1. LAYOUT PRINCIPAL

```
Sidebar izquierdo (colapsable):
  - Logo RCJ + "IT Manager"
  - Dashboard
  - Proyectos
  - Equipo
  - Capacitaciones
  - Gastos
  - KPIs / Metas

Header:
  - Título de la página actual
  - Fecha actual
  - Botón "Nueva entrada rápida"
```

---

### 2. DASHBOARD (página de inicio)

**Cards resumen arriba:**
- Proyectos activos / total
- Tareas vencidas
- KPI promedio cumplimiento
- Capacitaciones en progreso

**Gantt mini** (últimas 4 semanas + próximas 4):
- Barra por proyecto activo, coloreada por eje
- Clic → va al proyecto

**Gráfica de barras** — avance por fase (% completado):
- Fase 1, Fase 2, Fase 3

**Tabla de tareas próximas a vencer** (próximos 14 días):
- Nombre tarea | Proyecto | Responsable | Fecha fin | Estado

**Gauge de metas anuales** (5 gauges circulares):
- Continuidad operativa, Modernización, Eficiencia costos, Gobierno IT, Equipo

---

### 3. MÓDULO PROYECTOS

#### Vista lista (tabla filtrable):
- Filtros: Fase | Eje | Estado | Prioridad
- Columnas: ID | Nombre | Eje | Fase | Responsable | Inicio | Fin | Avance | Estado
- Avance = barra de progreso calculada de sus tareas
- Botón "Nuevo proyecto"

#### Vista Gantt (timeline):
- Semanas de marzo a agosto 2026
- Barras coloreadas por eje
- Tooltip con nombre, responsable, % avance
- Interactivo: clic en barra abre detalle

#### Detalle de proyecto (modal o página):
- Info general editable
- Lista de tareas con checkbox de completado
- Sección "KPI / Meta" con campo de seguimiento
- Historial de cambios de estado
- Botón "Agregar tarea"

#### Formulario nuevo/editar proyecto:
- Todos los campos del schema
- Selector de responsable (del equipo)
- Selector de eje y fase

---

### 4. MÓDULO EQUIPO

#### Vista organigrama (visual):
```
              [Jefe IT - IT-01]
                    |
        ┌───────────┴───────────┐
[Coord. Desarrollo IT-02]  [Coord. Infraestructura IT-03]
        |                        |
┌───────┴───────┐          ┌─────┴──────┐
[Jr IT-04A] [Mid IT-04B]  [N1 IT-06A] [N2 IT-06B]
                │
           [Sr IT-04C]
```
- Los puestos "Por contratar" se muestran en gris punteado
- Clic en puesto → panel lateral con info del perfil

#### Vista tabla de colaboradores:
- Nombre | Puesto | Frente | Nivel | Estado | Salario | Acciones
- Filtro por frente / estado
- Botón "Agregar colaborador"

#### Perfil de colaborador (página propia):
**Tabs:**
1. **Info general** — datos personales, puesto, salario, fechas
2. **Descriptor de puesto** — objetivo, requisitos, autoridad (datos del perfil RH-F-04)
3. **Evaluaciones** — historial de evaluaciones, botón "Nueva evaluación"
4. **Plan de carrera** — checklist correspondiente según tipo de ruta
5. **Capacitaciones** — lista de capacitaciones asignadas con estado

#### Formulario de evaluación de desarrolladores:
Basado exactamente en `Developers.xlsx`:
- Datos del colaborador + fecha + evaluador
- Rúbrica con 4 categorías y 14 criterios
- Por cada criterio: selector (No cumple / En desarrollo / Cumple / Supera) + campo comentario + campo acción de mejora
- Resultado global calculado automáticamente
- Decisión de promoción (Promover / Continuar / Plan de mejora)
- Sección de firmas con checkboxes (Colaborador / Coordinador / Jefe IT / RRHH)

#### Checklist Plan de Carrera N2 → Coordinador:
Basado exactamente en `Evaluacion_de_N2_a_Coor.xlsx`:
- Dos tabs: "Checklist de Requisitos" y "Plan de Capacitaciones"
- Secciones A, B, C, D, E, F
- Cada item: estado (Completado ✅ / En progreso 🔄 / Pendiente ⬜)
- Badge "Indispensable" en rojo, "Recomendado" en azul
- Barra de progreso total (X / 30 items)
- Campo de notas por item

---

### 5. MÓDULO CAPACITACIONES

#### Vista general:
- Cards por colaborador con % completado de su plan
- Filtro por estado (Pendiente / En progreso / Completado)

#### Tabla de capacitaciones:
- Nombre | Proveedor | Modalidad | Horas | Costo | Fechas | Asignados | Estado
- Botón "Nueva capacitación"

#### Asignación masiva:
- Seleccionar capacitación → asignar a uno o varios colaboradores
- Estado individual por colaborador

#### Reporte de avance:
- Tabla: Colaborador | Capacitación | Estado | Fecha completado | Calificación

---

### 6. MÓDULO GASTOS / OPEX

**Este módulo lee un archivo Excel directamente, no tiene formulario de entrada manual.**

#### Lógica de lectura Excel:
```typescript
// server/routes/gastos.ts
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

// Lee el archivo data/gastos.xlsx
// Busca la hoja "Base OPEX (Gastos)" o la primera hoja
// Extrae filas por categoría con sus montos mensuales
// Devuelve JSON al frontend

GET /api/gastos/opex
→ { categorias: [...], totalAnual: number, meta20: number, periodos: [...] }

GET /api/gastos/ultimo-sync
→ { fecha: string, archivo: string }

POST /api/gastos/sync
→ Vuelve a leer el archivo y actualiza el cache
```

#### Vista frontend:
**Banner de estado:**
```
📂 Leyendo: data/gastos.xlsx | Último sync: [fecha] | [Botón: Sincronizar]
```
Si el archivo no existe:
```
⚠️  Coloca tu archivo gastos.xlsx en la carpeta /data/ y haz clic en Sincronizar
```

**Cards resumen:**
- OPEX base 2025 total (Lps)
- Meta reducción (-20%)
- Ahorro proyectado

**Gráfica de barras horizontales** por categoría:
- Salarios | Licencias | Tercerización | Conectividad | Cloud | Hardware | Otros
- Barra actual vs. meta (-20%)

**Tabla mensual:**
- Categoría | Ene | Feb | Mar | ... | Dic | Total | Meta −20%
- Totales en la última fila

**Nota al pie:**
```
Los datos se leen del archivo local data/gastos.xlsx.
Para actualizar: reemplaza el archivo y haz clic en "Sincronizar".
```

---

### 7. MÓDULO KPIs / METAS

#### 5 cards de metas anuales:
Cada card muestra:
- Nombre de la meta
- Valor objetivo (99.9%, ≥60%, 15-25%, 100%, Equipo)
- Gauge circular con % de avance
- Lista de KPIs con su último registro
- Botón "Registrar valor"

#### Modal "Registrar valor de KPI":
- Selector de KPI
- Fecha (default hoy)
- Valor numérico
- Notas

#### Gráfica de tendencia:
- Por KPI seleccionado, evolución en el tiempo (línea)

---

## API REST — ENDPOINTS REQUERIDOS

```
# Colaboradores
GET    /api/colaboradores
POST   /api/colaboradores
GET    /api/colaboradores/:id
PUT    /api/colaboradores/:id
DELETE /api/colaboradores/:id

# Proyectos
GET    /api/proyectos
POST   /api/proyectos
GET    /api/proyectos/:id
PUT    /api/proyectos/:id

# Tareas
GET    /api/tareas?proyecto_id=
POST   /api/tareas
PUT    /api/tareas/:id
DELETE /api/tareas/:id

# Evaluaciones
GET    /api/evaluaciones?colaborador_id=
POST   /api/evaluaciones
GET    /api/evaluaciones/:id
PUT    /api/evaluaciones/:id

# Plan de carrera
GET    /api/plan-carrera/:colaborador_id
PUT    /api/plan-carrera/item/:id    (actualizar estado del item)

# Capacitaciones
GET    /api/capacitaciones
POST   /api/capacitaciones
POST   /api/capacitaciones/:id/asignar
PUT    /api/capacitacion-colaboradores/:id

# KPIs
GET    /api/kpis
GET    /api/kpi-registros?kpi_id=
POST   /api/kpi-registros

# Gastos (Excel)
GET    /api/gastos/opex
GET    /api/gastos/ultimo-sync
POST   /api/gastos/sync

# Dashboard
GET    /api/dashboard/resumen
```

---

## DISEÑO VISUAL

### Paleta de colores (obligatoria):
```css
:root {
  --navy:     #002060;   /* RCJ azul marino — headers, sidebar */
  --lime:     #70AD47;   /* RCJ verde — acciones, éxito */
  --lime-lt:  #EAF5D9;   /* fondos éxito suave */
  --blue-lt:  #DCE6F1;   /* fondos info */
  --white:    #FFFFFF;
  --gray-bg:  #F8F9FA;   /* fondo general */
  --gray-lt:  #F1F3F5;   /* cards */
  --border:   #E0E4E8;
  --text:     #1A1A2E;
  --text-muted: #6B7280;
}
/* Ejes */
--infra:  #1F4E79; /* Infraestructura */
--seg:    #C00000; /* Seguridad */
--red:    #375623; /* Red */
--soft:   #7F6000; /* Software */
--gov:    #4527A0; /* Gobierno IT */
--tal:    #0F6E56; /* Talento */
```

### Sidebar:
- Fondo `--navy`
- Texto blanco
- Item activo: fondo `--lime` con texto navy
- Logo: "RCJ" en azul navy + "IT Manager" en verde lime

### Cards:
- Fondo blanco, borde `--border` 1px, border-radius 8px
- Sombra suave: `0 1px 3px rgba(0,0,0,0.08)`

### Tipografía:
- Font: `Inter` (Google Fonts)
- Headings: 600
- Body: 400, 14px
- Labels/captions: 12px, `--text-muted`

---

## INSTRUCCIONES TÉCNICAS PARA CURSOR

### Inicio del proyecto:
```bash
# 1. Crear proyecto
npm create vite@latest rcj-it-manager -- --template react-ts
cd rcj-it-manager

# 2. Instalar dependencias frontend
npm install tailwindcss @tailwindcss/vite
npm install @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select
npm install shadcn-ui zustand recharts lucide-react date-fns
npm install -D @types/node

# 3. Instalar dependencias backend
npm install express mongoose xlsx cors
npm install -D @types/express @types/cors ts-node nodemon

# 4. Crear carpeta data y verificar MongoDB
mkdir data
# Asegúrate de tener MongoDB Community Edition instalado y corriendo:
# mongod --dbpath ./data/db  (o como servicio del sistema)
```

### Scripts en `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "vite --port 5173",
    "dev:server": "nodemon server/index.ts",
    "build": "vite build",
    "seed": "ts-node server/db/seed.ts"
  }
}
```

### Proxy Vite (`vite.config.ts`):
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

---

## ORDEN DE CONSTRUCCIÓN (para Cursor, paso a paso)

Construye en este orden exacto para que cada paso sea funcional:

1. **Estructura y configuración** — setup de carpetas, Tailwind, shadcn/ui base, sidebar, layout
2. **Backend base** — Express server, MongoDB conexión, modelos Mongoose, seed.ts, seed.ts
3. **API colaboradores + Módulo Equipo** — CRUD completo, organigrama visual, perfil
4. **API proyectos + tareas + Módulo Proyectos** — tabla, Gantt, detalle con tareas
5. **Evaluaciones de desarrolladores** — formulario completo basado en rúbrica
6. **Plan de carrera checklist** — N2→Coordinador, Jr→Senior
7. **Módulo Capacitaciones** — CRUD y asignación
8. **Módulo Gastos** — lector Excel, sync, gráficas
9. **KPIs y registro de métricas**
10. **Dashboard** — consolida todo con gráficas y resúmenes

---

## CONTEXTO DE NEGOCIO (para que el código haga sentido)

- **Empresa:** RCJ Corporación — grupo de empresas en Honduras (Tecno Supplier, RCJ Logistics, Centroquím, Harmony Care Labs, Stella Equity Capital, Joch International Trading, LASA, RCJ Inmobiliaria, Estelita Joch)
- **Área:** IT centralizada que sirve a todo el grupo
- **Jefa de IT:** Usuario principal de la app
- **Plan vigente:** Plan IT 2026 — ejecución marzo a agosto, 3 fases, 18 proyectos, 5 metas estratégicas
- **Moneda:** Lempiras (Lps) — mostrar con formato `Lps #,##0.00`
- **Idioma:** Español (Honduras) — todas las etiquetas, mensajes y fechas en español
- **Formato de fechas:** DD/MM/YYYY

### Perfiles de puesto cargados en la app:
| Código | Puesto | Reporta a | Frente |
|--------|--------|-----------|--------|
| IT-01  | Jefe de IT | Gerencia General | Jefatura |
| IT-02  | Coordinador de Desarrollo IT | Jefe IT | Desarrollo |
| IT-03  | Coordinador de Infraestructura IT | Jefe IT | Infraestructura |
| IT-04A | Programador Junior | Coord. Desarrollo | Desarrollo |
| IT-04B | Programador Mid-Senior | Coord. Desarrollo | Desarrollo |
| IT-04C | Programador Senior | Coord. Desarrollo | Desarrollo |
| IT-06A | Oficial Soporte Técnico N1 | Coord. Infraestructura | Infraestructura |
| IT-06B | Oficial Soporte Técnico N2 | Coord. Infraestructura | Infraestructura |

### Rutas de carrera activas:
- **Soporte N2 → Coordinador de Infraestructura** (checklist de 30 items en 6 secciones)
- **Programador Junior → Mid-Senior → Senior** (evaluación con 14 criterios en 4 categorías)

---

## NOTAS FINALES PARA CURSOR

- **Toda la data es local.** No hay login, no hay autenticación. La app es para uso personal de la Jefa IT.
- **El Excel de gastos** se coloca en `/data/gastos.xlsx` y se lee con SheetJS. Si no existe, mostrar mensaje amigable.
- **Los datos del seed** deben ser reales y usables desde el primer `npm run dev`. No poner placeholders.
- **Manejo de errores:** mostrar toasts amigables, nunca pantalla en blanco.
- **Responsive:** funciona en desktop (1440px) y laptop (1280px). No necesita mobile.
- **Persistencia:** todo en MongoDB local. Requiere MongoDB Community Edition instalado en la máquina (`mongod` corriendo en puerto 27017). Base de datos: `rcj_it_manager`.
- **La app debe sentirse como una herramienta interna de calidad**, no un CRUD genérico. Cada módulo debe tener el contexto de RCJ IT visible (colores, terminología del plan).

---

*Prompt preparado para: RCJ Corporación — Plan IT 2026 | Versión 1.0 | Mayo 2026*

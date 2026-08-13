import 'dotenv/config'

import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'

import { connectDb } from './db/connection.js'
import './db/models/index.js'
import {
  ensureDepartamentos,
  ensureEjesProyecto,
  ensureEhrCompanyListConfig,
  ensureDescriptoresPuesto,
  ensureKpisIniciales,
  ensureMetasDepartamentosIniciales,
  ensurePerfilesPuesto,
  ensurePlantillasCarrera,
  ensureITArquitecturaData,
  ensureSapBiCosteoPermisos,
  ensureRolesYAdmin,
  ensureRubricasPorPerfil,
  ensureRubricasPorPuesto,
} from './db/initData.js'
import { isAdLoginEnabled } from './utils/ehrAuth.js'
import { requireAuth } from './middleware/requireAuth.js'
import { authRouter } from './routes/auth.js'
import { dashboardRouter } from './routes/dashboard.js'
import { ehrRouter } from './routes/ehr.js'
import { empleadosRouter } from './routes/empleados.js'
import { gastosRouter } from './routes/gastos.js'
import { itArquitecturaRouter } from './routes/itArquitectura.js'
import { kpiRegistrosRouter } from './routes/kpiRegistros.js'
import { kpisRouter } from './routes/kpis.js'
import { metasRouter } from './routes/metas.js'
import { costeoMuestrasRouter } from './routes/costeoMuestras.js'
import { capacitacionColaboradoresRouter } from './routes/capacitacionColaboradores.js'
import { capacitacionesRouter } from './routes/capacitaciones.js'
import { colaboradoresRouter } from './routes/colaboradores.js'
import { departamentosRouter } from './routes/departamentos.js'
import { ejesProyectoRouter } from './routes/ejesProyecto.js'
import { empresasRouter } from './routes/empresas.js'
import { descriptoresPuestoRouter } from './routes/descriptoresPuesto.js'
import { evaluacionesRouter } from './routes/evaluaciones.js'
import { evaluacionesKpiRouter } from './routes/evaluacionesKpi.js'
import { perfilesPuestoRouter } from './routes/perfilesPuesto.js'
import { plantillasCarreraRouter } from './routes/plantillasCarrera.js'
import { planCarreraRouter } from './routes/planCarrera.js'
import { proveedoresCapacitacionRouter } from './routes/proveedoresCapacitacion.js'
import { proyectosRouter } from './routes/proyectos.js'
import { rolesRouter } from './routes/roles.js'
import { tareasRouter } from './routes/tareas.js'
import { usuariosRouter } from './routes/usuarios.js'
import { vacacionesRouter } from './routes/vacaciones.js'
import { ADJUNTOS_TAREAS_DIR } from './utils/multerAdjuntosTareas.js'
import { ADJUNTOS_PROYECTOS_DIR } from './utils/multerAdjuntosProyectos.js'
import { CERTS_DIR } from './utils/multerCertificados.js'
import { mountClientApp } from './utils/serveClient.js'
import { sincronizarEmpleadosDepartamentoDesdeEhr } from './utils/sincronizarEmpleadoDepartamentoEhr.js'

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST ?? '0.0.0.0'
const INIT_DATA_ON_START = process.env.INIT_DATA_ON_START === 'true'

const CORS_ORIGINS = (process.env.CORS_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const app = express()
app.use(
  cors({
    origin(origin, callback) {
      // Sin Origin = same-origin / herramientas locales (curl, healthchecks)
      if (!origin || CORS_ORIGINS.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error(`Origen CORS no permitido: ${origin}`))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use('/api/certificados', express.static(CERTS_DIR))
app.use('/api/adjuntos-tareas', express.static(ADJUNTOS_TAREAS_DIR))
app.use('/api/adjuntos-proyectos', express.static(ADJUNTOS_PROYECTOS_DIR))

// Public routes (no auth required)
app.get('/api/health', (_req, res) => {
  const mongo =
    mongoose.connection.readyState === 1
      ? 'connected'
      : mongoose.connection.readyState === 2
        ? 'connecting'
        : 'disconnected'
  res.json({ ok: true, mongo })
})
app.use('/api/auth', authRouter)

// All other /api routes require authentication
app.use('/api', requireAuth)

app.use('/api/departamentos', departamentosRouter)
app.use('/api/ejes-proyecto', ejesProyectoRouter)
app.use('/api/empresas', empresasRouter)
app.use('/api/descriptores-puesto', descriptoresPuestoRouter)
app.use('/api/ehr', ehrRouter)
app.use('/api/empleados', empleadosRouter)
app.use('/api/perfiles-puesto', perfilesPuestoRouter)
app.use('/api/plantillas-carrera', plantillasCarreraRouter)
app.use('/api/roles', rolesRouter)
app.use('/api/usuarios', usuariosRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/gastos', gastosRouter)
app.use('/api/costeo-muestras', costeoMuestrasRouter)
app.use('/api/it', itArquitecturaRouter)
app.use('/api/kpi-registros', kpiRegistrosRouter)
app.use('/api/kpis', kpisRouter)
app.use('/api/metas', metasRouter)
app.use('/api/capacitacion-colaboradores', capacitacionColaboradoresRouter)
app.use('/api/capacitaciones', capacitacionesRouter)
app.use('/api/proveedores-capacitacion', proveedoresCapacitacionRouter)
app.use('/api/colaboradores', colaboradoresRouter)
app.use('/api/evaluaciones', evaluacionesRouter)
app.use('/api/evaluaciones-kpi', evaluacionesKpiRouter)
app.use('/api/plan-carrera', planCarreraRouter)
app.use('/api/proyectos', proyectosRouter)
app.use('/api/tareas', tareasRouter)
app.use('/api/vacaciones', vacacionesRouter)

const clientMounted = mountClientApp(app)
if (clientMounted) {
  console.log('Frontend estático — client/dist')
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
      res.status(400).json({ error: 'Solicitud inválida. Vuelve a intentar el inicio de sesión.' })
      return
    }
    if (err instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ error: 'Error de validación', detalle: err.message })
      return
    }
    const code = (err as { code?: number }).code
    if (code === 11000) {
      res.status(409).json({ error: 'Registro duplicado (clave única existente)' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  },
)

function logAuthMode() {
  const platform = isAdLoginEnabled() ? false : true
  const ad = isAdLoginEnabled()
  const fallback = process.env.AUTH_LOCAL_FALLBACK === 'true'
  console.log(
    `Auth: ${platform ? 'IT Manager (correo + contraseña local)' : `Active Directory (fallback local=${fallback})`}`,
  )
}

async function runStartupMigrations() {
  try {
    await ensureSapBiCosteoPermisos()
  } catch (err) {
    console.error('Error en migraciones ligeras (la API sigue activa):', err)
  }
}

async function runStartupTasks() {
  try {
    await ensureDepartamentos()
    await sincronizarEmpleadosDepartamentoDesdeEhr()
    await ensureEjesProyecto()
    await ensureEhrCompanyListConfig()
    await ensureDescriptoresPuesto()
    await ensureRubricasPorPuesto()
    await ensurePerfilesPuesto()
    await ensureRubricasPorPerfil()
    await ensurePlantillasCarrera()
    await ensureRolesYAdmin()
    await ensureITArquitecturaData()
    await ensureMetasDepartamentosIniciales()
    await ensureKpisIniciales()
    console.log('Datos iniciales listos.')
  } catch (err) {
    console.error('Error en tareas de inicio (la API sigue activa):', err)
  }
}

async function main() {
  const server = app.listen(PORT, HOST, () => {
    console.log(`RCJ IT Manager — http://${HOST}:${PORT}`)
    logAuthMode()
  })

  const shutdown = () => {
    server.close(() => process.exit(0))
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)

  void connectDb()
    .then(() => {
      void runStartupMigrations()
      if (INIT_DATA_ON_START) {
        void runStartupTasks()
      } else {
        console.log('Carga de datos iniciales desactivada (INIT_DATA_ON_START=false).')
      }
    })
    .catch((err) => {
      console.error('No se pudo conectar a MongoDB:', err)
    })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


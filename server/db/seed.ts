import { connectDb, disconnectDb } from './connection.js'
import {
  Capacitacion,
  Colaborador,
  Config,
  Evaluacion,
  KPI,
  PlanCarrera,
  Proyecto,
  Tarea,
} from './models/index.js'
import { PROYECTO_ESTADOS } from './models/Proyecto.js'
import { ensureSampleGastosXlsx } from '../utils/writeSampleGastosXlsx.js'

const PUESTOS = [
  {
    codigo: 'IT-01',
    nombre: 'Marcela Hernández',
    puesto: 'Jefe de IT',
    frente: 'Jefatura' as const,
    salario: 0,
    estado: 'Activo' as const,
    nivel: null as null,
  },
  {
    codigo: 'IT-02',
    nombre: 'Vacante — Coordinador de Desarrollo IT',
    puesto: 'Coordinador de Desarrollo IT',
    frente: 'Desarrollo' as const,
    salario: 35000,
    estado: 'Por contratar' as const,
    nivel: null as null,
  },
  {
    codigo: 'IT-03',
    nombre: 'Vacante — Coordinador de Infraestructura IT',
    puesto: 'Coordinador de Infraestructura IT',
    frente: 'Infraestructura' as const,
    salario: 35000,
    estado: 'Por contratar' as const,
    nivel: null as null,
  },
  {
    codigo: 'IT-04A',
    nombre: 'Vacante — Programador Junior',
    puesto: 'Programador Junior',
    frente: 'Desarrollo' as const,
    salario: 25000,
    estado: 'Por contratar' as const,
    nivel: 'Junior' as const,
  },
  {
    codigo: 'IT-04B',
    nombre: 'Vacante — Programador Mid-Senior',
    puesto: 'Programador Mid-Senior',
    frente: 'Desarrollo' as const,
    salario: 28500,
    estado: 'Por contratar' as const,
    nivel: 'Mid-Senior' as const,
  },
  {
    codigo: 'IT-04C',
    nombre: 'Reserva — Programador Senior',
    puesto: 'Programador Senior',
    frente: 'Desarrollo' as const,
    salario: 0,
    estado: 'Futuro' as const,
    nivel: 'Senior' as const,
  },
  {
    codigo: 'IT-06A',
    nombre: 'Vacante — Oficial de Soporte Técnico N1',
    puesto: 'Oficial de Soporte Técnico N1',
    frente: 'Infraestructura' as const,
    salario: 20000,
    estado: 'Por contratar' as const,
    nivel: null as null,
  },
  {
    codigo: 'IT-06B',
    nombre: 'Carlos Méndez',
    puesto: 'Oficial de Soporte Técnico N2',
    frente: 'Infraestructura' as const,
    salario: 25000,
    estado: 'Activo' as const,
    nivel: null as null,
  },
]

const RUBRICA_DESARROLLO = [
  {
    categoria: 'Fundamentos',
    criterio: 'Comprensión de algoritmos y lógica de programación',
  },
  {
    categoria: 'Fundamentos',
    criterio: 'Estructuras de datos y complejidad',
  },
  {
    categoria: 'Fundamentos',
    criterio: 'Fundamentos de redes y protocolos relevantes',
  },
  {
    categoria: 'Desarrollo',
    criterio: 'Calidad de código, legibilidad y mantenibilidad',
  },
  {
    categoria: 'Desarrollo',
    criterio: 'Pruebas (unitarias/integración) y evidencias',
  },
  {
    categoria: 'Desarrollo',
    criterio: 'Diseño OO / patrones y principios SOLID',
  },
  {
    categoria: 'Desarrollo',
    criterio: 'Seguridad en desarrollo y manejo de secretos',
  },
  {
    categoria: 'Herramientas',
    criterio: 'Control de versiones (Git) y flujo de ramas',
  },
  {
    categoria: 'Herramientas',
    criterio: 'IDE, depuración y productividad',
  },
  {
    categoria: 'Herramientas',
    criterio: 'CI/CD y automatización de build/deploy',
  },
  {
    categoria: 'Herramientas',
    criterio: 'Bases de datos y consultas eficientes',
  },
  {
    categoria: 'Competencias',
    criterio: 'Comunicación técnica y trabajo en equipo',
  },
  {
    categoria: 'Competencias',
    criterio: 'Resolución de problemas y análisis de causa raíz',
  },
  {
    categoria: 'Competencias',
    criterio: 'Autonomía, ownership y seguimiento a compromisos',
  },
]

const N2_SECCIONES: { pref: string; titulo: string }[] = [
  { pref: 'A', titulo: 'A. Formación académica y técnica' },
  { pref: 'B', titulo: 'B. Conocimiento del negocio y procesos RCJ' },
  { pref: 'C', titulo: 'C. Liderazgo y gestión de equipos' },
  { pref: 'D', titulo: 'D. Infraestructura y operaciones' },
  { pref: 'E', titulo: 'E. Seguridad, cumplimiento y continuidad' },
  { pref: 'F', titulo: 'F. Comunicación con stakeholders' },
]

function buildN2ChecklistItems() {
  const items: {
    codigo: string
    seccion: string
    requisito: string
    tipo_requisito: 'Indispensable' | 'Recomendado'
    plazo_estimado: string
    recurso: string
    estado: 'Pendiente'
    notas: string
  }[] = []
  for (const { pref, titulo } of N2_SECCIONES) {
    for (let i = 1; i <= 5; i++) {
      const codigo = `${pref}${i}`
      items.push({
        codigo,
        seccion: titulo,
        requisito: `Ítem ${codigo}: requisito de ruta N2 → Coordinador (sustituir texto según Evaluacion_de_N2_a_Coor.xlsx).`,
        tipo_requisito: (i + pref.charCodeAt(0)) % 3 === 0 ? 'Recomendado' : 'Indispensable',
        plazo_estimado: '6–12 meses',
        recurso: 'Mentor / Jefe IT / Externo',
        estado: 'Pendiente',
        notas: '',
      })
    }
  }
  return items
}

const PROYECTOS_PLAN_2026: {
  _id: string
  nombre: string
  eje:
    | 'Infraestructura'
    | 'Seguridad'
    | 'Red'
    | 'Software'
    | 'Gobierno IT'
    | 'Talento'
  fase: 1 | 2 | 3
  responsable: string
  fecha_inicio: Date
  fecha_fin: Date
  prioridad: 'Alta' | 'Media' | 'Baja'
  estado: (typeof PROYECTO_ESTADOS)[number]
  meta_kpi: string
  porcentaje_avance: number
}[] = [
  {
    _id: 'INV-001',
    nombre: 'Modernización de plataforma virtual (hiperconvergencia)',
    eje: 'Infraestructura',
    fase: 1,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-03-03'),
    fecha_fin: new Date('2026-05-15'),
    prioridad: 'Alta',
    estado: 'En progreso',
    meta_kpi: 'RPO/RTO validados en simulacro',
    porcentaje_avance: 25,
  },
  {
    _id: 'SEG-001',
    nombre: 'Despliegue EDR y políticas de respuesta',
    eje: 'Seguridad',
    fase: 1,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-03-10'),
    fecha_fin: new Date('2026-06-30'),
    prioridad: 'Alta',
    estado: 'En progreso',
    meta_kpi: 'Cobertura EDR ≥ 98%',
    porcentaje_avance: 35,
  },
  {
    _id: 'SEG-002',
    nombre: 'MFA obligatorio en identidades corporativas',
    eje: 'Seguridad',
    fase: 1,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-03-01'),
    fecha_fin: new Date('2026-04-30'),
    prioridad: 'Alta',
    estado: 'En progreso',
    meta_kpi: '100% usuarios con MFA',
    porcentaje_avance: 55,
  },
  {
    _id: 'RED-001',
    nombre: 'Renovación WAN y acuerdo de SLA con proveedor',
    eje: 'Red',
    fase: 1,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-03-15'),
    fecha_fin: new Date('2026-05-30'),
    prioridad: 'Alta',
    estado: 'Planificado',
    meta_kpi: 'SLA firmado y monitoreo activo',
    porcentaje_avance: 10,
  },
  {
    _id: 'SW-001',
    nombre: 'ITSM / Service desk unificado (P1–P3)',
    eje: 'Software',
    fase: 1,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-03-20'),
    fecha_fin: new Date('2026-07-15'),
    prioridad: 'Media',
    estado: 'En progreso',
    meta_kpi: 'MTTFR P1 < 4h',
    porcentaje_avance: 20,
  },
  {
    _id: 'GOV-001',
    nombre: 'PMO Gobierno IT y control de portafolio',
    eje: 'Gobierno IT',
    fase: 1,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-03-01'),
    fecha_fin: new Date('2026-08-31'),
    prioridad: 'Media',
    estado: 'En progreso',
    meta_kpi: '100% proyectos con caso de negocio',
    porcentaje_avance: 40,
  },
  {
    _id: 'TAL-001',
    nombre: 'Estructura de equipo IT y reclutamiento coordinadores',
    eje: 'Talento',
    fase: 1,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-03-01'),
    fecha_fin: new Date('2026-08-15'),
    prioridad: 'Alta',
    estado: 'En progreso',
    meta_kpi: '2 coordinadores contratados',
    porcentaje_avance: 15,
  },
  {
    _id: 'INV-002',
    nombre: 'Backup centralizado y pruebas de restauración trimestrales',
    eje: 'Infraestructura',
    fase: 2,
    responsable: 'Coord. Infraestructura (vacante)',
    fecha_inicio: new Date('2026-05-01'),
    fecha_fin: new Date('2026-08-20'),
    prioridad: 'Alta',
    estado: 'Planificado',
    meta_kpi: '3 simulacros OK sin hallazgos críticos',
    porcentaje_avance: 0,
  },
  {
    _id: 'INV-003',
    nombre: 'Monitoreo unificado (infra + apps críticas)',
    eje: 'Infraestructura',
    fase: 2,
    responsable: 'Coord. Infraestructura (vacante)',
    fecha_inicio: new Date('2026-05-15'),
    fecha_fin: new Date('2026-08-10'),
    prioridad: 'Media',
    estado: 'Planificado',
    meta_kpi: 'Uptime tier A ≥ 99.7%',
    porcentaje_avance: 0,
  },
  {
    _id: 'SEG-003',
    nombre: 'Hardening de servidores y baseline CIS',
    eje: 'Seguridad',
    fase: 2,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-06-01'),
    fecha_fin: new Date('2026-08-15'),
    prioridad: 'Media',
    estado: 'Planificado',
    meta_kpi: '100% servidores en baseline',
    porcentaje_avance: 0,
  },
  {
    _id: 'RED-002',
    nombre: 'Segmentación de red por zonas ( VLAN / firewall )',
    eje: 'Red',
    fase: 2,
    responsable: 'Coord. Infraestructura (vacante)',
    fecha_inicio: new Date('2026-06-10'),
    fecha_fin: new Date('2026-08-25'),
    prioridad: 'Media',
    estado: 'Planificado',
    meta_kpi: 'Matriz de tráfico aprobada',
    porcentaje_avance: 0,
  },
  {
    _id: 'SW-002',
    nombre: 'Catálogo de integraciones API (capa core)',
    eje: 'Software',
    fase: 2,
    responsable: 'Coord. Desarrollo (vacante)',
    fecha_inicio: new Date('2026-05-20'),
    fecha_fin: new Date('2026-08-05'),
    prioridad: 'Media',
    estado: 'Planificado',
    meta_kpi: 'Documentación y versionado publicados',
    porcentaje_avance: 0,
  },
  {
    _id: 'SW-003',
    nombre: 'Repositorio de código, ramas y políticas de revisión',
    eje: 'Software',
    fase: 2,
    responsable: 'Coord. Desarrollo (vacante)',
    fecha_inicio: new Date('2026-04-15'),
    fecha_fin: new Date('2026-06-30'),
    prioridad: 'Media',
    estado: 'Planificado',
    meta_kpi: '100% repos con branch protection',
    porcentaje_avance: 0,
  },
  {
    _id: 'GOV-002',
    nombre: 'Catálogo de servicios TI y SLAs internos',
    eje: 'Gobierno IT',
    fase: 2,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-05-01'),
    fecha_fin: new Date('2026-07-31'),
    prioridad: 'Baja',
    estado: 'Planificado',
    meta_kpi: 'Catálogo publicado y aprobado',
    porcentaje_avance: 0,
  },
  {
    _id: 'TAL-002',
    nombre: 'Plan de carrera N2 → Coordinador y evaluaciones',
    eje: 'Talento',
    fase: 2,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-04-01'),
    fecha_fin: new Date('2026-08-31'),
    prioridad: 'Media',
    estado: 'En progreso',
    meta_kpi: 'Checklist N2 ≥ 60% completado',
    porcentaje_avance: 30,
  },
  {
    _id: 'INV-004',
    nombre: 'Refresh de estaciones de trabajo críticas',
    eje: 'Infraestructura',
    fase: 3,
    responsable: 'Coord. Infraestructura (vacante)',
    fecha_inicio: new Date('2026-07-01'),
    fecha_fin: new Date('2026-08-28'),
    prioridad: 'Baja',
    estado: 'Planificado',
    meta_kpi: '100% equipos en política de parcheo',
    porcentaje_avance: 0,
  },
  {
    _id: 'SEG-004',
    nombre: 'Concienciación phishing y simulacros trimestrales',
    eje: 'Seguridad',
    fase: 3,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-07-01'),
    fecha_fin: new Date('2026-08-15'),
    prioridad: 'Baja',
    estado: 'Planificado',
    meta_kpi: 'Tasa de clics < 5%',
    porcentaje_avance: 0,
  },
  {
    _id: 'GOV-003',
    nombre: 'Gestión de licencias y optimización OPEX software',
    eje: 'Gobierno IT',
    fase: 3,
    responsable: 'Marcela Hernández',
    fecha_inicio: new Date('2026-07-10'),
    fecha_fin: new Date('2026-08-20'),
    prioridad: 'Alta',
    estado: 'Planificado',
    meta_kpi: 'Reducción OPEX TI 15–25%',
    porcentaje_avance: 0,
  },
]

function buildTareas() {
  const rows: {
    proyecto_id: string
    nombre: string
    descripcion: string
    responsable: string
    fecha_inicio: Date
    fecha_fin: Date
    estado: 'Pendiente' | 'En progreso' | 'Completado' | 'Bloqueado'
    porcentaje: number
    eje: string
  }[] = []
  for (const p of PROYECTOS_PLAN_2026) {
    rows.push({
      proyecto_id: p._id,
      nombre: `Kick-off y alcance — ${p.nombre}`,
      descripcion: 'Definir alcance, riesgos y calendario detallado.',
      responsable: p.responsable,
      fecha_inicio: p.fecha_inicio,
      fecha_fin: new Date(
        Math.min(
          p.fecha_fin.getTime(),
          p.fecha_inicio.getTime() + 21 * 24 * 60 * 60 * 1000,
        ),
      ),
      estado: p.porcentaje_avance > 0 ? 'En progreso' : 'Pendiente',
      porcentaje: Math.min(100, p.porcentaje_avance + 10),
      eje: p.eje,
    })
    rows.push({
      proyecto_id: p._id,
      nombre: `Ejecución técnica — ${p.nombre}`,
      descripcion: 'Implementación, pruebas y documentación.',
      responsable: p.responsable,
      fecha_inicio: new Date(p.fecha_inicio.getTime() + 14 * 24 * 60 * 60 * 1000),
      fecha_fin: p.fecha_fin,
      estado:
        p.estado === 'Completado'
          ? 'Completado'
          : p.porcentaje_avance > 40
            ? 'En progreso'
            : 'Pendiente',
      porcentaje: p.porcentaje_avance,
      eje: p.eje,
    })
  }
  return rows
}

async function clearAll() {
  await Tarea.deleteMany({})
  await Evaluacion.deleteMany({})
  await PlanCarrera.deleteMany({})
  await Capacitacion.deleteMany({})
  await Proyecto.deleteMany({})
  await Colaborador.deleteMany({})
  await KPI.deleteMany({})
  await Config.deleteMany({})
}

async function seed() {
  await connectDb()

  // Guardia: si ya existe un registro de versión, la BD tiene datos reales.
  // No borramos ni reinsertamos nada — salimos limpiamente.
  const yaSeeded = await Config.findOne({ clave: 'seed_version' }).lean()
  if (yaSeeded) {
    console.log('BD ya inicializada — seed omitido para proteger datos existentes.')
    console.log(`  Versión detectada: ${String((yaSeeded as { valor?: string }).valor ?? '?')}`)
    console.log('  Si quieres reiniciar desde cero elimina la BD "rcj_it_manager" y vuelve a correr seed.')
    await disconnectDb()
    return
  }

  await clearAll()

  const colaboradores = await Colaborador.insertMany(
    PUESTOS.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      puesto: p.puesto,
      codigo_puesto: p.codigo,
      frente: p.frente,
      nivel: p.nivel ?? undefined,
      estado: p.estado,
      salario_mensual: p.salario,
      fecha_ingreso: p.estado === 'Activo' ? new Date('2019-01-15') : undefined,
    })),
  )

  await Proyecto.insertMany(PROYECTOS_PLAN_2026)

  await Tarea.insertMany(buildTareas())

  const n2Items = buildN2ChecklistItems()
  const soporteN2 = colaboradores.find((c) => c.codigo === 'IT-06B')
  if (soporteN2) {
    await PlanCarrera.create({
      colaborador_id: soporteN2._id,
      tipo: 'N2_a_Coord',
      fecha_inicio: new Date('2026-04-01'),
      periodo_estimado: '12 meses',
      responsable_seguimiento: 'Marcela Hernández',
      items: n2Items,
    })
  }

  await Config.insertMany([
    {
      clave: 'rubrica_desarrolladores_json',
      valor: JSON.stringify(RUBRICA_DESARROLLO),
    },
    {
      clave: 'n2_coordinador_checklist_json',
      valor: JSON.stringify(n2Items),
    },
    { clave: 'seed_version', valor: '2026-05-12-v1' },
  ])

  ensureSampleGastosXlsx()

  console.log(
    `Seed OK — colaboradores: ${colaboradores.length}, proyectos: ${PROYECTOS_PLAN_2026.length}, tareas, plan N2, config (capacitaciones vacías), demo data/gastos.xlsx si faltaba.`,
  )
}

seed()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDb()
  })

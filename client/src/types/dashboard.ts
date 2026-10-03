import type { MetaEstrategicaDepto } from './departamento'
import type { KpiDoc } from './kpi'

export type DashboardAlcanceTipo = 'global' | 'departamentos' | 'equipo' | 'personal'

export type DashboardAlcance = {
  tipo: DashboardAlcanceTipo
  etiqueta: string
  descripcion: string
  departamentos: { _id: string; codigo: string; nombre: string }[]
}

export type DashboardResumen = {
  alcance: DashboardAlcance
  proyectos_activos: number
  proyectos_total: number
  tareas_vencidas: number
  kpi_promedio_pct: number
  capacitaciones_en_progreso: number
  avance_por_fase: { fase: 1 | 2 | 3; pct: number }[]
  tareas_proximas: {
    _id: string
    nombre: string
    proyecto_id: string
    proyecto_nombre: string
    responsable: string
    fecha_fin: string
    estado: string
  }[]
  kpis: KpiDoc[]
  /** Metas del departamento visibles en el alcance (configuración en KPIs → Registrar metas). */
  metas_estrategicas?: MetaEstrategicaDepto[]
  portfolio?: DashboardPortfolio
}

export type DashboardPortfolio = {
  salud: {
    pct_en_curso: number
    en_curso: number
    en_riesgo: number
    critico: number
    sin_fecha: number
    bloqueados: number
    atrasados: number
    completados: number
    activos: number
  }
  avance_promedio: number
  avance_esperado: number | null
  presupuesto: {
    planificado: number
    asignado: number
    ejecutado: number
    sobrecosto: number
    proyectos_con_presupuesto: number
    burn_pct: number | null
    asignado_pct: number | null
  }
  por_estado: { estado: string; count: number }[]
  por_prioridad: { prioridad: string; count: number }[]
  por_eje: { eje: string; count: number; avance: number }[]
  tareas: {
    total: number
    pendientes: number
    en_progreso: number
    completadas: number
    bloqueadas: number
    vencidas: number
    pct_completadas: number
    esta_semana: number
    semana_anterior: number
    throughput: { key: string; label: string; creadas: number; completadas: number }[]
  }
  schedule: { _id: string; nombre: string; tiempo: number; avance: number; nivel: string }[]
  timeline: {
    _id: string
    nombre: string
    estado: string
    eje: string
    porcentaje_avance: number
    fecha_inicio: string | null
    fecha_fin: string | null
    color: string
  }[]
  atencion: {
    _id: string
    nombre: string
    estado: string
    prioridad: string
    porcentaje_avance: number
    fecha_fin: string | null
    responsable: string
    nivel: string
    motivo: string
    color: string
    tiempo_pct: number | null
  }[]
  insights: string[]
  carga?: {
    por_persona: CargaTrabajoRow[]
    por_equipo: CargaTrabajoRow[]
    detalle: TareaCargaDetalle[]
  }
  ventana_gantt: { inicio: string; fin: string }
}

export type CargaTrabajoRow = {
  id: string
  nombre: string
  extra: string
  pendientes: number
  en_progreso: number
  bloqueadas: number
  vencidas: number
  completadas: number
  abiertas: number
}

export type TareaCargaDetalle = {
  _id: string
  nombre: string
  proyecto_id: string
  proyecto_nombre: string
  estado: string
  fecha_fin: string | null
  persona_id: string
  persona: string
  equipo_id: string
  equipo: string
  vencida: boolean
}

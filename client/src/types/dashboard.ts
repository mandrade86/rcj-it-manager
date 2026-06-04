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
}

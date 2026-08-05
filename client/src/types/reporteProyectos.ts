import type { ProyectoEstado } from './proyecto'
import type { RiesgoProyecto } from './proyecto'

export type ReporteStatusProyectoItem = {
  proyecto_id: string
  nombre: string
  departamento_id?: string | null
  eje?: string | null
  fase?: number | null
  estado: ProyectoEstado | string
  prioridad: string
  porcentaje_avance: number
  responsable?: string | null
  propietario?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  meta_kpi?: string | null
  tareas_total: number
  tareas_completadas: number
  tareas_en_progreso: number
  tareas_bloqueadas: number
  tareas_pendientes: number
  riesgo_auto: RiesgoProyecto
  riesgos_registrados: number
  riesgos_alto: number
}

export type ReporteStatusDepartamento = {
  departamento_id: string | null
  departamento_nombre: string
  departamento_codigo?: string | null
  resumen: {
    total_proyectos: number
    activos: number
    completados: number
    bloqueados: number
    avance_promedio: number
  }
  proyectos: ReporteStatusProyectoItem[]
}

export type ReporteStatusProyectos = {
  generado_en: string
  alcance: string
  departamento_id?: string | null
  proyecto_id?: string | null
  resumen: {
    total_proyectos: number
    total_departamentos: number
    activos: number
    completados: number
    bloqueados: number
    avance_promedio: number
    riesgos_registrados: number
    riesgos_alto: number
  }
  departamentos: ReporteStatusDepartamento[]
  departamentos_disponibles: Array<{ _id: string; nombre: string; codigo?: string }>
}

export type TareaEstado = 'Pendiente' | 'En progreso' | 'Completado' | 'Bloqueado'
export type TareaPrioridad = 'Alta' | 'Media' | 'Baja'

export type TareaAdjunto = {
  _id: string
  nombre_original: string
  archivo: string
  mime_type?: string
  size_bytes?: number
  subido_por?: string
  subido_en?: string
}

export type TareaComentario = {
  _id: string
  texto: string
  autor?: string
  autor_id?: string | null
  createdAt?: string
  updatedAt?: string
}

export type Tarea = {
  _id: string
  proyecto_id: string
  nombre: string
  descripcion?: string | null
  responsable?: string | null
  responsable_id?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  estado: TareaEstado
  prioridad?: TareaPrioridad | null
  /** Presupuesto asignado a la tarea (moneda del proyecto). */
  monto_asignado?: number | null
  /** Gasto real (opcional). Si no hay, se estima con monto_asignado × % avance. */
  monto_ejecutado?: number | null
  porcentaje: number
  eje?: string | null
  adjuntos?: TareaAdjunto[]
  /** Ids de tareas que deben completarse antes (predecesoras). */
  depende_de_ids?: string[]
  comentarios?: TareaComentario[]
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

/** Ejecutado estimado de una tarea para rollup de presupuesto. */
export function tareaMontoEjecutadoEstimado(t: Tarea): number {
  if (t.monto_ejecutado != null && Number.isFinite(t.monto_ejecutado)) {
    return Math.max(0, t.monto_ejecutado)
  }
  const asignado = t.monto_asignado != null && Number.isFinite(t.monto_asignado)
    ? Math.max(0, t.monto_asignado)
    : 0
  if (asignado <= 0) return 0
  if (t.estado === 'Completado') return asignado
  const pct = Math.min(100, Math.max(0, t.porcentaje ?? 0))
  return (asignado * pct) / 100
}

export function sumarPresupuestoTareas(tareas: Tarea[]): {
  asignado: number
  ejecutado: number
  conMonto: number
} {
  let asignado = 0
  let ejecutado = 0
  let conMonto = 0
  for (const t of tareas) {
    if (t.monto_asignado != null && Number.isFinite(t.monto_asignado) && t.monto_asignado > 0) {
      conMonto += 1
      asignado += t.monto_asignado
    } else if (t.monto_ejecutado != null && Number.isFinite(t.monto_ejecutado) && t.monto_ejecutado > 0) {
      conMonto += 1
    }
    ejecutado += tareaMontoEjecutadoEstimado(t)
  }
  return {
    asignado: Math.round(asignado * 100) / 100,
    ejecutado: Math.round(ejecutado * 100) / 100,
    conMonto,
  }
}

export type ReporteSemanalTarea = {
  _id: string
  nombre: string
  descripcion?: string | null
  estado: TareaEstado
  porcentaje: number
  responsable?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  ultimo_comentario?: string | null
  comentarios_count?: number
  tags?: string[]
}

export type ReporteSemanalProyecto = {
  proyecto_id: string
  proyecto_nombre: string
  eje?: string | null
  estado_proyecto?: string
  avance_proyecto: number
  avance_tareas_promedio: number
  tareas: ReporteSemanalTarea[]
}

export type ReporteSemanalTareas = {
  semana: {
    iso: string
    inicio: string
    fin: string
    etiqueta: string
  }
  alcance: string
  resumen: {
    total_proyectos: number
    proyectos_activos: number
    total_tareas: number
    completadas: number
    en_progreso: number
    pendientes: number
    bloqueadas: number
    vencidas: number
    pct_completadas: number
    avance_promedio: number
  }
  actividad_semana: {
    proyectos_con_tareas: number
    total_tareas: number
    completadas: number
    en_progreso: number
    pendientes: number
    bloqueadas: number
    vencidas: number
    pct_completadas: number
    avance_promedio: number
  }
  destacados: {
    bloqueadas: Array<{
      proyecto_id: string
      proyecto_nombre: string
      tarea_id: string
      tarea_nombre: string
      responsable?: string | null
    }>
    vencidas: Array<{
      proyecto_id: string
      proyecto_nombre: string
      tarea_id: string
      tarea_nombre: string
      responsable?: string | null
      fecha_fin?: string | null
    }>
  }
  proyectos: ReporteSemanalProyecto[]
}

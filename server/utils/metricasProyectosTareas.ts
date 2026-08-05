import { PROYECTO_ESTADOS_ACTIVOS } from './proyectoScope.js'

export type ResumenTareasConteo = {
  total_tareas: number
  completadas: number
  en_progreso: number
  pendientes: number
  bloqueadas: number
  vencidas: number
  pct_completadas: number
  avance_promedio: number
}

type TareaMetrica = {
  _id: unknown
  proyecto_id: string
  nombre: string
  estado: string
  porcentaje?: number
  responsable?: string | null
  fecha_fin?: Date | null
}

type ProyectoMetrica = {
  _id: string
  nombre: string
  estado?: string | null
}

export function contarProyectosActivos(proyectos: ProyectoMetrica[]): number {
  const activos = new Set<string>(PROYECTO_ESTADOS_ACTIVOS)
  return proyectos.filter((p) => p.estado && activos.has(p.estado)).length
}

export function contarResumenTareas(tareas: TareaMetrica[], hoy: Date): ResumenTareasConteo {
  let completadas = 0
  let enProgreso = 0
  let pendientes = 0
  let bloqueadas = 0
  let vencidas = 0
  let sumAvance = 0

  for (const t of tareas) {
    sumAvance += t.porcentaje ?? 0
    if (t.estado === 'Completado') completadas++
    else if (t.estado === 'En progreso') enProgreso++
    else if (t.estado === 'Bloqueado') bloqueadas++
    else pendientes++

    const fin = t.fecha_fin ? new Date(t.fecha_fin) : null
    if (t.estado !== 'Completado' && fin && fin < hoy) vencidas++
  }

  const total = tareas.length
  return {
    total_tareas: total,
    completadas,
    en_progreso: enProgreso,
    pendientes,
    bloqueadas,
    vencidas,
    pct_completadas: total > 0 ? Math.round((completadas / total) * 100) : 0,
    avance_promedio: total > 0 ? Math.round(sumAvance / total) : 0,
  }
}

export function buildDestacadosTareas(
  tareas: TareaMetrica[],
  proyectoNombreById: Map<string, string>,
  hoy: Date,
  limit = 12,
): {
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
} {
  const bloqueadas: Array<{
    proyecto_id: string
    proyecto_nombre: string
    tarea_id: string
    tarea_nombre: string
    responsable?: string | null
  }> = []
  const vencidas: Array<{
    proyecto_id: string
    proyecto_nombre: string
    tarea_id: string
    tarea_nombre: string
    responsable?: string | null
    fecha_fin?: string | null
  }> = []

  for (const t of tareas) {
    const proyectoNombre = proyectoNombreById.get(t.proyecto_id) ?? t.proyecto_id
    if (t.estado === 'Bloqueado' && bloqueadas.length < limit) {
      bloqueadas.push({
        proyecto_id: t.proyecto_id,
        proyecto_nombre: proyectoNombre,
        tarea_id: String(t._id),
        tarea_nombre: t.nombre,
        responsable: t.responsable ?? null,
      })
    }
    const fin = t.fecha_fin ? new Date(t.fecha_fin) : null
    if (t.estado !== 'Completado' && fin && fin < hoy && vencidas.length < limit) {
      vencidas.push({
        proyecto_id: t.proyecto_id,
        proyecto_nombre: proyectoNombre,
        tarea_id: String(t._id),
        tarea_nombre: t.nombre,
        responsable: t.responsable ?? null,
        fecha_fin: t.fecha_fin instanceof Date ? t.fecha_fin.toISOString() : null,
      })
    }
  }

  return { bloqueadas, vencidas }
}

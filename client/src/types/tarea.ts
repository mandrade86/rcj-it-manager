export type TareaEstado = 'Pendiente' | 'En progreso' | 'Completado' | 'Bloqueado'

export type TareaAdjunto = {
  _id: string
  nombre_original: string
  archivo: string
  mime_type?: string
  size_bytes?: number
  subido_por?: string
  subido_en?: string
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
  porcentaje: number
  eje?: string | null
  adjuntos?: TareaAdjunto[]
  /** Ids de tareas que deben completarse antes (predecesoras). */
  depende_de_ids?: string[]
  createdAt?: string
  updatedAt?: string
}

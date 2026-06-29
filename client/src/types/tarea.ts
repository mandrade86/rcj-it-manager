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

export type ReporteSemanalTarea = {
  _id: string
  nombre: string
  estado: TareaEstado
  porcentaje: number
  responsable?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  ultimo_comentario?: string | null
  tags?: string[]
}

export type ReporteSemanalProyecto = {
  proyecto_id: string
  proyecto_nombre: string
  eje?: string | null
  estado_proyecto?: string
  avance_proyecto: number
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
    total_tareas: number
    completadas: number
    en_progreso: number
    pendientes: number
    bloqueadas: number
  }
  proyectos: ReporteSemanalProyecto[]
}

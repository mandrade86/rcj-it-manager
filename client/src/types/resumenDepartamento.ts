export type ResumenDepartamento = {
  departamento: {
    _id: string
    codigo: string
    nombre: string
    color?: string
  }
  metas: {
    id: string
    titulo: string
    objetivo: string
    valor_objetivo: string
    kpi_count: number
    avance_pct: number
    kpis: {
      _id: string
      nombre: string
      eje: string
      meta: string | null
      unidad: string | null
      avance_pct: number
      tiene_registro: boolean
    }[]
  }[]
  kpi_promedio_pct: number
  plan_trabajo: {
    proyectos_total: number
    proyectos_activos: number
    tareas_vencidas: number
    avance_por_fase: { fase: number; count: number; pct: number }[]
    proyectos: {
      _id: string
      nombre: string
      eje: string
      fase: number | null
      estado: string
      prioridad: string
      avance: number
      responsable: string | null
      fecha_inicio: string | null
      fecha_fin: string | null
      meta_kpi: string | null
    }[]
  }
  equipo: { total: number; activos: number }
  lectura_rapida: string
}

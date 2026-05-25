export type NivelCumplimientoKpi = 'No cumple' | 'Parcial' | 'Cumple' | 'Supera'
export type DecisionKpi = 'Promover' | 'Continuar' | 'Plan de mejora' | 'Reconocer'
export type TipoEvaluacionKpi = 'autoevaluacion' | 'jefe'

export type EvalKpiItem = {
  kpi_id: string
  kpi_nombre: string
  kpi_eje?: string
  kpi_meta?: string
  kpi_unidad?: string
  peso: number
  valor_observado: number | null
  cumplimiento_pct: number
  comentario?: string
}

export type EvaluacionKpiDoc = {
  _id: string
  colaborador_id: string
  perfil_puesto_id?: string | null
  tipo: TipoEvaluacionKpi
  fecha: string
  periodo?: string
  evaluado_por?: string
  items: EvalKpiItem[]
  score_global: number
  nivel_cumplimiento: NivelCumplimientoKpi
  decision: DecisionKpi
  comentarios?: string
  firmas: {
    colaborador: boolean
    coordinador: boolean
    jefe: boolean
    rrhh: boolean
  }
  createdAt?: string
  updatedAt?: string
}

export type EvaluacionKpiTemplate = {
  colaborador: {
    _id: string
    nombre: string
    puesto?: string
    codigo_puesto?: string
  }
  perfil: {
    _id: string
    codigo: string
    titulo: string
  }
  items: {
    kpi_id: string
    kpi_nombre: string
    kpi_eje: string
    kpi_meta: string
    kpi_unidad: string
    kpi_frecuencia: string
    kpi_descripcion: string
    descripcion?: string
    peso: number
    ultimo_valor: number | null
    ultimo_fecha: string | null
    valor_observado_sugerido: number | null
    cumplimiento_sugerido: number
    comentario: string
  }[]
  total_peso: number
  score_sugerido: number
  nivel_sugerido: NivelCumplimientoKpi
}

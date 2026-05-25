export type TipoEvaluacion = 'autoevaluacion' | 'jefe'

export type CalificacionRubrica = 'No cumple' | 'En desarrollo' | 'Cumple' | 'Supera'

export type CriterioEvaluacion = {
  categoria: string
  criterio: string
  calificacion?: CalificacionRubrica | null
  comentario?: string
  accion_mejora?: string
}

export type FirmasEvaluacion = {
  colaborador: boolean
  coordinador: boolean
  jefe: boolean
  rrhh: boolean
}

export type NivelEvaluacion = 'Junior' | 'Mid-Senior' | 'Senior'
export type DecisionEvaluacion = 'Promover' | 'Continuar' | 'Plan de mejora'

export type EvaluacionDoc = {
  _id: string
  colaborador_id: string
  tipo: TipoEvaluacion
  fecha: string
  evaluado_por?: string | null
  nivel_actual?: NivelEvaluacion | null
  resultado_global: CalificacionRubrica
  decision?: DecisionEvaluacion | null
  criterios: CriterioEvaluacion[]
  comentarios?: string | null
  firmas: FirmasEvaluacion
  createdAt?: string
  updatedAt?: string
}

export type RubricaTemplateItem = {
  categoria: string
  criterio: string
  /** Descripción opcional con las expectativas para considerar el criterio cumplido. */
  descripcion?: string
}

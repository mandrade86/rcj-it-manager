import type { MetaEstrategicaId } from '@/types/kpi'

export type MetaEstrategicaDepto = {
  id: MetaEstrategicaId | string
  titulo: string
  objetivo: string
  valor_objetivo?: string
  /** Agregación del avance de KPIs (promedio_kpis | min_kpis | max_kpis). */
  tipo_calculo?: string | null
  activa?: boolean
}

export type DepartamentoDoc = {
  _id: string
  codigo: string
  nombre: string
  descripcion?: string
  color?: string
  /** ID departamento EHR (Depto #). */
  ehr_departamento_id?: number | null
  ehr_empresa_id?: number | null
  empresa_id?: string | { _id: string; nombre: string; codigo?: string; ehr_empresa_id?: number } | null
  ejes_proyecto?: string[]
  /** Si el departamento maneja presupuesto/gastos (controla la visibilidad del módulo Gastos). */
  lleva_gastos?: boolean
  /** Ruta relativa del archivo Excel con los gastos del departamento. */
  archivo_gastos?: string
  activo?: boolean
  metas_estrategicas?: MetaEstrategicaDepto[]
  createdAt?: string
  updatedAt?: string
}

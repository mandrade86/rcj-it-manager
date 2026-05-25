export type MetaDoc = {
  id: string
  titulo: string
  objetivo: string
  valor_objetivo: string
  tipo_calculo: string
  activa: boolean
  departamento_id: string
  departamento_codigo: string
  departamento_nombre: string
  kpi_count: number
}

export type MetaFormBody = {
  departamento_id: string
  id?: string
  titulo: string
  objetivo: string
  valor_objetivo: string
  tipo_calculo: string
  activa: boolean
}

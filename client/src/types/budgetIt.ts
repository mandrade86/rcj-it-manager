export type MonedaEmpresa = 'USD' | 'HNL'

export type BudgetItSapDashboardEmpresa = {
  empresa: string
  moneda: MonedaEmpresa
  planificado: number
  ejecutado: number
  variacion: number
  ejecucion_pct: number | null
  filas_sobre_presupuesto: number
}

export type BudgetItSapDashboardMes = {
  mes: number
  mes_label: string
  planificado: number
  ejecutado: number
  variacion: number
}

export type BudgetItSapDashboardEmpresaMes = {
  empresa: string
  mes: number
  mes_label: string
  planificado: number
  ejecutado: number
}

export type BudgetItSapDashboardSobre = {
  label: string
  empresa: string | null
  planificado: number
  ejecutado: number
  variacion: number
}

export type BudgetItSapDashboardCuenta = {
  cuenta: string
  cuenta_nombre: string
  empresa: string
  moneda: MonedaEmpresa
  planificado: number
  ejecutado: number
  variacion: number
  ejecucion_pct: number | null
  transacciones: number
}

export type BudgetItSap = {
  moneda: MonedaEmpresa | null
  vista: string
  columnas: string[]
  filas: Record<string, unknown>[]
  total_filas: number
  empresas: string[]
  monedas_empresa: Record<string, MonedaEmpresa>
  requiere_empresa: boolean
  filtros: {
    anio: number | null
    mes: number | null
    busqueda: string | null
    empresa: string | null
  }
  resumen: {
    total_presupuesto: number | null
    columna_monto: string | null
    columna_empresa: string | null
    columna_planificado: string | null
    columna_ejecutado: string | null
    columna_cuenta: string | null
    columna_cuenta_nombre?: string | null
    pares_mensuales?: Array<{
      mes: number
      mes_label: string
      col_planificado: string
      col_ejecutado: string
    }>
    total_planificado: number | null
    total_ejecutado: number | null
    variacion: number | null
    ejecucion_pct: number | null
    filas_sobre_presupuesto: number
  }
  dashboard: {
    por_empresa: BudgetItSapDashboardEmpresa[]
    por_mes: BudgetItSapDashboardMes[]
    por_empresa_mes: BudgetItSapDashboardEmpresaMes[]
    por_cuenta: BudgetItSapDashboardCuenta[]
    top_sobre_presupuesto: BudgetItSapDashboardSobre[]
  }
  ultimo_sync: string
  aviso?: string | null
}

export type GastoCuentaDetalle = {
  fecha: string | null
  empresa: string
  proveedor: string
  descripcion: string
  documento: string
  cuenta: string
  cuenta_nombre: string
  monto: number
  moneda: MonedaEmpresa
}

export type GastosPorCuentaResponse = {
  empresa: string
  cuenta: string
  moneda: MonedaEmpresa
  total: number
  gastos: GastoCuentaDetalle[]
}

export type CostosItFieldMap = {
  fecha?: string
  monto?: string
  descripcion?: string
  proveedor?: string
  documento?: string
  cuenta?: string
  empresa?: string
  categoria_origen?: string
  departamento?: string
  tipo?: string
}

export type CostosItConfig = {
  viewName: string
  schema?: string
  fields: CostosItFieldMap
  ultimo_sync?: string | null
  categorias?: string[]
}

export type CostosItFila = {
  row_hash: string
  fecha: string | null
  anio: number | null
  monto: number
  descripcion: string
  proveedor: string
  documento: string
  cuenta: string
  empresa: string
  categoria_origen: string
  departamento: string
  tipo: string
  categoria: string
  fuente_categoria: 'regla' | 'ia' | 'vista' | 'manual' | 'pendiente'
  confianza: number
}

export type CostosItComparacionAnual = {
  anio_base: number
  anio_comp: number
  total_base: number
  total_comp: number
  variacion_usd: number
  variacion_pct: number
  por_categoria: Array<{
    categoria: string
    monto_base: number
    monto_comp: number
    variacion_usd: number
    variacion_pct: number
  }>
}

export type CostosItDashboard = {
  moneda: 'USD'
  resumen: {
    total: number
    transacciones: number
    promedio: number
    periodo_desde: string | null
    periodo_hasta: string | null
    anio_base: number
    anio_comp: number
    empresa_filtro: string | null
    categoria_filtro: string | null
  }
  empresas: string[]
  categorias_disponibles: string[]
  por_categoria: Array<{ categoria: string; monto: number; pct: number; transacciones: number }>
  por_mes: Array<{ mes: string; monto: number; transacciones: number }>
  evolucion_mensual: Array<{ mes: string; mes_label: string; monto_base: number; monto_comp: number }>
  por_anio: Array<{ anio: number; monto: number; transacciones: number }>
  por_categoria_anio: Array<{ anio: number; categoria: string; monto: number; transacciones: number }>
  comparacion: CostosItComparacionAnual
  top_proveedores: Array<{ proveedor: string; monto: number; transacciones: number }>
  filas: CostosItFila[]
  categorizacion: {
    reglas: number
    ia: number
    vista: number
    manual: number
    pendiente: number
  }
  vista: string
  campos_mapeados: CostosItFieldMap
  ultimo_sync: string | null
  aviso?: string | null
}

export type CostosItAnalisisCategoria = {
  moneda: 'USD'
  filtros: {
    empresa: string | null
    anio: number
    mes: number | null
    categoria: string | null
  }
  empresas: string[]
  anios_disponibles: number[]
  categorias: string[]
  resumen: {
    total: number
    transacciones: number
    promedio: number
    periodo_desde: string | null
    periodo_hasta: string | null
  }
  por_categoria: Array<{ categoria: string; monto: number; pct: number; transacciones: number }>
  por_empresa: Array<{ empresa: string; monto: number; pct: number; transacciones: number }>
  por_mes: Array<{ mes: number; mes_label: string; monto: number; transacciones: number }>
  por_categoria_empresa: Array<{
    empresa: string
    categoria: string
    monto: number
    transacciones: number
  }>
  filas: CostosItFila[]
  vista: string
  ultimo_sync: string | null
  aviso?: string | null
}

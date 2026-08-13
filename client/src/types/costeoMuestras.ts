export type SapBiColumnMapping = {
  cliente: string
  codigo_cliente?: string
  muestra?: string
  descripcion?: string
  costo: string
  cantidad?: string
  fecha?: string
  moneda?: string
}

export type SapBiCosteoConfig = {
  driver: 'mssql' | 'hana'
  host: string
  port: number
  database: string
  schema: string
  viewName: string
  username: string
  hasPassword: boolean
  configured: boolean
  encrypt: boolean
  trustServerCertificate: boolean
  columnMapping: SapBiColumnMapping
  ultimo_sync?: string | null
}

export type CosteoPorCliente = {
  cliente: string
  codigo_cliente: string
  costo: number
  cantidad_muestras: number
  registros: number
}

export type CosteoMuestraDetalle = {
  cliente: string
  codigo_cliente: string
  muestra: string
  descripcion: string
  costo: number
  cantidad: number
  fecha: string | null
  moneda: string
}

export type CosteoMuestrasPayload = {
  resumen: {
    total_costo: number
    total_muestras: number
    total_clientes: number
    total_registros: number
    moneda: string
  }
  por_cliente: CosteoPorCliente[]
  detalle: CosteoMuestraDetalle[]
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
}

export type CosteoUltimoSync = {
  fecha: string | null
  vista: string
  configured: boolean
}

export type VentaMargenRow = {
  empresa: string
  fecha: string | null
  periodo: string
  codigo_cliente: string
  cliente: string
  grupo_cliente: string
  receta_code: string
  receta_nombre: string
  cantidad: number
  venta: number
  costo: number
  margen: number
  factura?: string
  orden_produccion?: string
}

export type VentaMargenPayload = {
  resumen: {
    total_venta: number
    total_costo: number
    total_margen: number
    total_registros: number
    margen_pct: number
  }
  detalle: VentaMargenRow[]
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
}

export type RecetaCostoRow = {
  receta_code: string
  receta_nombre: string
  costo: number
  costo_unitario: number
  flag_costo: string
  cantidad: number
}

export type RecetaCostoPayload = {
  resumen: {
    total_recetas: number
    costo_promedio: number
    costo_max: number
    costo_min: number
  }
  detalle: RecetaCostoRow[]
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
}

export type RecetaCatalogoItem = {
  receta_code: string
  receta_nombre: string
  costo: number
  flag_costo: string
}

export type IngredienteRow = {
  componente_code: string
  componente_nombre: string
  cantidad: number
  unidad: string
  costo_unitario: number
  costo_teorico: number
  pct_costo: number
}

export type RecetaDetallePayload = {
  receta: RecetaCatalogoItem
  ingredientes: IngredienteRow[]
  resumen: {
    total_ingredientes: number
    costo_total: number
    costo_promedio_ingrediente: number
  }
  vista: string
}

export type RecetaCatalogoPayload = {
  catalogo: RecetaCatalogoItem[]
  total: number
}

export type RecetaMatrizItem = {
  receta_code: string
  receta_nombre: string
  total_ingredientes: number
  costo_total: number
  flag_costo: string
  ingredientes: IngredienteRow[]
  cantidad_producida: number
  costo_produccion: number
  costo_teorico_prod: number
  variacion: number
  variacion_pct: number
  ordenes: number
  produccion_detalle: ProduccionLinea[]
}

export type ProduccionLinea = {
  fecha: string | null
  periodo: string
  orden: string
  cantidad: number
  costo: number
  almacen: string
  estado: string
  receta_code: string
  receta_nombre: string
}

export type RecetasMatrizPayload = {
  recetas: RecetaMatrizItem[]
  total_recetas: number
  vista: string
  vista_produccion?: string
  campos_mapeados?: Record<string, string>
  campos_produccion?: Record<string, string>
  cantidad_derivada?: boolean
  produccion_ok?: boolean
  produccion_error?: string | null
  resumen_produccion?: {
    total_costo_teorico: number
    total_costo_produccion: number
    total_variacion: number
    variacion_pct: number
    total_cantidad_producida: number
    recetas_con_produccion: number
  }
}

export type VentaAnalisisRow = VentaMargenRow & {
  costo_teorico_unit: number
  costo_teorico: number
  variacion: number
  variacion_pct: number
  margen_pct: number
}

export type VentaOpRelacion = {
  factura: string
  fecha_venta: string | null
  periodo: string
  codigo_cliente: string
  cliente: string
  receta_code: string
  receta_nombre: string
  cantidad_venta: number
  venta: number
  costo_venta: number
  orden_produccion: string
  fecha_op: string | null
  cantidad_op: number
  costo_op: number
  almacen: string
  estado_op: string
  match: 'orden' | 'receta_periodo' | 'receta' | 'sin_op'
}

export type VentaPorReceta = {
  receta_code: string
  receta_nombre: string
  cantidad: number
  venta: number
  costo_produccion: number
  costo_teorico: number
  variacion: number
  variacion_pct: number
  margen: number
  margen_pct: number
  registros: number
}

export type VentaAnalisisPayload = {
  resumen: {
    total_venta: number
    total_costo: number
    total_margen: number
    total_registros: number
    margen_pct: number
    total_costo_teorico: number
    total_variacion: number
    variacion_pct: number
  }
  por_receta: VentaPorReceta[]
  detalle: VentaAnalisisRow[]
  ingredientes_por_receta?: Record<string, IngredienteRow[]>
  produccion_por_receta?: Record<string, ProduccionLinea[]>
  relacion_venta_op?: VentaOpRelacion[]
  campos_venta?: Record<string, string>
  produccion_ok?: boolean
  produccion_error?: string | null
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
  detalle_truncado?: boolean
  aviso?: string | null
}

export type ClienteCatalogoItem = {
  codigo_cliente: string
  cliente: string
  venta_total: number
  margen_total: number
  registros: number
}

export type RecetaVentaCatalogoItem = {
  receta_code: string
  receta_nombre: string
  venta_total: number
  registros: number
}

export type VentaCatalogoPayload = {
  clientes: ClienteCatalogoItem[]
  recetas: RecetaVentaCatalogoItem[]
}

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
  componente_code?: string
  componente_nombre?: string
  unidad?: string
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
  /** Qty vendida (líneas de factura). */
  cantidad: number
  /** Qty producida (cabeceras OP de la receta). */
  qty_producida: number
  var_qty: number
  var_qty_pct: number
  venta: number
  costo_produccion: number
  costo_teorico: number
  variacion: number
  variacion_pct: number
  margen: number
  margen_pct: number
  registros: number
  /** Costo real de las OP (cabeceras). Si 0, usar costo_produccion de venta. */
  costo_op: number
  ordenes: number
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
    total_qty_vendida: number
    total_qty_producida: number
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

export type OpVsRecetaIngrediente = {
  componente_code: string
  componente_nombre: string
  unidad: string
  qty_por_unidad: number
  costo_unitario: number
  qty_teorica: number
  costo_teorico: number
  qty_plan?: number | null
  costo_plan?: number | null
  /** Precio unitario en Real (mismo que BOM o derivado). */
  precio_real?: number | null
  qty_real: number | null
  /** precio_real × qty_real */
  costo_real: number | null
  var_qty: number | null
  var_qty_pct: number | null
  var_costo: number | null
  var_costo_pct: number | null
  /** Ingrediente en receta sin par en OP, o componente OP que no está en la receta. */
  alerta_receta?: 'falta_en_op' | 'extra_en_op' | null
}

export type ProduccionOrdenDetalle = {
  orden: string
  orden_id?: string
  receta_code: string
  receta_nombre: string
  fecha: string | null
  estado: string
  almacen: string
  cantidad: number
  costo: number
  costo_teorico: number
  var_costo: number
  var_costo_pct: number
  costo_unitario_bom: number
  lineas: ProduccionLinea[]
  ingredientes: OpVsRecetaIngrediente[]
  tiene_consumo_real: boolean
  /** Componentes BOM con qty real registrada. */
  ingredientes_con_consumo?: number
  ingredientes_bom?: number
  /** Filas con código distinto entre receta y OP. */
  ingredientes_alerta_receta?: number
  /** BOM desde VW_BI_RECETA_COSTO (puede diferir de WOR1). */
  bom_maestro?: IngredienteRow[]
  /** BOM reconstruido desde WOR1 (pestaña Contenido SAP). */
  bom_op?: IngredienteRow[]
  receta_fuente?: 'maestro' | 'op_wor1'
  aviso_bom?: string | null
  aviso: string | null
  ultimo_sync?: string | null
  vista?: string
}

export type OpVsRecetaOrden = {
  orden: string
  orden_id?: string
  fecha: string | null
  /** Cantidad producida (real OP). */
  cantidad: number
  /** Costo real de la OP. */
  costo: number
  /** Costo BOM × cantidad producida. */
  costo_teorico: number
  var_costo: number
  var_costo_pct: number
  estado: string
  /** Ingredientes de la receta escalados a la qty de esta OP. */
  ingredientes: OpVsRecetaIngrediente[]
}

export type OpVsRecetaMuestra = {
  receta_code: string
  receta_nombre: string
  qty_vendida: number
  venta_total: number
  qty_producida: number
  costo_op: number
  costo_teorico: number
  var_costo: number
  var_costo_pct: number
  var_qty: number
  var_qty_pct: number
  /** Costo BOM por 1 unidad de receta. */
  costo_unitario_bom: number
  ordenes: OpVsRecetaOrden[]
  ingredientes: OpVsRecetaIngrediente[]
  tiene_consumo_real: boolean
}

export type OpVsRecetaPayload = {
  resumen: {
    muestras: number
    con_produccion: number
    sin_produccion: number
    con_consumo_real: number
    qty_vendida: number
    qty_producida: number
    costo_teorico: number
    costo_op: number
    var_costo: number
    var_costo_pct: number
  }
  muestras: OpVsRecetaMuestra[]
  cliente: { codigo_cliente: string; cliente: string }
  campos_produccion?: Record<string, string>
  tiene_consumo_real: boolean
  produccion_ok?: boolean
  produccion_error?: string | null
  ultimo_sync: string | null
  vista: string
  aviso?: string | null
}

export type EnlaceFacturaDetalle = VentaOpRelacion & {
  costo_teorico: number
  costo_teorico_unit: number
  variacion_op_vs_teorico: number
  variacion_op_vs_teorico_pct: number
}

export type EnlaceFacturaGrupo = {
  factura: string
  fecha: string | null
  periodo: string
  codigo_cliente: string
  cliente: string
  lineas_venta: number
  venta_total: number
  costo_venta_total: number
  costo_teorico_total: number
  costo_op_total: number
  variacion_op_vs_teorico: number
  variacion_op_vs_teorico_pct: number
  cantidad_venta: number
  cantidad_op: number
  ordenes: string[]
  match_mejor: 'orden' | 'receta_periodo' | 'receta' | 'sin_op'
  detalle: EnlaceFacturaDetalle[]
}

export type EnlaceFacturaPayload = {
  resumen: {
    facturas: number
    con_op: number
    sin_op: number
    por_orden: number
    por_receta: number
    venta_total: number
    costo_venta_total: number
    costo_teorico_total: number
    costo_op_total: number
    variacion_op_vs_teorico: number
    variacion_op_vs_teorico_pct: number
    lineas: number
  }
  facturas: EnlaceFacturaGrupo[]
  campos_venta?: Record<string, string>
  tiene_factura: boolean
  tiene_orden_venta: boolean
  produccion_ok?: boolean
  produccion_error?: string | null
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
  aviso?: string | null
}

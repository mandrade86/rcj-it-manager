import { findColumnByPatterns, findColumnInList } from './sapBiColumnDetect.js'
import type { SapBiCosteoConfig } from './sapBiCosteoConfig.js'
import { listViewColumns } from './sapBiQuery.js'

/** Vistas fijas RCJ_BI por pestaña del módulo BI. */
export const VISTA_VENTA_COSTO = 'VW_BI_VENTA_COSTO'
/** Preferida: ventas + Factura + OrdenProd (Opción A). */
export const VISTA_VENTA_COSTO_OP = 'VW_BI_VENTA_COSTO_OP'
export const VENTA_VISTAS_CANDIDATAS = [VISTA_VENTA_COSTO_OP, VISTA_VENTA_COSTO] as const
export const VISTA_RECETA_COSTO = 'VW_BI_RECETA_COSTO'
export const VISTA_RECETAS_EXPLOSION = 'VW_BI_RECETAS_EXPLOSION'
export const VISTA_RECETAS = 'VW_BI_RECETAS'
export const VISTA_PRODUCCION = 'VW_BI_PRODUCCION'
/** Preferida: 1 fila por componente de OP (WOR1 plan + IssuedQty). */
export const VISTA_PRODUCCION_DETALLE_QTY = 'VW_BI_PRODUCCION_DETALLE_QTY'
/** Fallback: consumo por emisiones / movimientos. */
export const VISTA_CONSUMO_REAL_PRODUCCION = 'VW_BI_CONSUMO_REAL_PRODUCCION'

export const CONSUMO_VISTAS_CANDIDATAS = [
  VISTA_PRODUCCION_DETALLE_QTY,
  VISTA_CONSUMO_REAL_PRODUCCION,
] as const

/** alias lógico → columna en VW_BI_VENTA_COSTO */
export const CAMPOS_VENTA_COSTO: Record<string, string> = {
  empresa: 'Empresa',
  fecha: 'Fecha',
  periodo: 'Periodo',
  codigo_cliente: 'CardCode',
  cliente: 'CardName',
  grupo_cliente: 'GrupoCliente',
  receta_code: 'RecetaCode',
  receta_nombre: 'RecetaNombre',
  cantidad: 'Cantidad',
  venta: 'Venta',
  costo: 'CostoReal',
  margen: 'Margen',
}

/** Columnas opcionales de validación (factura / OP) si existen en la vista. */
export const VENTA_COSTO_OPTIONAL_CANDIDATES: Record<string, string[]> = {
  factura: [
    'Factura', 'NumFactura', 'NumeroFactura', 'NoFactura', 'DocNum', 'DocNumInv',
    'InvoiceNum', 'InvoiceNo', 'Folio', 'FolioFactura', 'NumDoc', 'DocumentNumber',
  ],
  orden_produccion: [
    'OrdenProd', 'OrdenProduccion', 'Orden', 'ProductionOrder', 'WONum', 'BaseRef',
    'OriginNum', 'DocNumOP', 'OP', 'OrdenFab', 'NumOrdenProd', 'BaseEntry',
  ],
}

export function suggestVentaCostoFields(columns: string[]): Record<string, string> {
  const fields: Record<string, string> = { ...CAMPOS_VENTA_COSTO }
  // Solo conservar columnas base que existan en la vista (evita invalid column)
  const index = new Map(columns.map((c) => [c.toLowerCase(), c]))
  for (const [alias, col] of Object.entries(fields)) {
    const hit = index.get(col.toLowerCase())
    if (hit) fields[alias] = hit
    else delete fields[alias]
  }
  // Requeridos mínimos
  for (const required of ['receta_code', 'venta', 'costo'] as const) {
    if (!fields[required]) {
      // intentar recovery por nombre similar
      if (required === 'receta_code') {
        const alt = findColumnInList(columns, ['RecetaCode', 'ItemCode', 'CodReceta'])
        if (alt) fields.receta_code = alt
      }
      if (required === 'venta') {
        const alt = findColumnInList(columns, ['Venta', 'LineTotal', 'DocTotal', 'Sales'])
        if (alt) fields.venta = alt
      }
      if (required === 'costo') {
        const alt = findColumnInList(columns, ['CostoReal', 'Costo', 'CostoTotal'])
        if (alt) fields.costo = alt
      }
    }
  }

  const used = new Set(Object.values(fields))
  for (const [alias, candidates] of Object.entries(VENTA_COSTO_OPTIONAL_CANDIDATES)) {
    if (fields[alias]) continue
    const col = findColumnInList(columns, candidates)
    if (col && !used.has(col)) {
      fields[alias] = col
      used.add(col)
    }
  }
  // Heurísticas si no hay match exacto
  if (!fields.factura) {
    const col = findColumnByPatterns(
      columns,
      [/factura/i, /invoice/i, /^folio$/i, /^docnum$/i],
      used,
    )
    if (col) {
      fields.factura = col
      used.add(col)
    }
  }
  if (!fields.orden_produccion) {
    const col = findColumnByPatterns(
      columns,
      [/orden.?prod/i, /production.?order/i, /^op$/i, /wo.?num/i, /base.?ref/i],
      used,
    )
    if (col) fields.orden_produccion = col
  }

  if (!fields.receta_code || !fields.costo) {
    throw new Error(
      `No se detectaron columnas mínimas en ${VISTA_VENTA_COSTO}. `
      + `Columnas: ${columns.join(', ')}`,
    )
  }
  return fields
}

let cachedVentaFields: Record<string, string> | null = null
let cachedVentaVista: string | null = null
let cachedVentaKey = ''

export function clearVentaCostoFieldsCache(): void {
  cachedVentaFields = null
  cachedVentaVista = null
  cachedVentaKey = ''
}

export type VentaCostoSource = {
  vista: string
  fields: Record<string, string>
}

/** Prefiere VW_BI_VENTA_COSTO_OP (con OrdenProd); fallback VW_BI_VENTA_COSTO. */
export async function getVentaCostoSource(cfg: SapBiCosteoConfig): Promise<VentaCostoSource> {
  const key = `${cfg.host}:${cfg.port}:${cfg.schema}:venta`
  if (cachedVentaFields && cachedVentaVista && cachedVentaKey === key) {
    return { vista: cachedVentaVista, fields: cachedVentaFields }
  }

  let best: VentaCostoSource | null = null
  for (const vista of VENTA_VISTAS_CANDIDATAS) {
    try {
      const columnas = await listViewColumns(cfg, vista)
      if (!columnas.length) continue
      const fields = suggestVentaCostoFields(columnas)
      const src = { vista, fields }
      if (fields.orden_produccion) {
        cachedVentaFields = fields
        cachedVentaVista = vista
        cachedVentaKey = key
        return src
      }
      if (!best) best = src
    } catch {
      // probar siguiente
    }
  }
  if (best) {
    cachedVentaFields = best.fields
    cachedVentaVista = best.vista
    cachedVentaKey = key
    return best
  }

  const fields = { ...CAMPOS_VENTA_COSTO }
  cachedVentaFields = fields
  cachedVentaVista = VISTA_VENTA_COSTO
  cachedVentaKey = key
  return { vista: VISTA_VENTA_COSTO, fields }
}

export async function getVentaCostoFields(cfg: SapBiCosteoConfig): Promise<Record<string, string>> {
  const src = await getVentaCostoSource(cfg)
  return src.fields
}

/** Candidatos por alias lógico en VW_BI_RECETA_COSTO (nombres distintos a VW_BI_VENTA_COSTO). */
export const RECETA_COSTO_CANDIDATES: Record<string, string[]> = {
  receta_code: ['RecetaCode', 'ItemCode', 'CodReceta', 'CodArticulo', 'CodProducto', 'Cod_Receta'],
  receta_nombre: ['ItemName', 'Descripcion', 'NombreReceta', 'NomReceta', 'RecetaNombre', 'DescReceta'],
  costo: ['CostoLinea', 'CostoTeorico', 'Costo', 'CostoTotal', 'CostoReal'],
  costo_unitario: ['CostoUnitario', 'CostoUnit', 'PrecioUnit', 'UnitCost', 'AvgPrice', 'AvgPrice1'],
  flag_costo: ['FlagCosto', 'Flag_Costo', 'EstadoCosto'],
  cantidad: [
    'CantidadPorUnidad', 'Cantidad_Por_Unidad', 'QtyPerUnit', 'QtyPerUom', 'QuantityPerUnit',
    'NumPerMsr', 'Quantity', 'Cantidad', 'Qty', 'Qntty',
    'CantidadBom', 'CantBom', 'CantComp', 'CantidadComp', 'CompQty', 'QtyPer', 'QuantityPer',
    'CantidadBaseBom', 'InvQty', 'CantidadLinea', 'CantLinea', 'QtyLinea', 'LineQty',
    'CantidadInsumo', 'QtyInsumo', 'CantidadUM', 'BaseNum', 'Factor',
    'QuantityBOM',
    /* No usar campos de OP/emisión como cantidad BOM: BaseQty, PlannedQty, IssuedQty */
  ],
  unidad: [
    'Unidad', 'UnidadMedida', 'Uom', 'UoM', 'UOM', 'UomCode', 'UomName', 'NomUom',
    'InvntryUom', 'InventryUom', 'BuyUnitMsr', 'SalUnitMsr', 'UnitMsr', 'UomComp',
  ],
  componente_code: [
    'ComponenteCode', 'CompCode', 'CodComponente', 'CodigoComponente', 'CompItemCode',
    'ItemCodeComp', 'ItemCodeHijo', 'ChildCode', 'InsumoCode', 'CodInsumo', 'Code',
  ],
  componente_nombre: [
    'ComponenteNombre', 'NomComponente', 'NombreComponente', 'CompItemName',
    'ItemNameComp', 'DescripcionComponente', 'NombreInsumo', 'DescComponente',
  ],
}

/** Fallback estático si aún no se detectaron columnas. */
export const CAMPOS_RECETA_COSTO: Record<string, string> = {
  receta_code: 'RecetaCode',
  receta_nombre: 'ItemName',
  costo: 'CostoLinea',
  costo_unitario: 'CostoUnitario',
  flag_costo: 'FlagCosto',
  cantidad: 'CantidadPorUnidad',
  unidad: 'UnidadMedida',
  componente_code: 'ComponenteCode',
  componente_nombre: 'ComponenteNombre',
}

const RECETA_CANTIDAD_PATTERNS = [
  /cantidad.?por.?unidad/i,
  /qty.?per.?u(nit|om)/i,
  /^cantidad$/i,
  /cantidad/i,
  /^qty$/i,
  /^qntty$/i,
  /base.?qty/i,
  /quantity/i,
  /cant.?comp/i,
  /comp.?qty/i,
  /cant.?linea/i,
  /line.?qty/i,
  /num.?per.?msr/i,
  /^factor$/i,
  /^cant$/i,
]
const RECETA_UNIDAD_PATTERNS = [
  /^unidad/i, /^uom/i, /invntry.?uom/i, /inventry.?uom/i, /unit.?msr/i, /unidad.?medida/i,
]

export function suggestRecetaCostoFields(columns: string[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [alias, candidates] of Object.entries(RECETA_COSTO_CANDIDATES)) {
    const col = findColumnInList(columns, candidates)
    if (col) fields[alias] = col
  }

  const used = new Set(Object.values(fields))
  if (!fields.cantidad) {
    const col = findColumnByPatterns(columns, RECETA_CANTIDAD_PATTERNS, used)
    if (col) {
      fields.cantidad = col
      used.add(col)
    }
  }
  if (!fields.unidad) {
    const col = findColumnByPatterns(columns, RECETA_UNIDAD_PATTERNS, used)
    if (col) fields.unidad = col
  }

  // Si no hay columna de cantidad pero sí costo de línea + unitario, se derivará en el mapeo.
  // Preferir CostoLinea como costo total de línea cuando exista (más fiable que un total genérico).
  if (!fields.cantidad) {
    const costoLinea = findColumnInList(columns, ['CostoLinea', 'LineCost', 'LineTotal', 'CostoTotalLinea'])
    if (costoLinea) fields.costo = costoLinea
  }

  if (!fields.receta_code && !fields.costo) {
    throw new Error(
      `No se detectaron columnas de receta/costo en ${VISTA_RECETA_COSTO}. `
      + `Columnas disponibles: ${columns.join(', ')}`,
    )
  }
  return fields
}

let cachedRecetaFields: Record<string, string> | null = null
let cachedRecetaFieldsKey = ''

export function clearRecetaCostoFieldsCache(): void {
  cachedRecetaFields = null
  cachedRecetaFieldsKey = ''
}

/** Candidatos para explosión BOM / ingredientes. */
export const EXPLOSION_CANDIDATES: Record<string, string[]> = {
  receta_code: [
    'RecetaCode', 'CodReceta', 'CodigoReceta', 'CODRECETA', 'ItemCodePadre', 'ItemCodeReceta',
    'FatherCode', 'ParentItem', 'ParentCode', 'ParentItemCode', 'CodigoPadre', 'ArticuloPadre',
    'ProductoCode', 'TreeCode', 'CodigoRecetaPadre', 'Receta', 'Articulo', 'Producto',
  ],
  receta_nombre: [
    'RecetaNombre', 'NomReceta', 'NombreReceta', 'ItemNamePadre', 'DescripcionReceta', 'RecetaDesc',
  ],
  componente_code: [
    'ComponenteCode', 'CodComponente', 'CodigoComponente', 'CompCode', 'ItemCodeComp',
    'ItemCodeHijo', 'ChildCode', 'ChildItem', 'ChildItemCode', 'CodigoHijo', 'ArticuloHijo',
    'CompItemCode', 'LineItemCode', 'InsumoCode', 'ComponenteItemCode', 'Code', 'Componente',
    'Insumo', 'Material', 'CompItem', 'ItemCodeComponente',
  ],
  componente_nombre: [
    'ComponenteNombre', 'NomComponente', 'NombreComponente', 'ItemNameComp', 'ItemNameHijo',
    'DescripcionComponente', 'CompItemName', 'NombreInsumo', 'DescComponente', 'ItemName', 'Descripcion',
  ],
  cantidad: [
    'CantidadPorUnidad', 'Cantidad_Por_Unidad', 'QtyPerUnit', 'QtyPerUom',
    'Cantidad', 'Quantity', 'Qty', 'Cant', 'Qntty', 'BaseQty', 'InvQty',
  ],
  costo_unitario: [
    'CostoUnitario', 'UnitCost', 'PrecioUnit', 'CostoUnit', 'Price', 'StockPrice', 'LastPurPrc',
  ],
  costo_linea: [
    'CostoLinea', 'LineCost', 'CostoTotal', 'Costo', 'CostoLineaTotal', 'LineTotal', 'TotalCost',
  ],
  nivel: ['Nivel', 'Level', 'NivelBOM', 'BOMLevel', 'Depth', 'Stage'],
}

const RECETA_CODE_PATTERNS = [
  /receta.*code/i, /^cod.*receta/i, /padre/i, /parent/i, /father/i, /treecode/i, /^producto$/i, /^articulo$/i,
]
const COMPONENTE_CODE_PATTERNS = [
  /componente/i, /comp.*code/i, /cod.*comp/i, /hijo/i, /child/i, /insumo/i, /^material$/i, /compitem/i,
]
const COMPONENTE_NAME_PATTERNS = [
  /componente.*nom/i, /nom.*componente/i, /comp.*name/i, /desc.*comp/i, /nombre.*insumo/i,
]
const CANTIDAD_PATTERNS = [/cantidad/i, /quantity/i, /^qty$/i, /qntty/i]
const COSTO_UNIT_PATTERNS = [/costo.*unit/i, /unit.*cost/i, /precio.*unit/i, /price/i]
const COSTO_LINEA_PATTERNS = [/costo.*linea/i, /line.*cost/i, /costo.*total/i, /linetotal/i]
const NIVEL_PATTERNS = [/nivel/i, /^level$/i, /depth/i]

function applyExplosionHeuristics(columns: string[], fields: Record<string, string>): Record<string, string> {
  const used = new Set(Object.values(fields))
  const out = { ...fields }

  if (!out.receta_code) {
    out.receta_code = findColumnByPatterns(columns, RECETA_CODE_PATTERNS, used)
    if (out.receta_code) used.add(out.receta_code)
  }

  if (!out.componente_code) {
    out.componente_code = findColumnByPatterns(columns, COMPONENTE_CODE_PATTERNS, used)
    if (out.componente_code) used.add(out.componente_code)
  }

  if (!out.componente_nombre) {
    out.componente_nombre = findColumnByPatterns(columns, COMPONENTE_NAME_PATTERNS, used)
    if (out.componente_nombre) used.add(out.componente_nombre)
  }

  if (!out.cantidad) {
    out.cantidad = findColumnByPatterns(columns, CANTIDAD_PATTERNS, used)
  }
  if (!out.costo_unitario) {
    out.costo_unitario = findColumnByPatterns(columns, COSTO_UNIT_PATTERNS, used)
  }
  if (!out.costo_linea) {
    out.costo_linea = findColumnByPatterns(columns, COSTO_LINEA_PATTERNS, used)
  }
  if (!out.nivel) {
    out.nivel = findColumnByPatterns(columns, NIVEL_PATTERNS, used)
  }

  // BOM nivel 1: a veces solo hay ItemCode (padre) + otro código de línea
  if (!out.receta_code) {
    const itemCode = findColumnInList(columns, ['ItemCode', 'Codigo', 'Code'])
    if (itemCode) out.receta_code = itemCode
  }

  return out
}

export function suggestExplosionFields(columns: string[]): Record<string, string> {
  let fields: Record<string, string> = {}
  for (const [alias, candidates] of Object.entries(EXPLOSION_CANDIDATES)) {
    const col = findColumnInList(columns, candidates)
    if (col) fields[alias] = col
  }

  fields = applyExplosionHeuristics(columns, fields)

  const hasComponente = fields.componente_code || fields.componente_nombre
  if (!fields.receta_code || !hasComponente) {
    throw new Error(
      `No se detectaron columnas BOM (receta + componente). `
      + `Columnas en vista: ${columns.join(', ')}. `
      + `Mapeo parcial: ${Object.entries(fields).map(([k, v]) => `${k}→${v}`).join(', ') || 'ninguno'}.`,
    )
  }
  return fields
}

let cachedExplosionFields: Record<string, string> | null = null
let cachedExplosionKey = ''
let cachedExplosionView = VISTA_RECETAS_EXPLOSION

export function clearExplosionFieldsCache(): void {
  cachedExplosionFields = null
  cachedExplosionKey = ''
}

/** Resuelve mapeo BOM; intenta explosión multinivel y cae a BOM nivel 1. */
export async function getExplosionFields(cfg: SapBiCosteoConfig): Promise<{
  fields: Record<string, string>
  vista: string
}> {
  const key = `${cfg.host}:${cfg.port}:${cfg.schema}`
  if (cachedExplosionFields && cachedExplosionKey === key) {
    return { fields: cachedExplosionFields, vista: cachedExplosionView }
  }

  const errores: string[] = []

  for (const viewName of [VISTA_RECETAS_EXPLOSION, VISTA_RECETAS]) {
    try {
      const columnas = await listViewColumns(cfg, viewName)
      if (!columnas.length) {
        errores.push(`${viewName}: vista sin columnas (¿existe en ${cfg.schema}?)`)
        continue
      }
      const fields = suggestExplosionFields(columnas)
      cachedExplosionFields = fields
      cachedExplosionKey = key
      cachedExplosionView = viewName
      return { fields, vista: viewName }
    } catch (err) {
      errores.push(`${viewName}: ${(err as Error).message}`)
    }
  }

  throw new Error(
    `No se pudo mapear columnas en ${VISTA_RECETAS_EXPLOSION} ni ${VISTA_RECETAS}. `
    + errores.join(' | '),
  )
}

/** Resuelve mapeo real de VW_BI_RECETA_COSTO consultando SYS.VIEW_COLUMNS en HANA. */
export async function getRecetaCostoFields(cfg: SapBiCosteoConfig): Promise<Record<string, string>> {
  const key = `${cfg.host}:${cfg.port}:${cfg.schema}:${VISTA_RECETA_COSTO}`
  if (cachedRecetaFields && cachedRecetaFieldsKey === key) {
    return cachedRecetaFields
  }

  const columnas = await listViewColumns(cfg, VISTA_RECETA_COSTO)
  if (!columnas.length) {
    throw new Error(`No se pudieron leer columnas de ${VISTA_RECETA_COSTO}`)
  }

  const fields = suggestRecetaCostoFields(columnas)
  cachedRecetaFields = fields
  cachedRecetaFieldsKey = key
  return fields
}

/** Fuerza relectura del mapeo (útil tras cambios de vista o candidatos). */
export async function refreshRecetaCostoFields(cfg: SapBiCosteoConfig): Promise<{
  columnas: string[]
  campos: Record<string, string>
}> {
  clearRecetaCostoFieldsCache()
  const columnas = await listViewColumns(cfg, VISTA_RECETA_COSTO)
  const campos = suggestRecetaCostoFields(columnas)
  const key = `${cfg.host}:${cfg.port}:${cfg.schema}:${VISTA_RECETA_COSTO}`
  cachedRecetaFields = campos
  cachedRecetaFieldsKey = key
  return { columnas, campos }
}

/** Candidatos VW_BI_PRODUCCION (órdenes / costo real de fabricación). */
export const PRODUCCION_CANDIDATES: Record<string, string[]> = {
  receta_code: [
    'RecetaCode', 'ItemCode', 'CodReceta', 'CodigoReceta', 'CodArticulo', 'CodProducto',
    'ProductCode', 'Articulo', 'Producto', 'ItemCodePT',
  ],
  receta_nombre: [
    'RecetaNombre', 'ItemName', 'NombreReceta', 'NomReceta', 'Descripcion', 'ProductName',
    'ProductoTerminado',
  ],
  cantidad: [
    'CantProducida', 'CantidadProducida', 'CompletedQty', 'CmpltQty',
    'Cantidad', 'Qty', 'Quantity', 'CantidadBase', 'InvQty', 'CantPlanificada', 'PlannedQty',
  ],
  costo: [
    'CostoProduccion', 'CostoReal', 'Costo', 'CostoTotal', 'TotalCost', 'CostoLinea',
    'ProductionCost', 'RealCost', 'CostoUnitProducido',
  ],
  fecha: ['Fecha', 'DocDate', 'PostDate', 'FechaProd', 'FechaProduccion', 'DueDate', 'FechaContab'],
  /** Número de OP visible al usuario (DocNum). */
  orden: [
    'OrdenNum', 'DocNum', 'Orden', 'OrdenProd', 'OrdenProduccion', 'WONum', 'ProductionOrder',
    'OrdenFab', 'NumOrden',
  ],
  /** DocEntry interno para cruzar con consumo. */
  orden_id: ['OrdenId', 'DocEntry', 'AbsEntry'],
  almacen: ['Almacen', 'WhsCode', 'Warehouse', 'CodAlmacen', 'WarehouseCode', 'AlmacenPT'],
  estado: ['Estado', 'Status', 'StatusName', 'EstadoOrden', 'WOStatus'],
  periodo: ['Periodo', 'Period', 'AnioMes'],
  /** Cliente de la OP (CardCode / nombre según vista). */
  codigo_cliente: [
    'CardCode', 'CodigoCliente', 'CodCliente', 'ClienteCode', 'CustomerCode',
  ],
  cliente: [
    'ClienteOrden', 'CardName', 'Cliente', 'NombreCliente', 'CustomerName', 'ClienteNombre',
  ],
  componente_code: [
    'ComponenteCode', 'CodComponente', 'CompCode', 'ChildCode', 'InsumoCode',
    'MaterialCode', 'ItemCodeComp', 'CodigoComponente', 'CompItem',
  ],
  componente_nombre: [
    'ComponenteNombre', 'NomComponente', 'CompName', 'ChildName', 'InsumoNombre',
    'MaterialName', 'NombreComponente', 'CompItemName',
  ],
  unidad: ['Unidad', 'Uom', 'UoM', 'UnidadMedida', 'InvntryUom', 'Unit'],
}

/** Candidatos VW_BI_CONSUMO_REAL_PRODUCCION. */
export const CONSUMO_REAL_CANDIDATES: Record<string, string[]> = {
  orden: ['DocNum', 'OrdenNum', 'Orden', 'WONum'],
  orden_id: ['DocEntry', 'OrdenId', 'AbsEntry'],
  receta_code: ['ItemCodePT', 'RecetaCode', 'ProductoTerminado', 'ItemCode'],
  receta_nombre: ['ProductoTerminado', 'RecetaNombre', 'ItemName'],
  componente_code: [
    'ComponenteCode', 'CodComponente', 'CompCode', 'ChildCode', 'InsumoCode', 'MaterialCode',
  ],
  componente_nombre: [
    'ComponenteNombre', 'NomComponente', 'CompName', 'ChildName', 'InsumoNombre', 'MaterialName',
  ],
  cantidad: [
    'CantEmitida', 'CantEmitidaMovs', 'CantEmitidaSAP', 'IssuedQty', 'CantidadEmitida',
    'Cantidad', 'Qty',
  ],
  cantidad_plan: ['CantPlanComponente', 'PlannedQty', 'CantPlanificada'],
  cantidad_base: ['CantBaseComponente', 'BaseQty', 'CantidadBase', 'QtyPerUnit'],
  cantidad_producto: ['CantProducidaPT', 'CmpltQty', 'CantProducida', 'CompletedQty', 'CantPlanificadaPT'],
  costo: [
    'CostoRealComponente', 'CostoReal', 'CostoEmitido', 'CostoLinea', 'Costo',
  ],
  costo_plan: ['CostoPlanComponente', 'CostoPlan', 'CostoTeorico'],
  fecha: ['FechaContab', 'Fecha', 'DocDate', 'PostDate'],
  almacen: ['AlmacenPT', 'Almacen', 'WhsCode', 'Warehouse'],
  estado: ['Status', 'Estado', 'StatusName'],
  unidad: ['Unidad', 'Uom', 'UoM'],
}

const PROD_RECETA_PATTERNS = [/receta.*code/i, /^itemcode$/i, /cod.*receta/i, /^producto$/i]
const PROD_CANTIDAD_PATTERNS = [/cantidad/i, /completed.?qty/i, /cmplt.?qty/i, /planned.?qty/i, /^qty$/i, /quantity/i]
const PROD_COSTO_PATTERNS = [/costo.*real/i, /costo.*prod/i, /^costo$/i, /production.?cost/i, /real.?cost/i]
const PROD_FECHA_PATTERNS = [/^fecha$/i, /doc.?date/i, /post.?date/i, /fecha.*prod/i]
const PROD_ORDEN_PATTERNS = [/orden.?num/i, /doc.?num/i, /^orden$/i, /wo.?num/i, /production.?order/i]
const PROD_ORDEN_ID_PATTERNS = [/orden.?id/i, /doc.?entry/i, /abs.?entry/i]

export function suggestProduccionFields(columns: string[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [alias, candidates] of Object.entries(PRODUCCION_CANDIDATES)) {
    const col = findColumnInList(columns, candidates)
    if (col) fields[alias] = col
  }

  const used = new Set(Object.values(fields))
  if (!fields.receta_code) {
    const col = findColumnByPatterns(columns, PROD_RECETA_PATTERNS, used)
    if (col) {
      fields.receta_code = col
      used.add(col)
    }
  }
  if (!fields.cantidad) {
    const col = findColumnByPatterns(columns, PROD_CANTIDAD_PATTERNS, used)
    if (col) {
      fields.cantidad = col
      used.add(col)
    }
  }
  if (!fields.costo) {
    const col = findColumnByPatterns(columns, PROD_COSTO_PATTERNS, used)
    if (col) {
      fields.costo = col
      used.add(col)
    }
  }
  if (!fields.fecha) {
    const col = findColumnByPatterns(columns, PROD_FECHA_PATTERNS, used)
    if (col) fields.fecha = col
  }
  if (!fields.orden) {
    const col = findColumnByPatterns(columns, PROD_ORDEN_PATTERNS, used)
    if (col) {
      fields.orden = col
      used.add(col)
    }
  }
  if (!fields.orden_id) {
    const col = findColumnByPatterns(columns, PROD_ORDEN_ID_PATTERNS, used)
    if (col) {
      fields.orden_id = col
      used.add(col)
    }
  }
  if (!fields.componente_code) {
    const col = findColumnByPatterns(
      columns,
      [/componente/i, /comp.?code/i, /insumo/i, /child.?code/i, /material.?code/i],
      used,
    )
    if (col) {
      fields.componente_code = col
      used.add(col)
    }
  }
  if (!fields.componente_nombre) {
    const col = findColumnByPatterns(
      columns,
      [/comp.*nom/i, /nom.*comp/i, /insumo.*nom/i, /child.?name/i],
      used,
    )
    if (col) fields.componente_nombre = col
  }

  if (!fields.receta_code) {
    throw new Error(
      `No se detectó código de receta en ${VISTA_PRODUCCION}. `
      + `Columnas: ${columns.join(', ')}`,
    )
  }
  if (!fields.costo && !fields.cantidad) {
    throw new Error(
      `No se detectó costo ni cantidad en ${VISTA_PRODUCCION}. `
      + `Columnas: ${columns.join(', ')}`,
    )
  }
  return fields
}

export function suggestConsumoRealFields(
  columns: string[],
  vistaLabel = 'vista de consumo',
): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [alias, candidates] of Object.entries(CONSUMO_REAL_CANDIDATES)) {
    const col = findColumnInList(columns, candidates)
    if (col) fields[alias] = col
  }
  const used = new Set(Object.values(fields))
  if (!fields.componente_code) {
    const col = findColumnByPatterns(
      columns,
      [/componente/i, /comp.?code/i, /insumo/i, /child.?code/i, /material.?code/i],
      used,
    )
    if (col) {
      fields.componente_code = col
      used.add(col)
    }
  }
  if (!fields.cantidad) {
    const col = findColumnByPatterns(
      columns,
      [/emitida/i, /issued/i, /consumo/i, /cantidad/i, /^qty$/i],
      used,
    )
    if (col) {
      fields.cantidad = col
      used.add(col)
    }
  }
  if (!fields.orden && !fields.orden_id) {
    const col = findColumnByPatterns(columns, [/doc.?num/i, /orden/i, /doc.?entry/i], used)
    if (col) fields.orden = col
  }
  if (!fields.componente_code) {
    throw new Error(
      `No se detectó código de componente en ${vistaLabel}. `
      + `Columnas: ${columns.join(', ')}`,
    )
  }
  if (!fields.cantidad && !fields.costo) {
    throw new Error(
      `No se detectó cantidad ni costo emitido en ${vistaLabel}. `
      + `Columnas: ${columns.join(', ')}`,
    )
  }
  return fields
}

let cachedProduccionFields: Record<string, string> | null = null
let cachedProduccionKey = ''
let cachedConsumoFields: Record<string, string> | null = null
let cachedConsumoVista: string | null = null
let cachedConsumoKey = ''
let cachedConsumoAvailable: boolean | null = null

export function clearProduccionFieldsCache(): void {
  cachedProduccionFields = null
  cachedProduccionKey = ''
  cachedConsumoFields = null
  cachedConsumoVista = null
  cachedConsumoKey = ''
  cachedConsumoAvailable = null
}

export async function getProduccionFields(cfg: SapBiCosteoConfig): Promise<Record<string, string>> {
  const key = `${cfg.host}:${cfg.port}:${cfg.schema}:${VISTA_PRODUCCION}`
  if (cachedProduccionFields && cachedProduccionKey === key) {
    return cachedProduccionFields
  }
  const columnas = await listViewColumns(cfg, VISTA_PRODUCCION)
  if (!columnas.length) {
    throw new Error(`No se pudieron leer columnas de ${VISTA_PRODUCCION}`)
  }
  const fields = suggestProduccionFields(columnas)
  cachedProduccionFields = fields
  cachedProduccionKey = key
  return fields
}

export type ConsumoRealSource = {
  vista: string
  fields: Record<string, string>
}

/**
 * Fuente de consumo por componente de OP.
 * Prioriza VW_BI_PRODUCCION_DETALLE_QTY; fallback VW_BI_CONSUMO_REAL_PRODUCCION.
 */
export async function getConsumoRealSource(
  cfg: SapBiCosteoConfig,
): Promise<ConsumoRealSource | null> {
  const key = `${cfg.host}:${cfg.port}:${cfg.schema}:consumo`
  if (cachedConsumoAvailable === false && cachedConsumoKey === key) return null
  if (cachedConsumoFields && cachedConsumoVista && cachedConsumoKey === key) {
    return { vista: cachedConsumoVista, fields: cachedConsumoFields }
  }

  for (const vista of CONSUMO_VISTAS_CANDIDATAS) {
    try {
      const columnas = await listViewColumns(cfg, vista)
      if (!columnas.length) continue
      const fields = suggestConsumoRealFields(columnas, vista)
      cachedConsumoFields = fields
      cachedConsumoVista = vista
      cachedConsumoKey = key
      cachedConsumoAvailable = true
      return { vista, fields }
    } catch {
      // probar siguiente vista
    }
  }

  cachedConsumoAvailable = false
  cachedConsumoKey = key
  return null
}

/** @deprecated Prefer getConsumoRealSource; conserva compatibilidad. */
export async function getConsumoRealFields(
  cfg: SapBiCosteoConfig,
): Promise<Record<string, string> | null> {
  const src = await getConsumoRealSource(cfg)
  return src?.fields ?? null
}

export async function refreshProduccionFields(cfg: SapBiCosteoConfig): Promise<{
  columnas: string[]
  campos: Record<string, string>
}> {
  clearProduccionFieldsCache()
  const columnas = await listViewColumns(cfg, VISTA_PRODUCCION)
  const campos = suggestProduccionFields(columnas)
  const key = `${cfg.host}:${cfg.port}:${cfg.schema}:${VISTA_PRODUCCION}`
  cachedProduccionFields = campos
  cachedProduccionKey = key
  return { columnas, campos }
}

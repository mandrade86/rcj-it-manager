import { findColumnByPatterns, findColumnInList } from './sapBiColumnDetect.js'
import type { SapBiCosteoConfig } from './sapBiCosteoConfig.js'
import { listViewColumns } from './sapBiQuery.js'

/** Vistas fijas RCJ_BI por pestaña del módulo BI. */
export const VISTA_VENTA_COSTO = 'VW_BI_VENTA_COSTO'
export const VISTA_RECETA_COSTO = 'VW_BI_RECETA_COSTO'
export const VISTA_RECETAS_EXPLOSION = 'VW_BI_RECETAS_EXPLOSION'
export const VISTA_RECETAS = 'VW_BI_RECETAS'

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

/** Candidatos por alias lógico en VW_BI_RECETA_COSTO (nombres distintos a VW_BI_VENTA_COSTO). */
export const RECETA_COSTO_CANDIDATES: Record<string, string[]> = {
  receta_code: ['RecetaCode', 'ItemCode', 'CodReceta', 'CodArticulo', 'CodProducto', 'Cod_Receta'],
  receta_nombre: ['ItemName', 'Descripcion', 'NombreReceta', 'NomReceta', 'RecetaNombre', 'DescReceta'],
  costo: ['CostoTeorico', 'Costo', 'CostoTotal', 'CostoReal', 'CostoLinea'],
  costo_unitario: ['CostoUnitario', 'CostoUnit', 'PrecioUnit', 'UnitCost'],
  flag_costo: ['FlagCosto', 'Flag_Costo', 'EstadoCosto'],
  cantidad: ['Cantidad', 'Quantity', 'Qty'],
  componente_code: [
    'ComponenteCode', 'CompCode', 'CodComponente', 'CodigoComponente', 'CompItemCode',
    'ItemCodeComp', 'ItemCodeHijo', 'ChildCode', 'InsumoCode', 'CodInsumo',
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
  costo: 'CostoTeorico',
  costo_unitario: 'CostoUnitario',
  flag_costo: 'FlagCosto',
  cantidad: 'Cantidad',
  componente_code: 'ComponenteCode',
  componente_nombre: 'ComponenteNombre',
}

export function suggestRecetaCostoFields(columns: string[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const [alias, candidates] of Object.entries(RECETA_COSTO_CANDIDATES)) {
    const col = findColumnInList(columns, candidates)
    if (col) fields[alias] = col
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
  cantidad: ['Cantidad', 'Quantity', 'Qty', 'Cant', 'Qntty', 'BaseQty', 'InvQty'],
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

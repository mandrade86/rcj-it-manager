import { findColumnInList } from './sapBiColumnDetect.js'
import type { SapBiCosteoConfig } from './sapBiCosteoConfig.js'
import { listViewColumns } from './sapBiQuery.js'

/** Vistas fijas RCJ_BI por pestaña del módulo BI. */
export const VISTA_VENTA_COSTO = 'VW_BI_VENTA_COSTO'
export const VISTA_RECETA_COSTO = 'VW_BI_RECETA_COSTO'

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
  costo_unitario: ['CostoUnitario', 'CostoUnit', 'PrecioUnit', 'UnitCost', 'CostoTeorico'],
  flag_costo: ['FlagCosto', 'Flag_Costo', 'EstadoCosto'],
  cantidad: ['Cantidad', 'Quantity', 'Qty'],
}

/** Fallback estático si aún no se detectaron columnas. */
export const CAMPOS_RECETA_COSTO: Record<string, string> = {
  receta_code: 'RecetaCode',
  receta_nombre: 'ItemName',
  costo: 'CostoTeorico',
  costo_unitario: 'CostoUnitario',
  flag_costo: 'FlagCosto',
  cantidad: 'Cantidad',
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

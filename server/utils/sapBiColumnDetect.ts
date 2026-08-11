import type { SapBiColumnMapping } from './sapBiCosteoConfig.js'

const CANDIDATES: Record<keyof SapBiColumnMapping, string[]> = {
  cliente: [
    'CardName', 'CLIENTE', 'Cliente', 'NombreCliente', 'NOM_CLIENTE', 'NomCliente',
  ],
  codigo_cliente: [
    'CardCode', 'CODCLIENTE', 'CodCliente', 'COD_CLIENTE', 'CodigoCliente',
  ],
  muestra: [
    'CodReceta', 'CODRECETA', 'Cod_Receta', 'Receta', 'CodArticulo', 'COD_ARTICULO',
    'Articulo', 'ItemCode', 'CodProducto', 'Producto',
  ],
  descripcion: [
    'Descripcion', 'DESCRIPCION', 'DescReceta', 'NombreReceta', 'NomReceta',
    'ItemName', 'RecetaNombre', 'NombreArticulo',
  ],
  costo: [
    'CostoReal', 'COSTO_REAL', 'Costo', 'CostoTotal', 'COSTO', 'LineTotal',
    'CostoVenta', 'CostoLinea',
  ],
  cantidad: ['Quantity', 'Cantidad', 'CANTIDAD', 'Qty', 'Cant', 'Unidades'],
  fecha: ['DocDate', 'Fecha', 'FECHA', 'FechaDoc', 'FECHA_DOC', 'DocDate'],
  moneda: ['DocCur', 'Moneda', 'MONEDA', 'Currency', 'MonedaDoc'],
}

export function findColumnInList(columns: string[], candidates: string[]): string {
  const index = new Map(columns.map((c) => [c.toLowerCase(), c]))
  for (const cand of candidates) {
    const hit = index.get(cand.toLowerCase())
    if (hit) return hit
  }
  return ''
}

export function suggestColumnMapping(columns: string[]): SapBiColumnMapping {
  return {
    cliente: findColumnInList(columns, CANDIDATES.cliente),
    codigo_cliente: findColumnInList(columns, CANDIDATES.codigo_cliente),
    muestra: findColumnInList(columns, CANDIDATES.muestra),
    descripcion: findColumnInList(columns, CANDIDATES.descripcion),
    costo: findColumnInList(columns, CANDIDATES.costo),
    cantidad: findColumnInList(columns, CANDIDATES.cantidad),
    fecha: findColumnInList(columns, CANDIDATES.fecha),
    moneda: findColumnInList(columns, CANDIDATES.moneda),
  }
}

export function formatInvalidColumnHint(
  errMsg: string,
  columns: string[],
  mapping: SapBiColumnMapping,
): string {
  const match = /invalid column name:\s*([^:]+)/i.exec(errMsg)
  const badCol = match?.[1]?.trim()
  const mapped = Object.entries(mapping)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}→${v}`)
    .join(', ')
  let hint =
    `${errMsg}. Revise el mapeo de columnas (actual: ${mapped || 'vacío'}). `
    + 'Use «Detectar columnas» en Configuración SAP.'
  if (columns.length) {
    hint += ` Columnas en la vista: ${columns.join(', ')}.`
  }
  if (badCol) {
    hint += ` La columna «${badCol}» no existe en ${mapping.costo ? 'la vista' : 'VW_BI_VENTA_COSTO'}.`
  }
  return hint
}

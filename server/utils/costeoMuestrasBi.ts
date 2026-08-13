import type { CosteoMuestraRow } from './sapBiQuery.js'

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  const raw = String(value).trim()
  if (!raw) return 0
  // SAP a veces envía "1,234.56" o "1.234,56"
  let normalized = raw.replace(/\s/g, '')
  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.')
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function toDateIso(value: unknown): string | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
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
  factura: string
  orden_produccion: string
}

export type VentaMargenResumen = {
  total_venta: number
  total_costo: number
  total_margen: number
  total_registros: number
  margen_pct: number
}

export type VentaMargenPayload = {
  resumen: VentaMargenResumen
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

export type RecetaCostoResumen = {
  total_recetas: number
  costo_promedio: number
  costo_max: number
  costo_min: number
}

export type RecetaCostoPayload = {
  resumen: RecetaCostoResumen
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

function calcCostoTeoricoLps(cantidad: number, costoUnitario: number, costoFallback = 0): number {
  if (cantidad > 0 && costoUnitario > 0) return cantidad * costoUnitario
  return costoFallback || costoUnitario
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

export type RecetaMatrizItem = {
  receta_code: string
  receta_nombre: string
  total_ingredientes: number
  costo_total: number
  flag_costo: string
  ingredientes: IngredienteRow[]
  /** Cantidad producida (suma VW_BI_PRODUCCION). */
  cantidad_producida: number
  /** Costo real de producción. */
  costo_produccion: number
  /** Costo teórico × cantidad producida (si hay qty; si no, costo_total). */
  costo_teorico_prod: number
  variacion: number
  variacion_pct: number
  ordenes: number
  produccion_detalle: ProduccionLinea[]
}

export type RecetasMatrizPayload = {
  recetas: RecetaMatrizItem[]
  total_recetas: number
  vista: string
  vista_produccion?: string
  campos_mapeados?: Record<string, string>
  campos_produccion?: Record<string, string>
  /** true si cantidad = CostoLinea / CostoUnitario (vista sin columna qty). */
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

export type VentaAnalisisResumen = VentaMargenResumen & {
  total_costo_teorico: number
  total_variacion: number
  variacion_pct: number
}

export type VentaAnalisisPayload = {
  resumen: VentaAnalisisResumen
  por_receta: VentaPorReceta[]
  detalle: VentaAnalisisRow[]
  /** BOM/OP se cargan al expandir (lazy); se dejan vacíos para no romper el JSON. */
  ingredientes_por_receta: Record<string, IngredienteRow[]>
  produccion_por_receta: Record<string, ProduccionLinea[]>
  relacion_venta_op: VentaOpRelacion[]
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

export function buildClienteCatalogo(rows: VentaMargenRow[]): ClienteCatalogoItem[] {
  const map = new Map<string, ClienteCatalogoItem>()
  for (const row of rows) {
    const codigo = row.codigo_cliente.trim()
    if (!codigo) continue
    const key = codigo
    const prev = map.get(key) ?? {
      codigo_cliente: row.codigo_cliente,
      cliente: row.cliente,
      venta_total: 0,
      margen_total: 0,
      registros: 0,
    }
    prev.venta_total += row.venta
    prev.margen_total += row.margen
    prev.registros += 1
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'))
}

export function buildRecetaVentaCatalogo(rows: VentaMargenRow[]): RecetaVentaCatalogoItem[] {
  const map = new Map<string, RecetaVentaCatalogoItem>()
  for (const row of rows) {
    const code = row.receta_code.trim()
    if (!code) continue
    const key = code
    const prev = map.get(key) ?? {
      receta_code: row.receta_code,
      receta_nombre: row.receta_nombre || row.receta_code,
      venta_total: 0,
      registros: 0,
    }
    prev.venta_total += row.venta
    prev.registros += 1
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) =>
    (a.receta_nombre || a.receta_code).localeCompare(b.receta_nombre || b.receta_code, 'es'),
  )
}

export function buildRecetaCatalogo(rows: RecetaCostoRow[]): RecetaCatalogoItem[] {
  const map = new Map<string, RecetaCatalogoItem>()
  for (const r of rows) {
    const code = r.receta_code.trim()
    if (!code) continue
    const key = code
    const lineCost = calcCostoTeoricoLps(r.cantidad, r.costo_unitario, r.costo)
    const prev = map.get(key)
    if (prev) {
      prev.costo += lineCost
      if (!prev.flag_costo && r.flag_costo) prev.flag_costo = r.flag_costo
    } else {
      map.set(key, {
        receta_code: r.receta_code,
        receta_nombre: r.receta_nombre || r.receta_code,
        costo: lineCost,
        flag_costo: r.flag_costo,
      })
    }
  }
  return [...map.values()].sort((a, b) =>
    (a.receta_nombre || a.receta_code).localeCompare(b.receta_nombre || b.receta_code, 'es'),
  )
}

/** Matriz: todas las recetas con ingredientes anidados (VW_BI_RECETA_COSTO). */
export function buildRecetasMatriz(
  raw: Record<string, unknown>[],
  meta: { vista: string; campos_mapeados?: Record<string, string> },
): RecetasMatrizPayload {
  const byReceta = new Map<string, Record<string, unknown>[]>()
  for (const row of raw) {
    const code = String(row.receta_code ?? '').trim()
    if (!code) continue
    const list = byReceta.get(code) ?? []
    list.push(row)
    byReceta.set(code, list)
  }

  const recetas: RecetaMatrizItem[] = []
  for (const [code, lines] of byReceta) {
    const ingredientes = mapRecetaCostoIngredienteRows(lines)
    const catalog = buildRecetaCatalogo(mapRecetaCostoRows(lines))[0]
    const costo_total =
      ingredientes.reduce((s, i) => s + i.costo_teorico, 0) || catalog?.costo || 0
    recetas.push({
      receta_code: code,
      receta_nombre: catalog?.receta_nombre || String(lines[0]?.receta_nombre ?? code).trim() || code,
      total_ingredientes: ingredientes.length,
      costo_total,
      flag_costo: catalog?.flag_costo || '',
      ingredientes,
      cantidad_producida: 0,
      costo_produccion: 0,
      costo_teorico_prod: 0,
      variacion: 0,
      variacion_pct: 0,
      ordenes: 0,
      produccion_detalle: [],
    })
  }

  recetas.sort((a, b) =>
    (a.receta_nombre || a.receta_code).localeCompare(b.receta_nombre || b.receta_code, 'es'),
  )

  const campos = meta.campos_mapeados ?? {}
  const cantidad_derivada = !campos.cantidad && Boolean(campos.costo && campos.costo_unitario)

  return {
    recetas,
    total_recetas: recetas.length,
    vista: meta.vista,
    campos_mapeados: meta.campos_mapeados,
    cantidad_derivada,
    produccion_ok: false,
    produccion_error: null,
  }
}

export function mapProduccionRows(raw: Record<string, unknown>[]): ProduccionLinea[] {
  return raw.map((r) => ({
    fecha: toDateIso(r.fecha),
    periodo: String(r.periodo ?? '').trim(),
    orden: String(r.orden ?? '').trim(),
    cantidad: toNumber(r.cantidad),
    costo: toNumber(r.costo),
    almacen: String(r.almacen ?? '').trim(),
    estado: String(r.estado ?? '').trim(),
    receta_code: String(r.receta_code ?? '').trim(),
    receta_nombre: String(r.receta_nombre ?? '').trim(),
  }))
}

/** Cruza teórico (BOM) con líneas de producción real por código de receta. */
export function mergeProduccionIntoMatriz(
  matriz: RecetasMatrizPayload,
  produccionRaw: Record<string, unknown>[],
  meta: { vista_produccion: string; campos_produccion?: Record<string, string> },
): RecetasMatrizPayload {
  const lineas = mapProduccionRows(produccionRaw)
  const byReceta = new Map<string, ProduccionLinea[]>()
  for (const row of lineas) {
    const code = row.receta_code
    if (!code) continue
    const list = byReceta.get(code) ?? []
    list.push(row)
    byReceta.set(code, list)
  }

  const recetas = matriz.recetas.map((r) => {
    const detalle = (byReceta.get(r.receta_code) ?? []).sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha).getTime() : 0
      const db = b.fecha ? new Date(b.fecha).getTime() : 0
      return db - da
    })
    const cantidad_producida = detalle.reduce((s, d) => s + (d.cantidad > 0 ? d.cantidad : 0), 0)
    const costo_produccion = detalle.reduce((s, d) => s + d.costo, 0)
    const unitTeorico = r.costo_total
    const costo_teorico_prod = cantidad_producida > 0 ? unitTeorico * cantidad_producida : 0
    const variacion = costo_produccion - costo_teorico_prod
    const variacion_pct = costo_teorico_prod > 0 ? (variacion / costo_teorico_prod) * 100 : 0
    const ordenes = new Set(detalle.map((d) => d.orden).filter(Boolean)).size || detalle.length

    return {
      ...r,
      cantidad_producida,
      costo_produccion,
      costo_teorico_prod,
      variacion,
      variacion_pct,
      ordenes,
      produccion_detalle: detalle,
    }
  })

  // Recetas que solo aparecen en producción (sin BOM en RECETA_COSTO)
  for (const [code, detalle] of byReceta) {
    if (recetas.some((r) => r.receta_code === code)) continue
    const cantidad_producida = detalle.reduce((s, d) => s + (d.cantidad > 0 ? d.cantidad : 0), 0)
    const costo_produccion = detalle.reduce((s, d) => s + d.costo, 0)
    recetas.push({
      receta_code: code,
      receta_nombre: detalle[0]?.receta_nombre || code,
      total_ingredientes: 0,
      costo_total: 0,
      flag_costo: '',
      ingredientes: [],
      cantidad_producida,
      costo_produccion,
      costo_teorico_prod: 0,
      variacion: costo_produccion,
      variacion_pct: 0,
      ordenes: new Set(detalle.map((d) => d.orden).filter(Boolean)).size || detalle.length,
      produccion_detalle: detalle,
    })
  }

  recetas.sort((a, b) =>
    (a.receta_nombre || a.receta_code).localeCompare(b.receta_nombre || b.receta_code, 'es'),
  )

  const total_costo_teorico = recetas.reduce((s, r) => s + r.costo_teorico_prod, 0)
  const total_costo_produccion = recetas.reduce((s, r) => s + r.costo_produccion, 0)
  const total_variacion = total_costo_produccion - total_costo_teorico
  const total_cantidad_producida = recetas.reduce((s, r) => s + r.cantidad_producida, 0)
  const recetas_con_produccion = recetas.filter((r) => r.produccion_detalle.length > 0).length

  return {
    ...matriz,
    recetas,
    total_recetas: recetas.length,
    vista_produccion: meta.vista_produccion,
    campos_produccion: meta.campos_produccion,
    produccion_ok: true,
    produccion_error: null,
    resumen_produccion: {
      total_costo_teorico,
      total_costo_produccion,
      total_variacion,
      variacion_pct: total_costo_teorico > 0 ? (total_variacion / total_costo_teorico) * 100 : 0,
      total_cantidad_producida,
      recetas_con_produccion,
    },
  }
}

/** Líneas de VW_BI_RECETA_COSTO: costo teórico = cantidad × costo unitario (Lps). */
export function mapRecetaCostoIngredienteRows(raw: Record<string, unknown>[]): IngredienteRow[] {
  const rows = raw.map((r) => {
    let cantidad = toNumber(r.cantidad)
    const costo_unitario = toNumber(r.costo_unitario)
    const costoFallback = toNumber(r.costo)
    // Si cantidad no vino mapeada pero hay costo total y unitario, estimar qty
    if (!cantidad && costo_unitario > 0 && costoFallback > 0) {
      cantidad = costoFallback / costo_unitario
    }
    const costo_teorico = calcCostoTeoricoLps(cantidad, costo_unitario, costoFallback)
    const componente_code = String(r.componente_code ?? '').trim()
    const componente_nombre = String(
      r.componente_nombre ?? r.componente_code ?? r.receta_nombre ?? '',
    ).trim() || 'Componente'
    const unidad = String(r.unidad ?? r.unidad_medida ?? '').trim()
    return {
      componente_code,
      componente_nombre,
      cantidad,
      unidad,
      costo_unitario,
      costo_teorico,
      pct_costo: 0,
    }
  })

  const total = rows.reduce((s, r) => s + r.costo_teorico, 0)
  return rows
    .map((r) => ({
      ...r,
      pct_costo: total > 0 ? (r.costo_teorico / total) * 100 : 0,
    }))
    .sort((a, b) => b.costo_teorico - a.costo_teorico)
}

export function mapIngredienteRows(raw: Record<string, unknown>[]): IngredienteRow[] {
  const rows = raw.map((r) => {
    let cantidad = toNumber(r.cantidad)
    const costo_unitario = toNumber(r.costo_unitario)
    const costoFallback = toNumber(r.costo_linea)
    if (!cantidad && costo_unitario > 0 && costoFallback > 0) {
      cantidad = costoFallback / costo_unitario
    }
    const costo_teorico = calcCostoTeoricoLps(cantidad, costo_unitario, costoFallback)
    return {
      componente_code: String(r.componente_code ?? '').trim(),
      componente_nombre: String(r.componente_nombre ?? r.componente_code ?? '').trim() || 'Componente',
      cantidad,
      unidad: String(r.unidad ?? r.unidad_medida ?? '').trim(),
      costo_unitario,
      costo_teorico,
      pct_costo: 0,
    }
  })

  const total = rows.reduce((s, r) => s + r.costo_teorico, 0)
  return rows
    .map((r) => ({
      ...r,
      pct_costo: total > 0 ? (r.costo_teorico / total) * 100 : 0,
    }))
    .sort((a, b) => b.costo_teorico - a.costo_teorico)
}

export function buildRecetaDetallePayload(
  receta: RecetaCatalogoItem,
  ingredientes: IngredienteRow[],
  meta: { vista: string },
): RecetaDetallePayload {
  const costo_total = ingredientes.reduce((s, i) => s + i.costo_teorico, 0) || receta.costo
  return {
    receta,
    ingredientes,
    resumen: {
      total_ingredientes: ingredientes.length,
      costo_total,
      costo_promedio_ingrediente:
        ingredientes.length > 0 ? costo_total / ingredientes.length : 0,
    },
    vista: meta.vista,
  }
}

const MAX_DETALLE_VENTA = 1_200
const MAX_RELACION_VENTA_OP = 600
const MAX_POR_RECETA = 200
const MAX_MATCHES_POR_VENTA = 2
const MAX_STR = 160

function clipStr(v: string, max = MAX_STR): string {
  const s = String(v ?? '')
  return s.length <= max ? s : s.slice(0, max)
}

function slimVentaAnalisisRow(row: VentaAnalisisRow): VentaAnalisisRow {
  return {
    empresa: clipStr(row.empresa, 40),
    fecha: row.fecha,
    periodo: clipStr(row.periodo, 20),
    codigo_cliente: clipStr(row.codigo_cliente, 40),
    cliente: clipStr(row.cliente, 80),
    grupo_cliente: clipStr(row.grupo_cliente, 40),
    receta_code: clipStr(row.receta_code, 40),
    receta_nombre: clipStr(row.receta_nombre, 80),
    cantidad: row.cantidad,
    venta: row.venta,
    costo: row.costo,
    margen: row.margen,
    factura: clipStr(row.factura ?? '', 40),
    orden_produccion: clipStr(row.orden_produccion ?? '', 40),
    costo_teorico_unit: row.costo_teorico_unit,
    costo_teorico: row.costo_teorico,
    variacion: row.variacion,
    variacion_pct: row.variacion_pct,
    margen_pct: row.margen_pct,
  }
}

/** Reduce payload si JSON.stringify falla por tamaño (Invalid string length). */
export function shrinkVentaAnalisisPayload(
  payload: VentaAnalisisPayload,
  level: 1 | 2 | 3,
): VentaAnalisisPayload {
  const maxDet = level === 1 ? 400 : level === 2 ? 150 : 50
  const maxRel = level === 1 ? 200 : level === 2 ? 80 : 0
  const maxPor = level === 1 ? 80 : level === 2 ? 40 : 20
  return {
    ...payload,
    por_receta: payload.por_receta.slice(0, maxPor),
    detalle: payload.detalle.slice(0, maxDet),
    relacion_venta_op: maxRel ? payload.relacion_venta_op.slice(0, maxRel) : [],
    ingredientes_por_receta: {},
    produccion_por_receta: {},
    detalle_truncado: true,
    aviso:
      `Respuesta reducida (nivel ${level}) por tamaño: ` +
      `${maxDet} líneas de detalle` +
      (maxRel ? `, ${maxRel} relaciones venta↔OP` : '') +
      '. Use filtros de cliente, receta o fechas.',
  }
}

export function aggregateVentaAnalisis(
  ventas: VentaMargenRow[],
  recetasCosto: Map<string, RecetaCostoRow>,
  meta: {
    vista: string
    ultimo_sync: string | null
    produccion?: ProduccionLinea[]
    campos_venta?: Record<string, string>
    produccion_ok?: boolean
    produccion_error?: string | null
  },
): VentaAnalisisPayload {
  const produccion = meta.produccion ?? []

  const detalle: VentaAnalisisRow[] = ventas.map((row) => {
    const teoricoUnit = recetasCosto.get(row.receta_code)?.costo ?? 0
    const qty = row.cantidad > 0 ? row.cantidad : 1
    const costo_teorico = teoricoUnit * qty
    const variacion = row.costo - costo_teorico
    const variacion_pct = costo_teorico > 0 ? (variacion / costo_teorico) * 100 : 0
    const margen_pct = row.venta > 0 ? (row.margen / row.venta) * 100 : 0
    return slimVentaAnalisisRow({
      ...row,
      costo_teorico_unit: teoricoUnit,
      costo_teorico,
      variacion,
      variacion_pct,
      margen_pct,
    })
  })

  const porRecetaMap = new Map<string, VentaPorReceta>()
  for (const row of detalle) {
    const key = row.receta_code || row.receta_nombre
    if (!key) continue
    const prev = porRecetaMap.get(key) ?? {
      receta_code: row.receta_code,
      receta_nombre: row.receta_nombre,
      cantidad: 0,
      venta: 0,
      costo_produccion: 0,
      costo_teorico: 0,
      variacion: 0,
      variacion_pct: 0,
      margen: 0,
      margen_pct: 0,
      registros: 0,
    }
    prev.cantidad += row.cantidad > 0 ? row.cantidad : 1
    prev.venta += row.venta
    prev.costo_produccion += row.costo
    prev.costo_teorico += row.costo_teorico
    prev.variacion += row.variacion
    prev.margen += row.margen
    prev.registros += 1
    porRecetaMap.set(key, prev)
  }

  const por_receta = [...porRecetaMap.values()]
    .map((r) => ({
      ...r,
      receta_nombre: clipStr(r.receta_nombre, 80),
      variacion_pct: r.costo_teorico > 0 ? (r.variacion / r.costo_teorico) * 100 : 0,
      margen_pct: r.venta > 0 ? (r.margen / r.venta) * 100 : 0,
    }))
    .sort((a, b) => b.venta - a.venta)
    .slice(0, MAX_POR_RECETA)

  const total_venta = detalle.reduce((s, r) => s + r.venta, 0)
  const total_costo = detalle.reduce((s, r) => s + r.costo, 0)
  const total_margen = detalle.reduce((s, r) => s + r.margen, 0)
  const total_costo_teorico = detalle.reduce((s, r) => s + r.costo_teorico, 0)
  const total_variacion = detalle.reduce((s, r) => s + r.variacion, 0)

  const detalleSorted = [...detalle]
    .sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha).getTime() : 0
      const db = b.fecha ? new Date(b.fecha).getTime() : 0
      return db - da
    })
    .slice(0, MAX_DETALLE_VENTA)

  const detalle_truncado = detalle.length > detalleSorted.length
  const aviso = detalle_truncado
    ? `Mostrando ${detalleSorted.length.toLocaleString('es-HN')} de ${detalle.length.toLocaleString('es-HN')} líneas. Use filtros para ver el resto. BOM/OP se cargan al expandir.`
    : null

  // Solo producción de recetas presentes en el detalle mostrado (cruce OP más liviano)
  const recetasDetalle = new Set(detalleSorted.map((r) => r.receta_code).filter(Boolean))
  const produccionFiltrada = produccion.filter(
    (p) => !p.receta_code || recetasDetalle.has(p.receta_code),
  )

  return {
    resumen: {
      total_venta,
      total_costo,
      total_margen,
      total_registros: detalle.length,
      margen_pct: total_venta > 0 ? (total_margen / total_venta) * 100 : 0,
      total_costo_teorico,
      total_variacion,
      variacion_pct: total_costo_teorico > 0 ? (total_variacion / total_costo_teorico) * 100 : 0,
    },
    por_receta,
    detalle: detalleSorted,
    ingredientes_por_receta: {},
    produccion_por_receta: {},
    relacion_venta_op: buildRelacionVentaOp(detalleSorted, produccionFiltrada),
    campos_venta: meta.campos_venta,
    produccion_ok: meta.produccion_ok,
    produccion_error: meta.produccion_error ?? null,
    ultimo_sync: meta.ultimo_sync,
    vista: meta.vista,
    filas_leidas: detalle.length,
    detalle_truncado,
    aviso,
  }
}

export function mapVentaMargenRows(raw: Record<string, unknown>[]): VentaMargenRow[] {
  return raw.map((r) => ({
    empresa: clipStr(String(r.empresa ?? '').trim(), 40),
    fecha: toDateIso(r.fecha),
    periodo: clipStr(String(r.periodo ?? '').trim(), 20),
    codigo_cliente: clipStr(String(r.codigo_cliente ?? '').trim(), 40),
    cliente: clipStr(String(r.cliente ?? '').trim() || 'Sin cliente', 80),
    grupo_cliente: clipStr(String(r.grupo_cliente ?? '').trim(), 40),
    receta_code: clipStr(String(r.receta_code ?? '').trim(), 40),
    receta_nombre: clipStr(String(r.receta_nombre ?? '').trim(), 80),
    cantidad: toNumber(r.cantidad),
    venta: toNumber(r.venta),
    costo: toNumber(r.costo),
    margen: toNumber(r.margen),
    factura: clipStr(String(r.factura ?? '').trim(), 40),
    orden_produccion: clipStr(String(r.orden_produccion ?? '').trim(), 40),
  }))
}

function periodoKey(fecha: string | null, periodo: string): string {
  if (periodo?.trim()) return periodo.trim().slice(0, 7)
  if (fecha) return fecha.slice(0, 7)
  return ''
}

export function buildRelacionVentaOp(
  ventas: VentaAnalisisRow[],
  produccion: ProduccionLinea[],
): VentaOpRelacion[] {
  const byOrden = new Map<string, ProduccionLinea[]>()
  const byReceta = new Map<string, ProduccionLinea[]>()
  for (const p of produccion) {
    if (p.orden) {
      const list = byOrden.get(p.orden) ?? []
      list.push(p)
      byOrden.set(p.orden, list)
    }
    if (p.receta_code) {
      const list = byReceta.get(p.receta_code) ?? []
      list.push(p)
      byReceta.set(p.receta_code, list)
    }
  }

  const out: VentaOpRelacion[] = []
  for (const v of ventas) {
    if (out.length >= MAX_RELACION_VENTA_OP) break

    let matches: ProduccionLinea[] = []
    let match: VentaOpRelacion['match'] = 'sin_op'

    if (v.orden_produccion && byOrden.has(v.orden_produccion)) {
      matches = (byOrden.get(v.orden_produccion) ?? []).slice(0, MAX_MATCHES_POR_VENTA)
      match = 'orden'
    } else if (v.receta_code) {
      const candidates = byReceta.get(v.receta_code) ?? []
      const periodoV = periodoKey(v.fecha, v.periodo)
      const samePeriod = periodoV
        ? candidates.filter((p) => periodoKey(p.fecha, p.periodo) === periodoV)
        : []
      if (samePeriod.length) {
        matches = samePeriod.slice(0, MAX_MATCHES_POR_VENTA)
        match = 'receta_periodo'
      } else if (candidates.length) {
        matches = candidates.slice(0, 1)
        match = 'receta'
      }
    }

    if (matches.length === 0) {
      out.push({
        factura: v.factura,
        fecha_venta: v.fecha,
        periodo: v.periodo,
        codigo_cliente: v.codigo_cliente,
        cliente: v.cliente,
        receta_code: v.receta_code,
        receta_nombre: v.receta_nombre,
        cantidad_venta: v.cantidad,
        venta: v.venta,
        costo_venta: v.costo,
        orden_produccion: v.orden_produccion,
        fecha_op: null,
        cantidad_op: 0,
        costo_op: 0,
        almacen: '',
        estado_op: '',
        match: 'sin_op',
      })
      continue
    }

    for (const p of matches) {
      if (out.length >= MAX_RELACION_VENTA_OP) break
      out.push({
        factura: v.factura,
        fecha_venta: v.fecha,
        periodo: v.periodo,
        codigo_cliente: v.codigo_cliente,
        cliente: v.cliente,
        receta_code: v.receta_code,
        receta_nombre: v.receta_nombre,
        cantidad_venta: v.cantidad,
        venta: v.venta,
        costo_venta: v.costo,
        orden_produccion: p.orden || v.orden_produccion,
        fecha_op: p.fecha,
        cantidad_op: p.cantidad,
        costo_op: p.costo,
        almacen: p.almacen,
        estado_op: p.estado,
        match,
      })
    }
  }
  return out
}

export function aggregateVentasMargen(
  rows: VentaMargenRow[],
  meta: { vista: string; ultimo_sync: string | null },
): VentaMargenPayload {
  const total_venta = rows.reduce((s, r) => s + r.venta, 0)
  const total_costo = rows.reduce((s, r) => s + r.costo, 0)
  const total_margen = rows.reduce((s, r) => s + r.margen, 0)
  const margen_pct = total_venta > 0 ? (total_margen / total_venta) * 100 : 0

  return {
    resumen: {
      total_venta,
      total_costo,
      total_margen,
      total_registros: rows.length,
      margen_pct,
    },
    detalle: rows.sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha).getTime() : 0
      const db = b.fecha ? new Date(b.fecha).getTime() : 0
      return db - da
    }),
    ultimo_sync: meta.ultimo_sync,
    vista: meta.vista,
    filas_leidas: rows.length,
  }
}

export function mapRecetaCostoRows(raw: Record<string, unknown>[]): RecetaCostoRow[] {
  return raw.map((r) => {
    let cantidad = toNumber(r.cantidad)
    const costo_unitario = toNumber(r.costo_unitario)
    const costoFallback = toNumber(r.costo)
    if (!cantidad && costo_unitario > 0 && costoFallback > 0) {
      cantidad = costoFallback / costo_unitario
    }
    const costo = calcCostoTeoricoLps(cantidad, costo_unitario, costoFallback)
    return {
      receta_code: String(r.receta_code ?? '').trim(),
      receta_nombre: String(r.receta_nombre ?? '').trim(),
      costo,
      costo_unitario: costo_unitario || costo,
      flag_costo: String(r.flag_costo ?? '').trim(),
      cantidad,
    }
  })
}

export function aggregateRecetasCosto(
  rows: RecetaCostoRow[],
  meta: { vista: string; ultimo_sync: string | null },
): RecetaCostoPayload {
  const byReceta = new Map<string, RecetaCostoRow>()
  for (const row of rows) {
    const key = row.receta_code || row.receta_nombre
    if (!key) continue
    const prev = byReceta.get(key)
    if (prev) {
      prev.costo += row.costo
      if (!prev.flag_costo && row.flag_costo) prev.flag_costo = row.flag_costo
    } else {
      byReceta.set(key, { ...row })
    }
  }

  const detalle = [...byReceta.values()].sort((a, b) => b.costo - a.costo)
  const costos = detalle.map((r) => r.costo).filter((c) => c > 0)

  return {
    resumen: {
      total_recetas: detalle.length,
      costo_promedio: costos.length ? costos.reduce((s, c) => s + c, 0) / costos.length : 0,
      costo_max: costos.length ? Math.max(...costos) : 0,
      costo_min: costos.length ? Math.min(...costos) : 0,
    },
    detalle,
    ultimo_sync: meta.ultimo_sync,
    vista: meta.vista,
    filas_leidas: rows.length,
  }
}

export type CosteoPorCliente = {
  cliente: string
  codigo_cliente: string
  costo: number
  cantidad_muestras: number
  registros: number
}

export type CosteoMuestrasResumen = {
  total_costo: number
  total_muestras: number
  total_clientes: number
  total_registros: number
  moneda: string
}

export type CosteoMuestrasPayload = {
  resumen: CosteoMuestrasResumen
  por_cliente: CosteoPorCliente[]
  detalle: CosteoMuestraRow[]
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
}

export function aggregateCosteoMuestras(
  rows: CosteoMuestraRow[],
  meta: { vista: string; ultimo_sync: string | null },
): CosteoMuestrasPayload {
  const porClienteMap = new Map<string, CosteoPorCliente>()

  for (const row of rows) {
    const key = row.codigo_cliente || row.cliente
    const prev = porClienteMap.get(key) ?? {
      cliente: row.cliente,
      codigo_cliente: row.codigo_cliente,
      costo: 0,
      cantidad_muestras: 0,
      registros: 0,
    }
    prev.costo += row.costo
    prev.cantidad_muestras += row.cantidad > 0 ? row.cantidad : 1
    prev.registros += 1
    porClienteMap.set(key, prev)
  }

  const por_cliente = [...porClienteMap.values()].sort((a, b) => b.costo - a.costo)
  const total_costo = rows.reduce((s, r) => s + r.costo, 0)
  const total_muestras = rows.reduce((s, r) => s + (r.cantidad > 0 ? r.cantidad : 1), 0)
  const moneda = rows.find((r) => r.moneda)?.moneda ?? 'HNL'

  return {
    resumen: {
      total_costo,
      total_muestras,
      total_clientes: por_cliente.length,
      total_registros: rows.length,
      moneda,
    },
    por_cliente,
    detalle: rows,
    ultimo_sync: meta.ultimo_sync,
    vista: meta.vista,
    filas_leidas: rows.length,
  }
}

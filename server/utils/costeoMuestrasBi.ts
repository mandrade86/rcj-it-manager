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

/** Nº de OP comparable entre venta (OrdenProd) y producción (OrdenNum). */
export function normOp(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '—' || raw.toLowerCase() === 'null') return ''
  return raw.replace(/\.0+$/, '')
}

/** DocNum numérico (ej. "OproLB 337728" → "337728"). */
export function opDocNum(value: unknown): string {
  const raw = normOp(value)
  if (!raw) return ''
  const m = raw.match(/(\d+)\s*$/)
  return m ? m[1]! : raw
}

/** Cruce flexible de OP: exacto, DocEntry o sufijo numérico SAP. */
export function ordenMatches(filter: string, orden?: string, ordenId?: string): boolean {
  const f = normOp(filter).toLowerCase()
  if (!f) return false
  const o = normOp(orden).toLowerCase()
  const id = normOp(ordenId).toLowerCase()
  if (o === f || id === f) return true
  const fNum = opDocNum(filter)
  const oNum = opDocNum(orden)
  if (fNum && oNum && fNum === oNum) return true
  if (fNum && id === fNum) return true
  if (fNum && o.endsWith(fNum)) return true
  return false
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
  /** Nº OP visible (DocNum / OrdenNum). */
  orden: string
  /** DocEntry interno (opcional). */
  orden_id?: string
  cantidad: number
  costo: number
  /** Cantidad planificada del componente (si viene de consumo). */
  cantidad_plan?: number
  /** Cantidad por unidad PT (WOR1.BaseQty / ITT1). */
  cantidad_base?: number
  /** Costo planificado del componente. */
  costo_plan?: number
  /** Qty producida del PT (CantProducidaPT / CmpltQty en cabecera OP). */
  cantidad_producto?: number
  almacen: string
  estado: string
  receta_code: string
  receta_nombre: string
  /** Cliente asociado a la OP (ClienteOrden), si la vista lo trae. */
  codigo_cliente?: string
  cliente?: string
  /** Si la vista trae explosión de consumo por OP. */
  componente_code?: string
  componente_nombre?: string
  unidad?: string
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
  /** Costo real de las OP (cabeceras). */
  costo_op: number
  ordenes: number
}

export type VentaAnalisisResumen = VentaMargenResumen & {
  total_costo_teorico: number
  total_variacion: number
  variacion_pct: number
  total_qty_vendida: number
  total_qty_producida: number
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
    orden: normOp(r.orden ?? r.orden_id),
    orden_id: normOp(r.orden_id) || undefined,
    cantidad: toNumber(r.cantidad),
    costo: toNumber(r.costo),
    cantidad_plan: r.cantidad_plan != null ? toNumber(r.cantidad_plan) : undefined,
    cantidad_base: r.cantidad_base != null ? toNumber(r.cantidad_base) : undefined,
    costo_plan: r.costo_plan != null ? toNumber(r.costo_plan) : undefined,
    cantidad_producto:
      r.cantidad_producto != null ? toNumber(r.cantidad_producto) : undefined,
    almacen: String(r.almacen ?? '').trim(),
    estado: String(r.estado ?? '').trim(),
    receta_code: String(r.receta_code ?? '').trim(),
    receta_nombre: String(r.receta_nombre ?? '').trim(),
    codigo_cliente: String(r.codigo_cliente ?? '').trim() || undefined,
    cliente: String(r.cliente ?? '').trim() || undefined,
    componente_code: String(r.componente_code ?? '').trim() || undefined,
    componente_nombre: String(r.componente_nombre ?? '').trim() || undefined,
    unidad: String(r.unidad ?? '').trim() || undefined,
  }))
}

/** Filas de VW_BI_CONSUMO_REAL_PRODUCCION → líneas con componente. */
export function mapConsumoRealRows(raw: Record<string, unknown>[]): ProduccionLinea[] {
  return raw.map((r) => {
    const qtyMovs = toNumber(r.cantidad)
    const qtySap = toNumber(r.cantidad_sap ?? r.qty_sap)
    const cantidad = qtyMovs > 0 ? qtyMovs : qtySap > 0 ? qtySap : qtyMovs
    return {
      fecha: toDateIso(r.fecha),
      periodo: String(r.periodo ?? '').trim(),
      orden: normOp(r.orden ?? r.orden_id),
      orden_id: normOp(r.orden_id) || undefined,
      cantidad,
      costo: toNumber(r.costo),
      cantidad_plan: r.cantidad_plan != null ? toNumber(r.cantidad_plan) : undefined,
      cantidad_base: r.cantidad_base != null ? toNumber(r.cantidad_base) : undefined,
      costo_plan: r.costo_plan != null ? toNumber(r.costo_plan) : undefined,
      cantidad_producto:
        r.cantidad_producto != null ? toNumber(r.cantidad_producto) : undefined,
      almacen: String(r.almacen ?? '').trim(),
      estado: String(r.estado ?? '').trim(),
      receta_code: String(r.receta_code ?? '').trim(),
      receta_nombre: String(r.receta_nombre ?? '').trim(),
      componente_code: String(r.componente_code ?? '').trim() || undefined,
      componente_nombre: String(r.componente_nombre ?? '').trim() || undefined,
      unidad: String(r.unidad ?? '').trim() || undefined,
    }
  }).filter((l) => Boolean(l.componente_code || l.componente_nombre))
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

function preciosDesdeBomMaestro(
  bomMaestro: IngredienteRow[],
): Map<string, { costo_unitario: number; unidad: string; nombre: string }> {
  const m = new Map<string, { costo_unitario: number; unidad: string; nombre: string }>()
  for (const b of bomMaestro) {
    if (!b.componente_code) continue
    m.set(b.componente_code, {
      costo_unitario: b.costo_unitario,
      unidad: b.unidad,
      nombre: b.componente_nombre,
    })
  }
  return m
}

/**
 * Receta según WOR1 (pestaña Contenido de la OP en SAP).
 *
 * En SAP, WOR1."PlannedQty" / columna Cantidad = total de la OP (ya × qty PT).
 * WOR1."BaseQty" = por 1 und de producto terminado.
 *
 * Aquí `cantidad` siempre es por 1 und PT, para que luego
 * qty_teorica = cantidad × qty_producida coincida con Contenido (sin doblar).
 */
export function buildBomDesdeOpPlan(
  consumoLines: ProduccionLinea[],
  qtyPt: number,
  bomMaestro: IngredienteRow[] = [],
): IngredienteRow[] {
  const precios = preciosDesdeBomMaestro(bomMaestro)
  const byCode = new Map<string, ProduccionLinea>()
  for (const c of consumoLines) {
    if (!c.componente_code) continue
    const prev = byCode.get(c.componente_code)
    if (!prev || (c.cantidad_plan ?? 0) >= (prev.cantidad_plan ?? 0)) {
      byCode.set(c.componente_code, c)
    }
  }

  const rows: IngredienteRow[] = []
  for (const c of byCode.values()) {
    const qtyPlan = c.cantidad_plan ?? 0
    const base = c.cantidad_base ?? 0
    // Preferir PlannedQty / qty PT: Contenido SAP ya trae el total de la OP.
    // Si se usa BaseQty cuando BaseQty == PlannedQty, se dobla al escalar (2 → 4).
    let qtyPorUnd = 0
    if (qtyPt > 0 && qtyPlan > 0) {
      qtyPorUnd = qtyPlan / qtyPt
    } else if (base > 0) {
      qtyPorUnd = base
    } else if (qtyPlan > 0) {
      qtyPorUnd = qtyPlan
    }
    const ref = precios.get(c.componente_code)
    let costo_unitario = 0
    if ((c.costo_plan ?? 0) > 0 && qtyPlan > 0) {
      costo_unitario = c.costo_plan! / qtyPlan
    } else if ((c.costo ?? 0) > 0 && (c.cantidad > 0 || qtyPlan > 0)) {
      const q = c.cantidad > 0 ? c.cantidad : qtyPlan
      costo_unitario = c.costo / q
    } else if (ref && ref.costo_unitario > 0) {
      costo_unitario = ref.costo_unitario
    }
    // Costo de línea por 1 und PT (luego se escala × qty producida).
    const costo_teorico =
      costo_unitario > 0 && qtyPorUnd > 0
        ? costo_unitario * qtyPorUnd
        : qtyPt > 0 && (c.costo_plan ?? 0) > 0
          ? c.costo_plan! / qtyPt
          : 0
    rows.push({
      componente_code: c.componente_code,
      componente_nombre: c.componente_nombre || ref?.nombre || c.componente_code,
      cantidad: qtyPorUnd,
      unidad: c.unidad || ref?.unidad || '',
      costo_unitario,
      costo_teorico,
      pct_costo: 0,
    })
  }

  const total = rows.reduce((s, r) => s + r.costo_teorico, 0)
  return rows
    .map((r) => ({
      ...r,
      pct_costo: total > 0 ? (r.costo_teorico / total) * 100 : 0,
    }))
    .sort((a, b) => b.costo_teorico - a.costo_teorico)
}

export type BomPickResult = {
  bom: IngredienteRow[]
  fuente: 'maestro' | 'op_wor1'
  aviso_bom: string | null
  bom_maestro: IngredienteRow[]
  bom_op: IngredienteRow[]
}

/**
 * Teórico = siempre Lista de materiales (VW_BI_RECETA_COSTO ← OITT/ITT1).
 * WOR1 solo sirve para comparar real/plan y armar alertas de códigos distintos.
 * Solo si no hay BOM maestro se usa WOR1 como fallback.
 */
export function pickBomParaOp(
  bomMaestro: IngredienteRow[],
  consumoLines: ProduccionLinea[],
  qtyPt: number,
): BomPickResult {
  const bom_op = buildBomDesdeOpPlan(consumoLines, qtyPt, bomMaestro)

  if (bomMaestro.length > 0) {
    const codesMaestro = new Set(bomMaestro.map((b) => b.componente_code).filter(Boolean))
    const codesOp = new Set(bom_op.map((b) => b.componente_code).filter(Boolean))
    let match = 0
    for (const c of codesMaestro) {
      if (codesOp.has(c)) match += 1
    }
    const extrasOp = [...codesOp].filter((c) => !codesMaestro.has(c)).length
    const faltanEnOp = [...codesMaestro].filter((c) => !codesOp.has(c)).length
    let aviso_bom: string | null = null
    if (bom_op.length > 0 && (extrasOp > 0 || faltanEnOp > 0)) {
      aviso_bom =
        `Receta = Lista de materiales SAP (${codesMaestro.size} ítems). `
        + `OP difiere: ${faltanEnOp} en LMat sin par en OP; `
        + `${extrasOp} en OP que no están en LMat. Filas en rojo.`
    }
    return {
      bom: bomMaestro,
      fuente: 'maestro',
      aviso_bom,
      bom_maestro: bomMaestro,
      bom_op,
    }
  }

  if (bom_op.length) {
    return {
      bom: bom_op,
      fuente: 'op_wor1',
      aviso_bom:
        'Sin Lista de materiales (VW_BI_RECETA_COSTO / OITT+ITT1) para esta receta. '
        + 'Fallback: componentes de la OP (WOR1). Ejecute scripts/sql/VW_BI_RECETA_COSTO.sql en HANA.',
      bom_maestro: [],
      bom_op,
    }
  }

  return {
    bom: [],
    fuente: 'maestro',
    aviso_bom: 'Sin Lista de materiales ni componentes de OP para armar la receta.',
    bom_maestro: [],
    bom_op: [],
  }
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

  const qtyProdPorReceta = new Map<string, { qty: number; costo: number; ordenes: Set<string> }>()
  for (const p of produccion) {
    if (!p.receta_code || p.componente_code) continue
    const prev = qtyProdPorReceta.get(p.receta_code) ?? {
      qty: 0,
      costo: 0,
      ordenes: new Set<string>(),
    }
    const opKey = p.orden || p.orden_id || `${p.fecha}|${p.costo}`
    if (!prev.ordenes.has(opKey)) {
      prev.qty += p.cantidad > 0 ? p.cantidad : 0
      prev.costo += p.costo
      prev.ordenes.add(opKey)
    }
    qtyProdPorReceta.set(p.receta_code, prev)
  }

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
      qty_producida: 0,
      var_qty: 0,
      var_qty_pct: 0,
      venta: 0,
      costo_produccion: 0,
      costo_teorico: 0,
      variacion: 0,
      variacion_pct: 0,
      margen: 0,
      margen_pct: 0,
      registros: 0,
      costo_op: 0,
      ordenes: 0,
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

  const allPorReceta = [...porRecetaMap.values()].map((r) => {
      const prod = qtyProdPorReceta.get(r.receta_code)
      const qty_producida = prod?.qty ?? 0
      const costo_op = prod?.costo ?? 0
      const var_qty = qty_producida - r.cantidad
      const costoProd = costo_op > 0 ? costo_op : r.costo_produccion
      const var_monto = r.venta - costoProd
      return {
        ...r,
        receta_nombre: clipStr(r.receta_nombre, 80),
        qty_producida,
        var_qty,
        var_qty_pct: r.cantidad > 0 ? (var_qty / r.cantidad) * 100 : 0,
        costo_op,
        costo_produccion: costoProd,
        variacion: var_monto,
        variacion_pct: r.venta > 0 ? (var_monto / r.venta) * 100 : 0,
        margen: var_monto,
        margen_pct: r.venta > 0 ? (var_monto / r.venta) * 100 : 0,
        ordenes: prod?.ordenes.size ?? 0,
      }
    })
  const por_receta = [...allPorReceta]
    .sort((a, b) => b.venta - a.venta)
    .slice(0, MAX_POR_RECETA)

  const total_venta = allPorReceta.reduce((s, r) => s + r.venta, 0)
  const total_costo = allPorReceta.reduce((s, r) => s + r.costo_produccion, 0)
  const total_margen = allPorReceta.reduce((s, r) => s + r.margen, 0)
  const total_costo_teorico = allPorReceta.reduce((s, r) => s + r.costo_teorico, 0)
  const total_variacion = total_margen
  const total_qty_vendida = allPorReceta.reduce((s, r) => s + r.cantidad, 0)
  const total_qty_producida = allPorReceta.reduce((s, r) => s + r.qty_producida, 0)

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
      variacion_pct: total_venta > 0 ? (total_variacion / total_venta) * 100 : 0,
      total_qty_vendida,
      total_qty_producida,
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
    orden_produccion: clipStr(normOp(r.orden_produccion), 40),
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

const MAX_FACTURAS_ENLACE = 200
const MAX_LINEAS_POR_FACTURA = 40

export type EnlaceFacturaDetalle = VentaOpRelacion & {
  costo_teorico: number
  costo_teorico_unit: number
  /** Costo OP − teórico (positivo = producción más cara que BOM). */
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
  match_mejor: VentaOpRelacion['match']
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

function rankMatch(m: VentaOpRelacion['match']): number {
  switch (m) {
    case 'orden':
      return 4
    case 'receta_periodo':
      return 3
    case 'receta':
      return 2
    default:
      return 1
  }
}

/** Agrupa venta↔OP por factura y compara costo teórico (BOM) vs costo producción. */
export function aggregateEnlaceFactura(
  ventas: VentaMargenRow[],
  produccion: ProduccionLinea[],
  recetasCosto: Map<string, RecetaCostoRow>,
  meta: {
    vista: string
    ultimo_sync: string | null
    campos_venta?: Record<string, string>
    produccion_ok?: boolean
    produccion_error?: string | null
  },
): EnlaceFacturaPayload {
  const analisisRows: VentaAnalisisRow[] = ventas.map((row) => {
    const unit = recetasCosto.get(row.receta_code)?.costo ?? 0
    const qty = row.cantidad > 0 ? row.cantidad : 1
    const costo_teorico = unit * qty
    return {
      ...row,
      costo_teorico_unit: unit,
      costo_teorico,
      variacion: row.costo - costo_teorico,
      variacion_pct: costo_teorico > 0 ? ((row.costo - costo_teorico) / costo_teorico) * 100 : 0,
      margen_pct: row.venta > 0 ? (row.margen / row.venta) * 100 : 0,
    }
  })

  const teoricoByVentaKey = new Map<string, { unit: number; total: number }>()
  for (const row of analisisRows) {
    const vk = `${row.factura}|${row.receta_code}|${row.fecha}|${row.cantidad}|${row.venta}|${row.costo}`
    teoricoByVentaKey.set(vk, {
      unit: row.costo_teorico_unit,
      total: row.costo_teorico,
    })
  }

  const relaciones = buildRelacionVentaOp(analisisRows, produccion)
  const byFactura = new Map<string, EnlaceFacturaDetalle[]>()
  for (const r of relaciones) {
    const vk = `${r.factura}|${r.receta_code}|${r.fecha_venta}|${r.cantidad_venta}|${r.venta}|${r.costo_venta}`
    const teorico = teoricoByVentaKey.get(vk) ?? {
      unit: recetasCosto.get(r.receta_code)?.costo ?? 0,
      total: (recetasCosto.get(r.receta_code)?.costo ?? 0) * (r.cantidad_venta > 0 ? r.cantidad_venta : 1),
    }
    const costo_teorico = teorico.total
    const variacion_op_vs_teorico = r.costo_op - costo_teorico
    const enriched: EnlaceFacturaDetalle = {
      ...r,
      costo_teorico,
      costo_teorico_unit: teorico.unit,
      variacion_op_vs_teorico,
      variacion_op_vs_teorico_pct:
        costo_teorico > 0 ? (variacion_op_vs_teorico / costo_teorico) * 100 : 0,
    }
    const key = (r.factura || '').trim() || '(sin factura)'
    const list = byFactura.get(key) ?? []
    list.push(enriched)
    byFactura.set(key, list)
  }

  const facturas: EnlaceFacturaGrupo[] = [...byFactura.entries()]
    .map(([factura, detalle]) => {
      const first = detalle[0]
      const ordenes = [
        ...new Set(detalle.map((d) => d.orden_produccion).filter(Boolean)),
      ]
      let match_mejor: VentaOpRelacion['match'] = 'sin_op'
      for (const d of detalle) {
        if (rankMatch(d.match) > rankMatch(match_mejor)) match_mejor = d.match
      }
      const ventaKeys = new Set<string>()
      let venta_total = 0
      let costo_venta_total = 0
      let costo_teorico_total = 0
      let cantidad_venta = 0
      let lineas_venta = 0
      for (const d of detalle) {
        const vk = `${d.receta_code}|${d.fecha_venta}|${d.cantidad_venta}|${d.venta}|${d.costo_venta}`
        if (ventaKeys.has(vk)) continue
        ventaKeys.add(vk)
        venta_total += d.venta
        costo_venta_total += d.costo_venta
        costo_teorico_total += d.costo_teorico
        cantidad_venta += d.cantidad_venta
        lineas_venta += 1
      }
      // OP: sumar por orden única para no inflar si hay varias líneas de venta
      const opKeys = new Set<string>()
      let costo_op_total = 0
      let cantidad_op = 0
      for (const d of detalle) {
        if (d.match === 'sin_op' || !d.orden_produccion) {
          if (d.match !== 'sin_op') {
            costo_op_total += d.costo_op
            cantidad_op += d.cantidad_op
          }
          continue
        }
        const ok = `${d.orden_produccion}|${d.fecha_op}|${d.costo_op}`
        if (opKeys.has(ok)) continue
        opKeys.add(ok)
        costo_op_total += d.costo_op
        cantidad_op += d.cantidad_op
      }
      const variacion_op_vs_teorico = costo_op_total - costo_teorico_total
      return {
        factura,
        fecha: first?.fecha_venta ?? null,
        periodo: first?.periodo ?? '',
        codigo_cliente: first?.codigo_cliente ?? '',
        cliente: first?.cliente ?? '',
        lineas_venta,
        venta_total,
        costo_venta_total,
        costo_teorico_total,
        costo_op_total,
        variacion_op_vs_teorico,
        variacion_op_vs_teorico_pct:
          costo_teorico_total > 0
            ? (variacion_op_vs_teorico / costo_teorico_total) * 100
            : 0,
        cantidad_venta,
        cantidad_op,
        ordenes,
        match_mejor,
        detalle: detalle.slice(0, MAX_LINEAS_POR_FACTURA),
      }
    })
    .sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha).getTime() : 0
      const db = b.fecha ? new Date(b.fecha).getTime() : 0
      return db - da
    })

  const truncated = facturas.length > MAX_FACTURAS_ENLACE
  const shown = facturas.slice(0, MAX_FACTURAS_ENLACE)

  const costo_teorico_total = shown.reduce((s, f) => s + f.costo_teorico_total, 0)
  const costo_op_total = shown.reduce((s, f) => s + f.costo_op_total, 0)
  const variacion_op_vs_teorico = costo_op_total - costo_teorico_total

  const resumen = {
    facturas: shown.length,
    con_op: shown.filter((f) => f.match_mejor !== 'sin_op').length,
    sin_op: shown.filter((f) => f.match_mejor === 'sin_op').length,
    por_orden: shown.filter((f) => f.match_mejor === 'orden').length,
    por_receta: shown.filter(
      (f) => f.match_mejor === 'receta' || f.match_mejor === 'receta_periodo',
    ).length,
    venta_total: shown.reduce((s, f) => s + f.venta_total, 0),
    costo_venta_total: shown.reduce((s, f) => s + f.costo_venta_total, 0),
    costo_teorico_total,
    costo_op_total,
    variacion_op_vs_teorico,
    variacion_op_vs_teorico_pct:
      costo_teorico_total > 0 ? (variacion_op_vs_teorico / costo_teorico_total) * 100 : 0,
    lineas: shown.reduce((s, f) => s + f.lineas_venta, 0),
  }

  return {
    resumen,
    facturas: shown,
    campos_venta: meta.campos_venta,
    tiene_factura: Boolean(meta.campos_venta?.factura),
    tiene_orden_venta: Boolean(meta.campos_venta?.orden_produccion),
    produccion_ok: meta.produccion_ok,
    produccion_error: meta.produccion_error ?? null,
    ultimo_sync: meta.ultimo_sync,
    vista: meta.vista,
    filas_leidas: ventas.length,
    aviso: truncated
      ? `Mostrando ${MAX_FACTURAS_ENLACE} de ${facturas.length} facturas. Afine el número de factura o las fechas.`
      : null,
  }
}

/** Comparación OP vs receta (BOM) por muestra, filtrada por ventas del cliente. */
/* qty teórica: preferir CantPlan WOR1 para no doblar × qty PT */
export type OpVsRecetaIngrediente = {
  componente_code: string
  componente_nombre: string
  unidad: string
  qty_por_unidad: number
  /** Precio unitario (BOM / receta). */
  costo_unitario: number
  qty_teorica: number
  costo_teorico: number
  qty_plan: number | null
  costo_plan: number | null
  /** Precio usado en Real (mismo criterio: unitario BOM o derivado). */
  precio_real: number | null
  qty_real: number | null
  /** Siempre precio_real × qty_real cuando hay cantidad. */
  costo_real: number | null
  var_qty: number | null
  var_qty_pct: number | null
  var_costo: number | null
  var_costo_pct: number | null
  /** Ingrediente en receta sin par en OP, o componente OP que no está en la receta. */
  alerta_receta?: 'falta_en_op' | 'extra_en_op' | null
}

export type OpVsRecetaOrden = {
  orden: string
  /** DocEntry SAP de la OP. */
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
  /** Ingredientes de la receta escalados a la qty de esta OP (+ real si hay consumo). */
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

function costoUnitarioBom(bom: IngredienteRow[]): number {
  return bom.reduce((s, ing) => {
    if (ing.costo_unitario > 0) return s + ing.costo_unitario * ing.cantidad
    return s + (ing.costo_teorico || 0)
  }, 0)
}

/** Totales alineados con la tabla: costo = Σ (precio × qty) por ingrediente. */
function totalesDesdeIngredientes(ings: OpVsRecetaIngrediente[]): {
  costo_teorico: number
  costo_real: number
  tiene_real: boolean
  var_costo: number
  var_costo_pct: number
} {
  let costo_teorico = 0
  let costo_real = 0
  let tiene_real = false
  for (const i of ings) {
    costo_teorico += i.costo_teorico || 0
    if (i.qty_real != null && !i.alerta_receta) {
      tiene_real = true
      costo_real += i.costo_real ?? 0
    }
  }
  // Si hubo algún real, el total real es la suma (líneas sin real = 0 frente al BOM)
  // Si no hubo real, costo_real queda 0 y el caller puede usar fallback SAP.
  const var_costo = costo_real - costo_teorico
  return {
    costo_teorico,
    costo_real,
    tiene_real,
    var_costo,
    var_costo_pct: costo_teorico > 0 ? (var_costo / costo_teorico) * 100 : 0,
  }
}

type ConsumoRealAgg = {
  qty: number
  costo: number
  qty_plan: number
  costo_plan: number
  nombre: string
  unidad: string
}

function findRealMapForOrden(
  orden: string,
  ordenId: string | undefined,
  realByOrdenComp: Map<string, ReturnType<typeof accumulateConsumoReal>>,
  consumoLines: ProduccionLinea[],
): ReturnType<typeof accumulateConsumoReal> | null {
  const keys = [
    opDocNum(orden),
    normOp(orden),
    ordenId ? opDocNum(ordenId) : '',
    ordenId ? normOp(ordenId) : '',
  ].filter(Boolean)
  for (const k of keys) {
    const hit = realByOrdenComp.get(k)
    if (hit && hit.size > 0) return hit
  }
  for (const [k, map] of realByOrdenComp) {
    if (map.size > 0 && keys.some((key) => ordenMatches(key, k, undefined))) return map
  }
  const filtered = consumoLines.filter(
    (c) =>
      keys.some((key) => ordenMatches(key, c.orden, c.orden_id))
      || (ordenId && normOp(c.orden_id) === normOp(ordenId)),
  )
  return filtered.length ? accumulateConsumoReal(filtered) : null
}

function buildOpVsIngredientes(
  bom: IngredienteRow[],
  baseQty: number,
  realByComp: Map<string, ConsumoRealAgg> | null,
): OpVsRecetaIngrediente[] {
  const canCompare = realByComp != null && realByComp.size > 0
  const bomCodes = new Set(bom.map((b) => b.componente_code?.trim()).filter(Boolean))

  const ingredientes: OpVsRecetaIngrediente[] = bom.map((ing) => {
    const code = ing.componente_code?.trim()
    const real = canCompare && code ? realByComp!.get(code) : undefined
    const alerta_receta =
      canCompare && code && !real ? ('falta_en_op' as const) : null

    const qty_plan = real && real.qty_plan > 0 ? real.qty_plan : null
    const costo_plan = real && real.costo_plan > 0 ? real.costo_plan : null
    const qty_real = real ? real.qty : null

    // Teórico = Cantidad de Lista de materiales (ITT1), igual que pantalla SAP.
    // No multiplicar otra vez por qty OP: en LMat ya está la qty por la base del BOM
    // (OITT.Qauntity, normalmente 1). Escalar rompe el match (2→4, 200→400).
    const qty_por_unidad = ing.cantidad
    const qty_teorica = ing.cantidad

    const costo_linea_bom =
      ing.costo_teorico > 0
        ? ing.costo_teorico
        : ing.costo_unitario > 0 && ing.cantidad > 0
          ? ing.costo_unitario * ing.cantidad
          : 0

    // Precio teórico: de LMat. Si recurso sin StdCost, dejar 0 (SIN_COSTO).
    const costo_unitario = ing.costo_unitario > 0 ? ing.costo_unitario : 0
    const costo_teorico =
      costo_linea_bom > 0
        ? costo_linea_bom
        : costo_unitario > 0 && qty_teorica > 0
          ? costo_unitario * qty_teorica
          : 0

    // Precio real: LMat si hay; si no, plan/emisión OP (recursos SV-*).
    let precio_real: number | null = null
    if (costo_unitario > 0) {
      precio_real = costo_unitario
    } else if (qty_plan != null && costo_plan != null && qty_plan > 0) {
      precio_real = costo_plan / qty_plan
    } else if (real && real.qty > 0 && real.costo > 0) {
      precio_real = real.costo / real.qty
    }
    const costo_real =
      qty_real != null && precio_real != null
        ? precio_real * qty_real
        : qty_real != null
          ? 0
          : null
    const var_qty =
      !alerta_receta && qty_real != null ? qty_real - qty_teorica : null
    const var_costo =
      !alerta_receta && costo_real != null ? costo_real - costo_teorico : null
    return {
      componente_code: ing.componente_code,
      componente_nombre: ing.componente_nombre,
      unidad: ing.unidad || real?.unidad || '',
      qty_por_unidad,
      costo_unitario,
      qty_teorica,
      costo_teorico,
      qty_plan,
      costo_plan,
      precio_real,
      qty_real,
      costo_real,
      var_qty,
      var_qty_pct:
        var_qty != null && qty_teorica > 0 ? (var_qty / qty_teorica) * 100 : null,
      var_costo,
      var_costo_pct:
        var_costo != null && costo_teorico > 0 ? (var_costo / costo_teorico) * 100 : null,
      alerta_receta,
    }
  })

  if (canCompare) {
    for (const [k, real] of realByComp!) {
      if (bomCodes.has(k)) continue
      const precio_real =
        real.qty_plan > 0 && real.costo_plan > 0
          ? real.costo_plan / real.qty_plan
          : real.qty > 0 && real.costo > 0
            ? real.costo / real.qty
            : 0
      const costo_real = precio_real > 0 ? precio_real * real.qty : real.costo
      ingredientes.push({
        componente_code: k,
        componente_nombre: real.nombre,
        unidad: real.unidad,
        qty_por_unidad: 0,
        costo_unitario: precio_real,
        qty_teorica: 0,
        costo_teorico: 0,
        qty_plan: real.qty_plan > 0 ? real.qty_plan : null,
        costo_plan: real.costo_plan > 0 ? real.costo_plan : null,
        precio_real: precio_real > 0 ? precio_real : null,
        qty_real: real.qty,
        costo_real,
        var_qty: null,
        var_qty_pct: null,
        var_costo: null,
        var_costo_pct: null,
        alerta_receta: 'extra_en_op',
      })
    }
  }

  return ingredientes
}

function accumulateConsumoReal(lines: ProduccionLinea[]): Map<string, ConsumoRealAgg> {
  const realByComp = new Map<string, ConsumoRealAgg>()
  for (const c of lines) {
    if (!c.componente_code && !c.componente_nombre) continue
    const k = c.componente_code || c.componente_nombre || ''
    if (!k) continue
    const prev = realByComp.get(k) ?? {
      qty: 0,
      costo: 0,
      qty_plan: 0,
      costo_plan: 0,
      nombre: c.componente_nombre || k,
      unidad: c.unidad || '',
    }
    prev.qty += c.cantidad
    prev.costo += c.costo
    prev.qty_plan += c.cantidad_plan ?? 0
    prev.costo_plan += c.costo_plan ?? 0
    if (c.componente_nombre) prev.nombre = c.componente_nombre
    if (c.unidad) prev.unidad = c.unidad
    realByComp.set(k, prev)
  }
  return realByComp
}

/** Detalle de una OP: cabecera + BOM teórico × qty + variación vs costo real. */
export type ProduccionOrdenDetalle = {
  orden: string
  /** DocEntry interno de la OP. */
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
  /** Componentes BOM con qty/costo real > vacío. */
  ingredientes_con_consumo: number
  ingredientes_bom: number
  /** Filas con código distinto entre receta y OP. */
  ingredientes_alerta_receta?: number
  /** BOM desde VW_BI_RECETA_COSTO (puede diferir de WOR1). */
  bom_maestro?: IngredienteRow[]
  /** BOM reconstruido desde WOR1 (pestaña Contenido SAP). */
  bom_op?: IngredienteRow[]
  receta_fuente?: 'maestro' | 'op_wor1'
  aviso_bom?: string | null
  aviso: string | null
}

export function buildProduccionOrdenDetalle(
  orden: string,
  lineas: ProduccionLinea[],
  bom: IngredienteRow[],
  _opts?: { tiene_componente_en_vista?: boolean },
): ProduccionOrdenDetalle | null {
  const key = orden.trim().toLowerCase()
  const ofOrden = lineas.filter((l) => ordenMatches(orden, l.orden, l.orden_id))
  if (!ofOrden.length) return null

  const headerLines = ofOrden.filter((l) => !l.componente_code)
  const consumoLines = ofOrden.filter((l) => Boolean(l.componente_code))
  const tiene_consumo_real = consumoLines.length > 0

  let cantidad = 0
  let costo = 0
  if (headerLines.length) {
    for (const h of headerLines) {
      cantidad += h.cantidad > 0 ? h.cantidad : 0
      costo += h.costo
    }
  } else if (consumoLines.length) {
    const pt = consumoLines.find((l) => (l.cantidad_producto ?? 0) > 0)?.cantidad_producto
    if (pt && pt > 0) cantidad = pt
    for (const l of consumoLines) {
      costo += l.costo
    }
  } else {
    for (const l of ofOrden) {
      if (!l.componente_code) {
        cantidad += l.cantidad > 0 ? l.cantidad : 0
        costo += l.costo
      } else {
        costo += l.costo
      }
    }
  }

  const realByComp = tiene_consumo_real ? accumulateConsumoReal(consumoLines) : null

  const baseQty = cantidad > 0 ? cantidad : 0
  const bomPick = pickBomParaOp(bom, consumoLines, baseQty)
  const bomUsado = bomPick.bom
  const unitBom = costoUnitarioBom(bomUsado)
  const ingredientes = buildOpVsIngredientes(bomUsado, baseQty, realByComp)
  const totIng = totalesDesdeIngredientes(ingredientes)

  // Unificar con la tabla: teórico = Σ BOM; real = Σ (precio × qty real)
  const costo_teorico = totIng.costo_teorico > 0 ? totIng.costo_teorico : unitBom * baseQty
  if (totIng.tiene_real) {
    costo = totIng.costo_real
  } else if (tiene_consumo_real && realByComp && costo <= 0) {
    costo = [...realByComp.values()].reduce((s, x) => s + x.costo, 0)
  }
  const var_costo = costo - costo_teorico

  const cab = headerLines[0] ?? ofOrden[0]
  const bomCodes = bomUsado.map((b) => b.componente_code).filter(Boolean)
  const ingredientes_bom = bomCodes.length
  const ingredientes_con_consumo = ingredientes.filter(
    (i) => bomCodes.includes(i.componente_code) && i.qty_real != null && !i.alerta_receta,
  ).length
  const alertasReceta = ingredientes.filter((i) => i.alerta_receta)
  const ingredientes_alerta_receta = alertasReceta.length

  let aviso: string | null = bomPick.aviso_bom
  if (!tiene_consumo_real) {
    aviso = [
      bomPick.aviso_bom,
      'Sin filas de consumo/detalle por componente para esta OP. Solo se muestra costo teórico BOM × qty.',
    ]
      .filter(Boolean)
      .join(' ')
  } else if (bomPick.fuente === 'maestro' && ingredientes_alerta_receta > 0) {
    const falta = alertasReceta.filter((i) => i.alerta_receta === 'falta_en_op').length
    const extra = alertasReceta.filter((i) => i.alerta_receta === 'extra_en_op').length
    const partes: string[] = []
    if (falta > 0) partes.push(`${falta} en Lista de materiales sin par en OP`)
    if (extra > 0) partes.push(`${extra} en OP que no están en Lista de materiales`)
    aviso = [
      bomPick.aviso_bom,
      `Ingredientes distintos: ${partes.join('; ')}. Revise filas en rojo.`,
    ]
      .filter(Boolean)
      .join(' ')
  } else if (ingredientes_bom > 0 && ingredientes_con_consumo < ingredientes_bom) {
    aviso =
      `Consumo parcial en SAP: ${ingredientes_con_consumo} de ${ingredientes_bom} componentes del BOM `
      + `tienen emisión. Costo real = Σ (precio × qty real); líneas sin emisión aportan 0.`
  }
  if (baseQty <= 0) {
    aviso = [aviso, 'Sin cantidad producida en cabecera; no se pudo escalar el BOM.']
      .filter(Boolean)
      .join(' ')
  }

  return {
    orden: (headerLines[0]?.orden || ofOrden[0]?.orden || orden).trim(),
    orden_id: (headerLines[0]?.orden_id || ofOrden[0]?.orden_id || '').trim() || undefined,
    receta_code: cab.receta_code,
    receta_nombre: cab.receta_nombre || cab.receta_code,
    fecha: cab.fecha,
    estado: cab.estado,
    almacen: cab.almacen,
    cantidad,
    costo,
    costo_teorico,
    var_costo,
    var_costo_pct: costo_teorico > 0 ? (var_costo / costo_teorico) * 100 : 0,
    costo_unitario_bom: unitBom,
    lineas: [...ofOrden].sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha).getTime() : 0
      const db = b.fecha ? new Date(b.fecha).getTime() : 0
      return db - da
    }),
    ingredientes,
    tiene_consumo_real,
    ingredientes_con_consumo,
    ingredientes_bom,
    ingredientes_alerta_receta,
    bom_maestro: bomPick.bom_maestro,
    bom_op: bomPick.bom_op,
    receta_fuente: bomPick.fuente,
    aviso_bom: bomPick.aviso_bom,
    aviso,
  }
}

export function aggregateOpVsRecetaPorMuestra(
  ventasCliente: VentaMargenRow[],
  ingredientesPorReceta: Map<string, IngredienteRow[]>,
  produccion: ProduccionLinea[],
  meta: {
    codigo_cliente: string
    cliente: string
    vista: string
    ultimo_sync: string | null
    campos_produccion?: Record<string, string>
    produccion_ok?: boolean
    produccion_error?: string | null
  },
): OpVsRecetaPayload {
  const porMuestraVenta = new Map<
    string,
    { receta_nombre: string; qty_vendida: number; venta_total: number; costo_venta: number }
  >()
  /** OPs referenciadas en ventas del cliente (si VW_BI_VENTA_COSTO trae orden_produccion). */
  const opsPorReceta = new Map<string, Set<string>>()
  let ventasConOp = 0
  for (const v of ventasCliente) {
    const code = v.receta_code.trim()
    if (!code) continue
    const prev = porMuestraVenta.get(code) ?? {
      receta_nombre: v.receta_nombre,
      qty_vendida: 0,
      venta_total: 0,
      costo_venta: 0,
    }
    prev.qty_vendida += v.cantidad > 0 ? v.cantidad : 1
    prev.venta_total += v.venta
    prev.costo_venta += v.costo
    if (!prev.receta_nombre && v.receta_nombre) prev.receta_nombre = v.receta_nombre
    porMuestraVenta.set(code, prev)

    if (v.orden_produccion) {
      ventasConOp += 1
      const set = opsPorReceta.get(code) ?? new Set<string>()
      set.add(opDocNum(v.orden_produccion))
      opsPorReceta.set(code, set)
    }
  }

  const codigoClienteNorm = (meta.codigo_cliente || '').trim().toLowerCase()
  const clienteNorm = (meta.cliente || '').trim().toLowerCase()
  const headersProd = produccion.filter((p) => !p.componente_code)
  const conClienteN = headersProd.filter((p) => Boolean(p.codigo_cliente || p.cliente)).length
  const produccionConCliente =
    headersProd.length > 0 && conClienteN / headersProd.length >= 0.5

  let tieneAlgunConsumoReal = false
  let usoQtyVendidaSinOp = false
  const filtroPorOpVenta = ventasConOp > 0

  const prodByReceta = new Map<string, ProduccionLinea[]>()
  for (const p of produccion) {
    if (!p.receta_code) continue
    // Si hay OrdenProd en ventas, no filtrar por ClienteOrden (en SAP casi siempre vacío).
    if (produccionConCliente && !filtroPorOpVenta) {
      const code = (p.codigo_cliente || '').trim().toLowerCase()
      const name = (p.cliente || '').trim().toLowerCase()
      if (!code && !name) continue
      const okCode = Boolean(codigoClienteNorm && code === codigoClienteNorm)
      const okName = Boolean(clienteNorm && name.includes(clienteNorm))
      if (!okCode && !okName) continue
    }
    const list = prodByReceta.get(p.receta_code) ?? []
    list.push(p)
    prodByReceta.set(p.receta_code, list)
  }

  type OrdenAcc = {
    orden: string
    orden_id: string
    fecha: string | null
    cantidad: number
    costo: number
    estado: string
  }

  const muestras: OpVsRecetaMuestra[] = []
  for (const [code, venta] of porMuestraVenta) {
    let lines = prodByReceta.get(code) ?? []
    const bom = ingredientesPorReceta.get(code) ?? []
    const unitBom = costoUnitarioBom(bom)

    // Si la venta trae OP, quedarse solo con esas órdenes (pegar venta ↔ producción del cliente)
    const opsVenta = opsPorReceta.get(code)
    if (opsVenta && opsVenta.size > 0) {
      lines = lines.filter(
        (l) =>
          (l.orden && opsVenta.has(opDocNum(l.orden)))
          || (l.orden_id && opsVenta.has(opDocNum(l.orden_id))),
      )
    } else if (!produccionConCliente && !filtroPorOpVenta) {
      // Sin vínculo factura→OP ni ClienteOrden: no sumar OPs globales de la receta
      lines = []
      usoQtyVendidaSinOp = true
    }

    const headerLines = lines.filter((l) => !l.componente_code)
    const consumoLines = lines.filter((l) => Boolean(l.componente_code))
    const tiene_consumo_real = consumoLines.length > 0
    if (tiene_consumo_real) tieneAlgunConsumoReal = true

    const ordenAcc = new Map<string, OrdenAcc>()
    if (headerLines.length) {
      for (const h of headerLines) {
        const key = h.orden || `${h.fecha}|${h.costo}`
        const prev = ordenAcc.get(key) ?? {
          orden: h.orden || '—',
          orden_id: h.orden_id || '',
          fecha: h.fecha,
          cantidad: 0,
          costo: 0,
          estado: h.estado,
        }
        if (!prev.orden_id && h.orden_id) prev.orden_id = h.orden_id
        prev.cantidad += h.cantidad > 0 ? h.cantidad : 0
        prev.costo += h.costo
        ordenAcc.set(key, prev)
      }
    } else {
      for (const l of lines) {
        const key = l.orden || 'sin-orden'
        const prev = ordenAcc.get(key) ?? {
          orden: l.orden || '—',
          orden_id: l.orden_id || '',
          fecha: l.fecha,
          cantidad: 0,
          costo: 0,
          estado: l.estado,
        }
        if (!prev.orden_id && l.orden_id) prev.orden_id = l.orden_id
        if (!l.componente_code) {
          prev.cantidad += l.cantidad > 0 ? l.cantidad : 0
          prev.costo += l.costo
        } else {
          prev.costo += l.costo
        }
        ordenAcc.set(key, prev)
      }
    }

    for (const c of consumoLines) {
      const key = c.orden || 'sin-orden'
      const prev = ordenAcc.get(key)
      if (prev && !prev.orden_id && c.orden_id) prev.orden_id = c.orden_id
    }

    const realByCompAll = tiene_consumo_real ? accumulateConsumoReal(consumoLines) : null
    const realByOrdenComp = new Map<
      string,
      ReturnType<typeof accumulateConsumoReal>
    >()
    if (tiene_consumo_real) {
      const byOrden = new Map<string, ProduccionLinea[]>()
      for (const c of consumoLines) {
        const ok =
          opDocNum(c.orden)
          || opDocNum(c.orden_id)
          || normOp(c.orden)
          || 'sin-orden'
        const list = byOrden.get(ok) ?? []
        list.push(c)
        byOrden.set(ok, list)
      }
      for (const [ok, list] of byOrden) {
        realByOrdenComp.set(ok, accumulateConsumoReal(list))
      }
    }

    let qty_producida = [...ordenAcc.values()].reduce((s, o) => s + o.cantidad, 0)
    let costo_op = [...ordenAcc.values()].reduce((s, o) => s + o.costo, 0)
    if (tiene_consumo_real && costo_op <= 0 && realByCompAll) {
      costo_op = [...realByCompAll.values()].reduce((s, x) => s + x.costo, 0)
    }

    // Sin OPs del cliente: la qty del análisis = qty vendida al cliente (pega con la venta)
    const sinOpCliente = ordenAcc.size === 0
    if (sinOpCliente) {
      qty_producida = venta.qty_vendida
      usoQtyVendidaSinOp = true
    }

    const baseQty = qty_producida > 0 ? qty_producida : venta.qty_vendida

    const bomPickMuestra = pickBomParaOp(bom, consumoLines, baseQty)

    const ordenes: OpVsRecetaOrden[] = [...ordenAcc.values()]
      .map((o) => {
        const qty = o.cantidad > 0 ? o.cantidad : 0
        const ordenConsumo = consumoLines.filter(
          (c) =>
            ordenMatches(o.orden, c.orden, c.orden_id)
            || (o.orden_id && normOp(c.orden_id) === normOp(o.orden_id)),
        )
        const bomPickOrden = pickBomParaOp(bom, ordenConsumo, qty > 0 ? qty : 0)
        const realMap =
          tiene_consumo_real
            ? findRealMapForOrden(o.orden, o.orden_id || undefined, realByOrdenComp, consumoLines)
              ?? (o.orden === '—' ? realByCompAll : null)
            : null
        const ingredientes = buildOpVsIngredientes(
          bomPickOrden.bom,
          qty > 0 ? qty : 0,
          realMap && realMap.size > 0 ? realMap : null,
        )
        const tot = totalesDesdeIngredientes(ingredientes)
        const costo_teorico = tot.costo_teorico > 0 ? tot.costo_teorico : unitBom * qty
        const costo = tot.tiene_real ? tot.costo_real : o.costo
        const var_costo = costo - costo_teorico
        return {
          orden: o.orden,
          orden_id: o.orden_id || undefined,
          fecha: o.fecha,
          cantidad: o.cantidad,
          costo,
          costo_teorico,
          var_costo,
          var_costo_pct: costo_teorico > 0 ? (var_costo / costo_teorico) * 100 : 0,
          estado: o.estado,
          ingredientes,
        }
      })
      .sort((a, b) => {
        const da = a.fecha ? new Date(a.fecha).getTime() : 0
        const db = b.fecha ? new Date(b.fecha).getTime() : 0
        return db - da
      })

    const ingredientes = buildOpVsIngredientes(bomPickMuestra.bom, baseQty, realByCompAll)
    const totMuestra = totalesDesdeIngredientes(ingredientes)

    let costo_teorico =
      totMuestra.costo_teorico > 0
        ? totMuestra.costo_teorico
        : unitBom * baseQty

    if (totMuestra.tiene_real) {
      costo_op = totMuestra.costo_real
    } else if (sinOpCliente) {
      // Sin OP del cliente: costo real = costo atribuido en ventas (CostoReal)
      costo_op = venta.costo_venta
      costo_teorico = unitBom * venta.qty_vendida
    } else if (ordenes.some((o) => o.ingredientes.some((i) => i.qty_real != null))) {
      costo_op = ordenes.reduce((s, o) => s + o.costo, 0)
    }

    const var_costo = costo_op - costo_teorico
    const var_qty = qty_producida - venta.qty_vendida

    muestras.push({
      receta_code: code,
      receta_nombre: venta.receta_nombre || code,
      qty_vendida: venta.qty_vendida,
      venta_total: venta.venta_total,
      qty_producida,
      costo_op,
      costo_teorico,
      var_costo,
      var_costo_pct: costo_teorico > 0 ? (var_costo / costo_teorico) * 100 : 0,
      var_qty,
      var_qty_pct: venta.qty_vendida > 0 ? (var_qty / venta.qty_vendida) * 100 : 0,
      costo_unitario_bom: unitBom,
      ordenes,
      ingredientes,
      tiene_consumo_real: totMuestra.tiene_real,
    })
  }

  muestras.sort((a, b) => b.venta_total - a.venta_total)

  const costo_teorico = muestras.reduce((s, m) => s + m.costo_teorico, 0)
  const costo_op = muestras.reduce((s, m) => s + m.costo_op, 0)
  const var_costo = costo_op - costo_teorico

  const avisoParts: string[] = []
  if (filtroPorOpVenta) {
    avisoParts.push(
      `Producción filtrada por OrdenProd de las facturas del cliente (${ventasConOp} línea(s) con OP). `
      + 'Las líneas de venta sin OP usan qty vendida para el teórico.',
    )
  } else if (usoQtyVendidaSinOp) {
    avisoParts.push(
      'Qty producida = qty vendida al cliente: no hay OrdenProd en las ventas de este rango. '
      + 'Use VW_BI_VENTA_COSTO_OP o llene ClienteOrden en VW_BI_PRODUCCION.',
    )
  } else if (produccionConCliente) {
    avisoParts.push(
      'Producción filtrada por ClienteOrden / cliente de la OP (solo OPs de este cliente).',
    )
  }
  if (muestras.length > 0 && !tieneAlgunConsumoReal && !usoQtyVendidaSinOp) {
    avisoParts.push(
      'Sin consumo real por componente. Se muestra teórico BOM × qty de las OPs del cliente.',
    )
  } else if (tieneAlgunConsumoReal) {
    avisoParts.push(
      'Consumo real por componente (qty emitida × precio vs BOM teórico).',
    )
  }

  return {
    resumen: {
      muestras: muestras.length,
      con_produccion: muestras.filter((m) => m.qty_producida > 0 || m.costo_op > 0).length,
      sin_produccion: muestras.filter((m) => m.qty_producida <= 0 && m.costo_op <= 0).length,
      con_consumo_real: muestras.filter((m) => m.tiene_consumo_real).length,
      qty_vendida: muestras.reduce((s, m) => s + m.qty_vendida, 0),
      qty_producida: muestras.reduce((s, m) => s + m.qty_producida, 0),
      costo_teorico,
      costo_op,
      var_costo,
      var_costo_pct: costo_teorico > 0 ? (var_costo / costo_teorico) * 100 : 0,
    },
    muestras,
    cliente: {
      codigo_cliente: meta.codigo_cliente,
      cliente: meta.cliente,
    },
    campos_produccion: meta.campos_produccion,
    tiene_consumo_real: tieneAlgunConsumoReal,
    produccion_ok: meta.produccion_ok,
    produccion_error: meta.produccion_error ?? null,
    ultimo_sync: meta.ultimo_sync,
    vista: meta.vista,
    aviso: avisoParts.length ? avisoParts.join(' ') : null,
  }
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

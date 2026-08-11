import type { CosteoMuestraRow } from './sapBiQuery.js'

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0
  const n = Number(value)
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

export type IngredienteRow = {
  componente_code: string
  componente_nombre: string
  cantidad: number
  costo_unitario: number
  costo_linea: number
  nivel: number
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

export type VentaAnalisisRow = VentaMargenRow & {
  costo_teorico_unit: number
  costo_teorico: number
  variacion: number
  variacion_pct: number
  margen_pct: number
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
  ultimo_sync: string | null
  vista: string
  filas_leidas: number
}

export function buildRecetaCatalogo(rows: RecetaCostoRow[]): RecetaCatalogoItem[] {
  const map = new Map<string, RecetaCatalogoItem>()
  for (const r of rows) {
    const key = r.receta_code || r.receta_nombre
    if (!key) continue
    map.set(key, {
      receta_code: r.receta_code,
      receta_nombre: r.receta_nombre || r.receta_code,
      costo: r.costo,
      flag_costo: r.flag_costo,
    })
  }
  return [...map.values()].sort((a, b) =>
    (a.receta_nombre || a.receta_code).localeCompare(b.receta_nombre || b.receta_code, 'es'),
  )
}

export function mapIngredienteRows(raw: Record<string, unknown>[]): IngredienteRow[] {
  const rows = raw.map((r) => {
    const cantidad = toNumber(r.cantidad)
    const costo_unitario = toNumber(r.costo_unitario)
    let costo_linea = toNumber(r.costo_linea)
    if (!costo_linea && cantidad && costo_unitario) {
      costo_linea = cantidad * costo_unitario
    }
    return {
      componente_code: String(r.componente_code ?? '').trim(),
      componente_nombre: String(r.componente_nombre ?? r.componente_code ?? '').trim() || 'Componente',
      cantidad,
      costo_unitario,
      costo_linea,
      nivel: toNumber(r.nivel),
      pct_costo: 0,
    }
  })

  const total = rows.reduce((s, r) => s + r.costo_linea, 0)
  return rows
    .map((r) => ({
      ...r,
      pct_costo: total > 0 ? (r.costo_linea / total) * 100 : 0,
    }))
    .sort((a, b) => b.costo_linea - a.costo_linea)
}

export function buildRecetaDetallePayload(
  receta: RecetaCatalogoItem,
  ingredientes: IngredienteRow[],
  meta: { vista: string },
): RecetaDetallePayload {
  const costo_total = ingredientes.reduce((s, i) => s + i.costo_linea, 0) || receta.costo
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

export function aggregateVentaAnalisis(
  ventas: VentaMargenRow[],
  recetasCosto: Map<string, RecetaCostoRow>,
  meta: { vista: string; ultimo_sync: string | null },
): VentaAnalisisPayload {
  const detalle: VentaAnalisisRow[] = ventas.map((row) => {
    const teoricoUnit = recetasCosto.get(row.receta_code)?.costo ?? 0
    const qty = row.cantidad > 0 ? row.cantidad : 1
    const costo_teorico = teoricoUnit * qty
    const variacion = row.costo - costo_teorico
    const variacion_pct = costo_teorico > 0 ? (variacion / costo_teorico) * 100 : 0
    const margen_pct = row.venta > 0 ? (row.margen / row.venta) * 100 : 0
    return {
      ...row,
      costo_teorico_unit: teoricoUnit,
      costo_teorico,
      variacion,
      variacion_pct,
      margen_pct,
    }
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
      variacion_pct: r.costo_teorico > 0 ? (r.variacion / r.costo_teorico) * 100 : 0,
      margen_pct: r.venta > 0 ? (r.margen / r.venta) * 100 : 0,
    }))
    .sort((a, b) => b.venta - a.venta)

  const total_venta = detalle.reduce((s, r) => s + r.venta, 0)
  const total_costo = detalle.reduce((s, r) => s + r.costo, 0)
  const total_margen = detalle.reduce((s, r) => s + r.margen, 0)
  const total_costo_teorico = detalle.reduce((s, r) => s + r.costo_teorico, 0)
  const total_variacion = detalle.reduce((s, r) => s + r.variacion, 0)

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
    detalle: detalle.sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha).getTime() : 0
      const db = b.fecha ? new Date(b.fecha).getTime() : 0
      return db - da
    }),
    ultimo_sync: meta.ultimo_sync,
    vista: meta.vista,
    filas_leidas: detalle.length,
  }
}

export function mapVentaMargenRows(raw: Record<string, unknown>[]): VentaMargenRow[] {
  return raw.map((r) => ({
    empresa: String(r.empresa ?? '').trim(),
    fecha: toDateIso(r.fecha),
    periodo: String(r.periodo ?? '').trim(),
    codigo_cliente: String(r.codigo_cliente ?? '').trim(),
    cliente: String(r.cliente ?? '').trim() || 'Sin cliente',
    grupo_cliente: String(r.grupo_cliente ?? '').trim(),
    receta_code: String(r.receta_code ?? '').trim(),
    receta_nombre: String(r.receta_nombre ?? '').trim(),
    cantidad: toNumber(r.cantidad),
    venta: toNumber(r.venta),
    costo: toNumber(r.costo),
    margen: toNumber(r.margen),
  }))
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
    const costo = toNumber(r.costo) || toNumber(r.costo_unitario)
    return {
      receta_code: String(r.receta_code ?? '').trim(),
      receta_nombre: String(r.receta_nombre ?? '').trim(),
      costo,
      costo_unitario: toNumber(r.costo_unitario) || costo,
      flag_costo: String(r.flag_costo ?? '').trim(),
      cantidad: toNumber(r.cantidad),
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
    if (!prev || row.costo > prev.costo) {
      byReceta.set(key, row)
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

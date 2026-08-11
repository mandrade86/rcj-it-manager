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

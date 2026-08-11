import type { CosteoMuestraRow } from './sapBiQuery.js'

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

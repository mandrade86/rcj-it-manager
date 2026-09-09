import type { GastosDashboard, GastosItCategoria } from '@/types/gastosDashboard'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchGastosDashboard(params?: {
  anio?: number
  mes?: number
  desde?: string
  hasta?: string
  empresa?: string
  categoria_id?: string
  comparar_mes_anterior?: boolean
  comparar_presupuesto?: boolean
}): Promise<GastosDashboard> {
  const q = new URLSearchParams()
  if (params?.anio != null) q.set('anio', String(params.anio))
  if (params?.mes != null) q.set('mes', String(params.mes))
  if (params?.desde) q.set('desde', params.desde)
  if (params?.hasta) q.set('hasta', params.hasta)
  if (params?.empresa) q.set('empresa', params.empresa)
  if (params?.categoria_id) q.set('categoria_id', params.categoria_id)
  if (params?.comparar_mes_anterior === false) q.set('comparar_mes_anterior', 'false')
  if (params?.comparar_presupuesto === false) q.set('comparar_presupuesto', 'false')
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/costos-it/dashboard-gastos${suffix}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<GastosDashboard>
}

export async function putGastosClasificacion(
  hash: string,
  body: {
    categoria_id: string
    subcategoria_id: string
    tipo_gasto?: string
    notas?: string
  },
): Promise<unknown> {
  const res = await fetch(`/api/costos-it/clasificacion/${encodeURIComponent(hash)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchGastosCategorias(): Promise<{ categorias: GastosItCategoria[] }> {
  const res = await fetch('/api/costos-it/categorias-gastos')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ categorias: GastosItCategoria[] }>
}

export type GastosItPresupuesto = {
  _id?: string
  anio: number
  mes: number
  empresa: string
  cuenta: string
  cuenta_nombre?: string
  monto: number
  monto_usd?: number
  moneda?: 'USD' | 'HNL'
  notas?: string
}

export type GastosItPresupuestoCuenta = {
  cuenta: string
  nombre: string
  transacciones: number
  monto_total: number
}

export async function fetchGastosPresupuestoCuentas(anio?: number): Promise<{ cuentas: GastosItPresupuestoCuenta[] }> {
  const q = anio != null ? `?anio=${anio}` : ''
  const res = await fetch(`/api/costos-it/presupuestos/cuentas${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ cuentas: GastosItPresupuestoCuenta[] }>
}

export async function fetchGastosPresupuestos(
  anio: number,
  mes: number,
  empresa: string,
): Promise<{ presupuestos: GastosItPresupuesto[]; moneda: 'USD' | 'HNL'; empresa: string }> {
  const q = new URLSearchParams({
    anio: String(anio),
    mes: String(mes),
    empresa,
  })
  const res = await fetch(`/api/costos-it/presupuestos?${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function saveGastosPresupuestos(body: {
  anio: number
  mes: number
  empresa: string
  items: Array<{ cuenta: string; cuenta_nombre?: string; monto: number }>
}): Promise<{ presupuestos: GastosItPresupuesto[]; moneda: 'USD' | 'HNL'; empresa: string }> {
  const res = await fetch('/api/costos-it/presupuestos', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export function exportGastosCsv(filas: GastosDashboard['filas']): void {
  const headers = ['Fecha', 'Proveedor', 'Descripción', 'Categoría', 'Subcategoría', 'Tipo', 'Monto USD']
  const lines = filas.map((f) =>
    [
      f.fecha ?? '',
      f.proveedor,
      `"${f.descripcion.replace(/"/g, '""')}"`,
      f.categoria,
      f.subcategoria,
      f.tipo_gasto,
      f.monto.toFixed(2),
    ].join(','),
  )
  const csv = [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gastos-it-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

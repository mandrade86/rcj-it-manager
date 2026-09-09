import type { BudgetItSap } from '@/types/budgetIt'
import type { CostosItAnalisisCategoria, CostosItConfig, CostosItDashboard } from '@/types/costosIt'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchCostosItConfig(): Promise<CostosItConfig> {
  const res = await fetch('/api/costos-it/config')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CostosItConfig>
}

export async function fetchCostosItDashboard(params?: {
  anio_base?: number
  anio_comp?: number
  categoria?: string
  empresa?: string
}): Promise<CostosItDashboard> {
  const q = new URLSearchParams()
  if (params?.anio_base != null) q.set('anio_base', String(params.anio_base))
  if (params?.anio_comp != null) q.set('anio_comp', String(params.anio_comp))
  if (params?.categoria) q.set('categoria', params.categoria)
  if (params?.empresa) q.set('empresa', params.empresa)
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/costos-it/dashboard${suffix}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CostosItDashboard>
}

export async function fetchCostosItAnalisisCategoria(params?: {
  anio?: number
  mes?: number
  empresa?: string
  categoria?: string
}): Promise<CostosItAnalisisCategoria> {
  const q = new URLSearchParams()
  if (params?.anio != null) q.set('anio', String(params.anio))
  if (params?.mes != null) q.set('mes', String(params.mes))
  if (params?.empresa) q.set('empresa', params.empresa)
  if (params?.categoria) q.set('categoria', params.categoria)
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/costos-it/analisis-categoria${suffix}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CostosItAnalisisCategoria>
}

export async function postCostosItCategorizarIA(body?: {
  desde?: string
  hasta?: string
}): Promise<{ ok: boolean; categorizacion: CostosItDashboard['categorizacion']; ultimo_sync: string | null }> {
  const res = await fetch('/api/costos-it/categorizar-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    ok: boolean
    categorizacion: CostosItDashboard['categorizacion']
    ultimo_sync: string | null
  }>
}

export async function putCostosItClasificacion(
  hash: string,
  body: { categoria: string; notas?: string },
): Promise<unknown> {
  const res = await fetch(`/api/costos-it/clasificacion/${encodeURIComponent(hash)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function refreshCostosItColumnas(): Promise<{
  columnas: string[]
  fields: CostosItConfig['fields']
  valido: boolean
}> {
  const res = await fetch('/api/costos-it/vista-columnas')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{
    columnas: string[]
    fields: CostosItConfig['fields']
    valido: boolean
  }>
}

export async function fetchBudgetItSap(params?: {
  anio?: number
  mes?: number
  busqueda?: string
  empresa?: string
}): Promise<BudgetItSap> {
  const q = new URLSearchParams()
  if (params?.anio != null) q.set('anio', String(params.anio))
  if (params?.mes != null) q.set('mes', String(params.mes))
  if (params?.busqueda?.trim()) q.set('busqueda', params.busqueda.trim())
  if (params?.empresa?.trim() && params.empresa !== 'todas') q.set('empresa', params.empresa.trim())
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/costos-it/budget-sap${suffix}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<BudgetItSap>
}

export async function fetchGastosPorCuenta(params: {
  anio: number
  mes?: number
  empresa: string
  cuenta: string
}): Promise<import('@/types/budgetIt').GastosPorCuentaResponse> {
  const q = new URLSearchParams()
  q.set('anio', String(params.anio))
  if (params.mes != null) q.set('mes', String(params.mes))
  q.set('empresa', params.empresa)
  q.set('cuenta', params.cuenta)
  const res = await fetch(`/api/costos-it/gastos-por-cuenta?${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function fetchEmpresasMoneda(): Promise<{
  items: Array<{ empresa: string; moneda: 'USD' | 'HNL' }>
}> {
  const res = await fetch('/api/costos-it/empresas-moneda')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function saveEmpresasMoneda(
  items: Array<{ empresa: string; moneda: 'USD' | 'HNL' }>,
): Promise<{ items: Array<{ empresa: string; moneda: 'USD' | 'HNL' }> }> {
  const res = await fetch('/api/costos-it/empresas-moneda', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

import type {
  CosteoMuestrasPayload,
  CosteoUltimoSync,
  RecetaCostoPayload,
  SapBiColumnMapping,
  SapBiCosteoConfig,
  VentaMargenPayload,
} from '@/types/costeoMuestras'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchCosteoConfig(): Promise<SapBiCosteoConfig> {
  const res = await fetch('/api/costeo-muestras/config')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SapBiCosteoConfig>
}

export async function saveCosteoConfig(body: {
  driver?: 'mssql' | 'hana'
  host?: string
  port?: number
  database?: string
  schema?: string
  viewName?: string
  username?: string
  password?: string
  encrypt?: boolean
  trustServerCertificate?: boolean
  columnMapping?: Partial<SapBiColumnMapping>
}): Promise<SapBiCosteoConfig> {
  const res = await fetch('/api/costeo-muestras/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SapBiCosteoConfig>
}

export async function testCosteoConnection(): Promise<{ ok: boolean; message: string; filasMuestra?: number }> {
  const res = await fetch('/api/costeo-muestras/test', { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; message: string; filasMuestra?: number }>
}

export async function syncCosteoMuestras(): Promise<{ ok: boolean; filas: number; ultimo_sync: string; vista: string }> {
  const res = await fetch('/api/costeo-muestras/sync', { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; filas: number; ultimo_sync: string; vista: string }>
}

export async function fetchCosteoDatos(params?: {
  cliente?: string
  desde?: string
  hasta?: string
  refresh?: boolean
}): Promise<CosteoMuestrasPayload> {
  const q = new URLSearchParams()
  if (params?.cliente) q.set('cliente', params.cliente)
  if (params?.desde) q.set('desde', params.desde)
  if (params?.hasta) q.set('hasta', params.hasta)
  if (params?.refresh) q.set('refresh', 'true')
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/costeo-muestras/datos${suffix}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CosteoMuestrasPayload>
}

export async function fetchCosteoVistaColumnas(): Promise<{
  columnas: string[]
  sugerido: Partial<SapBiColumnMapping>
}> {
  const res = await fetch('/api/costeo-muestras/vista-columnas')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ columnas: string[]; sugerido: Partial<SapBiColumnMapping> }>
}

export async function applyCosteoColumnMapping(): Promise<SapBiCosteoConfig> {
  const res = await fetch('/api/costeo-muestras/vista-columnas/aplicar', { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SapBiCosteoConfig>
}

export async function fetchCosteoUltimoSync(): Promise<CosteoUltimoSync> {
  const res = await fetch('/api/costeo-muestras/ultimo-sync')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CosteoUltimoSync>
}

export async function fetchVentasMargen(params?: {
  cliente?: string
  receta?: string
  desde?: string
  hasta?: string
}): Promise<VentaMargenPayload> {
  const q = new URLSearchParams()
  if (params?.cliente) q.set('cliente', params.cliente)
  if (params?.receta) q.set('receta', params.receta)
  if (params?.desde) q.set('desde', params.desde)
  if (params?.hasta) q.set('hasta', params.hasta)
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/costeo-muestras/ventas-margen${suffix}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<VentaMargenPayload>
}

export async function fetchRecetasCosto(params?: { receta?: string }): Promise<RecetaCostoPayload> {
  const q = new URLSearchParams()
  if (params?.receta) q.set('receta', params.receta)
  const suffix = q.toString() ? `?${q.toString()}` : ''
  const res = await fetch(`/api/costeo-muestras/recetas${suffix}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RecetaCostoPayload>
}

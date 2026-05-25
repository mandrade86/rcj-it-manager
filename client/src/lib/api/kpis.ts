import type {
  KpiDoc,
  KpiRegistrosResponse,
  KpiSugerenciasResponse,
} from '@/types/kpi'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchKpis(params?: {
  departamento_id?: string | 'none' | null
}): Promise<KpiDoc[]> {
  const url = new URL('/api/kpis', window.location.origin)
  if (params?.departamento_id) {
    url.searchParams.set('departamento_id', params.departamento_id)
  }
  const res = await fetch(url.pathname + (url.search ? url.search : ''))
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<KpiDoc[]>
}

export async function createKpi(body: {
  departamento_id?: string | null
  meta_id?: string | null
  tipo?: string | null
  eje: string
  nombre: string
  descripcion?: string | null
  meta?: string | null
  unidad?: string | null
  frecuencia?: string | null
  responsable?: string | null
  tipo_calculo?: string | null
  proyecto_ids?: string[]
}): Promise<KpiDoc> {
  const res = await fetch('/api/kpis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<KpiDoc>
}

export async function updateKpi(
  id: string,
  body: Partial<{
    departamento_id: string | null
    tipo: string | null
    eje: string
    nombre: string
    descripcion: string | null
    meta: string | null
    unidad: string | null
    frecuencia: string | null
    responsable: string | null
    tipo_calculo: string | null
    proyecto_ids: string[]
  }>,
): Promise<KpiDoc> {
  const res = await fetch(`/api/kpis/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<KpiDoc>
}

export async function deleteKpi(id: string): Promise<void> {
  const res = await fetch(`/api/kpis/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

export type EliminarKpisLoteResponse = {
  eliminados: number
  ids: string[]
  omitidos: string[]
}

/** Elimina varios KPIs en una sola petición (permiso `kpis:editar` o admin). */
export async function deleteKpisLote(ids: string[]): Promise<EliminarKpisLoteResponse> {
  const res = await fetch('/api/kpis/eliminar-lote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EliminarKpisLoteResponse>
}

export async function fetchKpiSugerencias(
  departamentoId: string,
): Promise<KpiSugerenciasResponse> {
  const res = await fetch(
    `/api/kpis/sugerencias?departamento_id=${encodeURIComponent(departamentoId)}`,
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<KpiSugerenciasResponse>
}

export async function aplicarKpiSugerencias(body: {
  departamento_id: string
  nombres?: string[]
}): Promise<{ creados: number; omitidos: number }> {
  const res = await fetch('/api/kpis/aplicar-sugerencias', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ creados: number; omitidos: number }>
}

export async function fetchKpiRegistros(kpiId: string): Promise<KpiRegistrosResponse> {
  const q = new URLSearchParams({ kpi_id: kpiId })
  const res = await fetch(`/api/kpi-registros?${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<KpiRegistrosResponse>
}

export async function postKpiRegistro(body: {
  kpi_id: string
  fecha: string | Date
  valor?: number | null
  notas?: string | null
}): Promise<KpiDoc> {
  const res = await fetch('/api/kpi-registros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<KpiDoc>
}

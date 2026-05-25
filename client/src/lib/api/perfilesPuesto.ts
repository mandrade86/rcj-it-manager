import type {
  PerfilKpiEvaluacion,
  PerfilKpisEvaluacionResponse,
  PerfilPuestoDoc,
  RubricaCriterio,
} from '@/types/perfilPuesto'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch { return res.statusText }
}

export async function fetchPerfilesPuesto(params?: { departamento_id?: string }): Promise<PerfilPuestoDoc[]> {
  const q = new URLSearchParams()
  if (params?.departamento_id) q.set('departamento_id', params.departamento_id)
  const res = await fetch(`/api/perfiles-puesto${q.toString() ? `?${q}` : ''}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PerfilPuestoDoc[]>
}

export async function fetchPerfilPuesto(id: string): Promise<PerfilPuestoDoc> {
  const res = await fetch(`/api/perfiles-puesto/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PerfilPuestoDoc>
}

export async function createPerfilPuesto(body: Record<string, unknown>): Promise<PerfilPuestoDoc> {
  const res = await fetch('/api/perfiles-puesto', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PerfilPuestoDoc>
}

export async function updatePerfilPuesto(id: string, body: Record<string, unknown>): Promise<PerfilPuestoDoc> {
  const res = await fetch(`/api/perfiles-puesto/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PerfilPuestoDoc>
}

export async function deletePerfilPuesto(id: string): Promise<void> {
  const res = await fetch(`/api/perfiles-puesto/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export type RubricaPerfilResponse = {
  perfil_id: string
  codigo: string
  titulo: string
  criterios: RubricaCriterio[]
}

export async function fetchRubricaPerfil(id: string): Promise<RubricaPerfilResponse> {
  const res = await fetch(`/api/perfiles-puesto/${id}/rubrica`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RubricaPerfilResponse>
}

export async function updateRubricaPerfil(
  id: string,
  criterios: RubricaCriterio[],
): Promise<RubricaPerfilResponse> {
  const res = await fetch(`/api/perfiles-puesto/${id}/rubrica`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ criterios }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RubricaPerfilResponse>
}

export async function fetchKpisEvaluacionPerfil(
  id: string,
): Promise<PerfilKpisEvaluacionResponse> {
  const res = await fetch(`/api/perfiles-puesto/${id}/kpis-evaluacion`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PerfilKpisEvaluacionResponse>
}

export async function updateKpisEvaluacionPerfil(
  id: string,
  items: PerfilKpiEvaluacion[],
): Promise<PerfilKpisEvaluacionResponse> {
  const res = await fetch(`/api/perfiles-puesto/${id}/kpis-evaluacion`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PerfilKpisEvaluacionResponse>
}

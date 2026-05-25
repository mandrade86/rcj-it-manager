import type { PlantillaCarreraDoc, PlantillaItem } from '@/types/plantillaCarrera'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch { return res.statusText }
}

export async function fetchPlantillasCarrera(params?: { departamento_id?: string }): Promise<PlantillaCarreraDoc[]> {
  const q = new URLSearchParams()
  if (params?.departamento_id) q.set('departamento_id', params.departamento_id)
  const res = await fetch(`/api/plantillas-carrera${q.toString() ? `?${q}` : ''}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PlantillaCarreraDoc[]>
}

export async function fetchPlantillaCarrera(id: string): Promise<PlantillaCarreraDoc> {
  const res = await fetch(`/api/plantillas-carrera/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PlantillaCarreraDoc>
}

export async function createPlantillaCarrera(body: Record<string, unknown>): Promise<PlantillaCarreraDoc> {
  const res = await fetch('/api/plantillas-carrera', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PlantillaCarreraDoc>
}

export async function updatePlantillaCarrera(id: string, body: Record<string, unknown>): Promise<PlantillaCarreraDoc> {
  const res = await fetch(`/api/plantillas-carrera/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<PlantillaCarreraDoc>
}

export async function deletePlantillaCarrera(id: string): Promise<void> {
  const res = await fetch(`/api/plantillas-carrera/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export async function asignarPlantillaAColaborador(body: {
  colaborador_id: string
  plantilla_id: string
  fecha_inicio?: string
  periodo_estimado?: string
  responsable_seguimiento?: string
}): Promise<unknown> {
  const res = await fetch('/api/plantillas-carrera/asignar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

export async function updateItemsPlantilla(id: string, items: PlantillaItem[]): Promise<PlantillaCarreraDoc> {
  return updatePlantillaCarrera(id, { items })
}

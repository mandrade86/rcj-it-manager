import type { EjeProyectoDoc } from '@/types/ejeProyecto'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchEjesProyecto(params?: { activo?: boolean }): Promise<EjeProyectoDoc[]> {
  const q = new URLSearchParams()
  if (params?.activo === true) q.set('activo', 'true')
  if (params?.activo === false) q.set('activo', 'false')
  const url = `/api/ejes-proyecto${q.toString() ? `?${q}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EjeProyectoDoc[]>
}

export async function createEjeProyecto(body: Record<string, unknown>): Promise<EjeProyectoDoc> {
  const res = await fetch('/api/ejes-proyecto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EjeProyectoDoc>
}

export async function updateEjeProyecto(id: string, body: Record<string, unknown>): Promise<EjeProyectoDoc> {
  const res = await fetch(`/api/ejes-proyecto/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EjeProyectoDoc>
}

export async function deleteEjeProyecto(id: string): Promise<void> {
  const res = await fetch(`/api/ejes-proyecto/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

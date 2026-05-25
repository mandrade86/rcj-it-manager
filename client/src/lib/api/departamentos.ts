import type { DepartamentoDoc } from '@/types/departamento'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch { return res.statusText }
}

export async function fetchDepartamentos(): Promise<DepartamentoDoc[]> {
  const res = await fetch('/api/departamentos')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<DepartamentoDoc[]>
}

export async function createDepartamento(body: Record<string, unknown>): Promise<DepartamentoDoc> {
  const res = await fetch('/api/departamentos', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<DepartamentoDoc>
}

export async function updateDepartamentoMetas(
  id: string,
  metas_estrategicas: DepartamentoDoc['metas_estrategicas'],
): Promise<DepartamentoDoc> {
  const res = await fetch(`/api/departamentos/${id}/metas`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metas_estrategicas }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<DepartamentoDoc>
}

export async function updateDepartamento(id: string, body: Record<string, unknown>): Promise<DepartamentoDoc> {
  const res = await fetch(`/api/departamentos/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<DepartamentoDoc>
}

export async function deleteDepartamento(id: string): Promise<void> {
  const res = await fetch(`/api/departamentos/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

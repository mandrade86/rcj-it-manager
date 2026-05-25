import type { ProveedorCapacitacionDoc } from '@/types/capacitacion'

async function parseError(res: Response): Promise<string> {
  try { const j = (await res.json()) as { error?: string }; return j.error ?? res.statusText }
  catch { return res.statusText }
}

export async function fetchProveedoresCapacitacion(): Promise<ProveedorCapacitacionDoc[]> {
  const res = await fetch('/api/proveedores-capacitacion')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ProveedorCapacitacionDoc[]>
}

export async function createProveedorCapacitacion(
  body: Partial<ProveedorCapacitacionDoc>,
): Promise<ProveedorCapacitacionDoc> {
  const res = await fetch('/api/proveedores-capacitacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ProveedorCapacitacionDoc>
}

export async function updateProveedorCapacitacion(
  id: string,
  body: Partial<ProveedorCapacitacionDoc>,
): Promise<ProveedorCapacitacionDoc> {
  const res = await fetch(`/api/proveedores-capacitacion/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ProveedorCapacitacionDoc>
}

export async function deleteProveedorCapacitacion(id: string): Promise<void> {
  const res = await fetch(`/api/proveedores-capacitacion/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

import type { RolDoc } from '@/types/rol'

async function parseError(res: Response): Promise<string> {
  try { const j = (await res.json()) as { error?: string }; return j.error ?? res.statusText }
  catch { return res.statusText }
}

export async function fetchRoles(): Promise<RolDoc[]> {
  const res = await fetch('/api/roles')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RolDoc[]>
}

export async function fetchPermisosDisponibles(): Promise<{ clave: string; descripcion: string }[]> {
  const res = await fetch('/api/roles/permisos-disponibles')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ clave: string; descripcion: string }[]>
}

export async function createRol(body: Record<string, unknown>): Promise<RolDoc> {
  const res = await fetch('/api/roles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RolDoc>
}

export async function updateRol(id: string, body: Record<string, unknown>): Promise<RolDoc> {
  const res = await fetch(`/api/roles/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RolDoc>
}

export async function deleteRol(id: string): Promise<void> {
  const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

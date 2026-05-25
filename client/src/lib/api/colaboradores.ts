import type { Colaborador } from '@/types/colaborador'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detalle?: string }
    return j.error ?? j.detalle ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchColaboradores(params?: {
  frente?: string
  estado?: string
}): Promise<Colaborador[]> {
  const q = new URLSearchParams()
  if (params?.frente) q.set('frente', params.frente)
  if (params?.estado) q.set('estado', params.estado)
  const url = `/api/colaboradores${q.toString() ? `?${q}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Colaborador[]>
}

export async function fetchColaborador(id: string): Promise<Colaborador> {
  const res = await fetch(`/api/colaboradores/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Colaborador>
}

export async function createColaborador(
  body: Record<string, unknown>,
): Promise<Colaborador> {
  const res = await fetch('/api/colaboradores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Colaborador>
}

export async function updateColaborador(
  id: string,
  body: Record<string, unknown>,
): Promise<Colaborador> {
  const res = await fetch(`/api/colaboradores/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Colaborador>
}

export async function deleteColaborador(id: string): Promise<void> {
  const res = await fetch(`/api/colaboradores/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

/**
 * Encuentra (o auto-crea) el Colaborador vinculado a un Empleado.
 * Usado para abrir el perfil completo (con pestañas de descriptor de puesto,
 * evaluaciones, plan de carrera y capacitaciones) desde la vista de Equipo.
 */
export async function fetchColaboradorPorEmpleado(empleadoId: string): Promise<Colaborador> {
  const res = await fetch(`/api/colaboradores/por-empleado/${empleadoId}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Colaborador>
}

/**
 * Devuelve el colaborador vinculado al usuario logueado (vía empleado_id del JWT).
 * Lanza 404 con mensaje útil si el usuario no está vinculado a un empleado.
 */
export async function fetchMiColaborador(): Promise<Colaborador> {
  const res = await fetch('/api/colaboradores/me')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Colaborador>
}

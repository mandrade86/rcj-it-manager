import type { EmpleadoDoc } from '@/types/empleado'

async function parseError(res: Response): Promise<string> {
  try { const j = (await res.json()) as { error?: string }; return j.error ?? res.statusText }
  catch { return res.statusText }
}

export async function fetchEmpleados(params?: { departamento?: string; activo?: boolean }): Promise<EmpleadoDoc[]> {
  const q = new URLSearchParams()
  if (params?.departamento) q.set('departamento', params.departamento)
  if (params?.activo !== undefined) q.set('activo', String(params.activo))
  const res = await fetch(`/api/empleados${q.toString() ? `?${q}` : ''}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EmpleadoDoc[]>
}

export async function createEmpleado(body: Record<string, unknown>): Promise<EmpleadoDoc> {
  const res = await fetch('/api/empleados', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EmpleadoDoc>
}

export async function updateEmpleado(id: string, body: Record<string, unknown>): Promise<EmpleadoDoc> {
  const res = await fetch(`/api/empleados/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EmpleadoDoc>
}

export async function deleteEmpleado(id: string): Promise<void> {
  const res = await fetch(`/api/empleados/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export async function fetchConfigServicio(): Promise<{ url: string }> {
  const res = await fetch('/api/empleados/config/servicio')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ url: string }>
}

export async function saveConfigServicio(url: string): Promise<void> {
  const res = await fetch('/api/empleados/config/servicio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function syncEmpleados(): Promise<{ ok: boolean; insertados: number; actualizados: number; errores: number; total: number }> {
  const res = await fetch('/api/empleados/sync', { method: 'POST' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<{ ok: boolean; insertados: number; actualizados: number; errores: number; total: number }>
}

export type MiEquipoResponse = {
  empleados: EmpleadoDoc[]
  scope: 'all' | 'mio'
  total: number
  /** Tu empleado (identidad) — el "número de empleado" amarrado a tu usuario. */
  myEmpleadoId: string | null
  /** Empleados que se renderizan como raíces (tú + tus empleados_ids explícitos). */
  rootIds: string[]
  /** Reportes directos auto-descubiertos vía jefe_id == myEmpleadoId. */
  autoDirectIds: string[]
  /** Ids incluidos por `departamentos_a_cargo` del empleado vinculado. */
  deptIds: string[]
  directosCount: number
  /** Personas visibles solo por departamentos a cargo (sin contar jerarquía). */
  porDepartamentoCount: number
  subordinadosCount: number
}

export async function fetchMiEquipo(): Promise<MiEquipoResponse> {
  const res = await fetch('/api/empleados/mi-equipo')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<MiEquipoResponse>
}

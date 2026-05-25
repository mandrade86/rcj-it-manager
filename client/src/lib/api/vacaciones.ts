import type {
  EstadoVacacion,
  RegistroVacacionDoc,
  VacacionesEmpleadoResponse,
  VacacionesResumenItem,
} from '@/types/vacacion'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchVacacionesEmpleado(
  empleadoId: string,
): Promise<VacacionesEmpleadoResponse> {
  const res = await fetch(`/api/vacaciones/empleado/${empleadoId}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<VacacionesEmpleadoResponse>
}

export async function fetchVacacionesResumen(
  empleadoIds: string[],
): Promise<VacacionesResumenItem[]> {
  if (empleadoIds.length === 0) return []
  const res = await fetch('/api/vacaciones/resumen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empleado_ids: empleadoIds }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = (await res.json()) as { resumen: VacacionesResumenItem[] }
  return data.resumen
}

export async function createRegistroVacacion(body: {
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  dias_habiles?: number
  estado?: EstadoVacacion
  notas?: string
}): Promise<RegistroVacacionDoc> {
  const res = await fetch('/api/vacaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RegistroVacacionDoc>
}

export async function updateRegistroVacacion(
  id: string,
  body: Partial<{
    fecha_inicio: string
    fecha_fin: string
    dias_habiles: number
    estado: EstadoVacacion
    notas: string
  }>,
): Promise<RegistroVacacionDoc> {
  const res = await fetch(`/api/vacaciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<RegistroVacacionDoc>
}

export async function deleteRegistroVacacion(id: string): Promise<void> {
  const res = await fetch(`/api/vacaciones/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseError(res))
}

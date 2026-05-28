import type { CapacitacionDoc, CapacitacionesAlcance, EstadoCap } from '@/types/capacitacion'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detalle?: string }
    return j.error ?? j.detalle ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchCapacitacionesAlcance(): Promise<CapacitacionesAlcance> {
  const res = await fetch('/api/capacitaciones/alcance')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionesAlcance>
}

export async function fetchCapacitaciones(params?: {
  colaborador_id?: string
  estado?: EstadoCap
}): Promise<CapacitacionDoc[]> {
  const q = new URLSearchParams()
  if (params?.colaborador_id) q.set('colaborador_id', params.colaborador_id)
  if (params?.estado) q.set('estado', params.estado)
  const url = `/api/capacitaciones${q.toString() ? `?${q}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionDoc[]>
}

export async function fetchCapacitacion(id: string): Promise<CapacitacionDoc> {
  const res = await fetch(`/api/capacitaciones/${id}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionDoc>
}

export async function createCapacitacion(
  body: Record<string, unknown>,
): Promise<CapacitacionDoc> {
  const res = await fetch('/api/capacitaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionDoc>
}

export async function updateCapacitacion(
  id: string,
  body: Record<string, unknown>,
): Promise<CapacitacionDoc> {
  const res = await fetch(`/api/capacitaciones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionDoc>
}

/** Elimina una capacitación. Si ya no existe (404), no lanza error. */
export async function deleteCapacitacion(id: string): Promise<'deleted' | 'already_gone'> {
  const res = await fetch(`/api/capacitaciones/${id}`, { method: 'DELETE' })
  if (res.status === 204 || res.status === 200) return 'deleted'
  if (res.status === 404) {
    const msg = await parseError(res)
    if (/no encontrada/i.test(msg) || /not found/i.test(msg)) return 'already_gone'
    throw new Error(
      msg.includes('Cannot DELETE')
        ? 'El servidor no tiene la ruta de eliminación. Reinicia con npm run dev (o escribe rs en la terminal del backend).'
        : msg,
    )
  }
  if (!res.ok) throw new Error(await parseError(res))
  return 'deleted'
}

export async function asignarCapacitacion(
  capacitacionId: string,
  colaborador_ids: string[],
): Promise<CapacitacionDoc> {
  const res = await fetch(`/api/capacitaciones/${capacitacionId}/asignar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colaborador_ids }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionDoc>
}

export async function updateAsignacionColaborador(
  capacitacionId: string,
  body: {
    colaborador_id: string
    estado?: EstadoCap
    fecha_completado?: string | null
    calificacion?: number | null
    certificado?: string | null
  },
): Promise<CapacitacionDoc> {
  const res = await fetch(`/api/capacitacion-colaboradores/${capacitacionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionDoc>
}

export async function uploadCertificadoColaborador(
  capacitacionId: string,
  colaborador_id: string,
  file: File,
): Promise<CapacitacionDoc> {
  const fd = new FormData()
  fd.append('certificado', file)
  fd.append('colaborador_id', colaborador_id)
  const res = await fetch(
    `/api/capacitacion-colaboradores/${capacitacionId}/certificado`,
    { method: 'POST', body: fd },
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<CapacitacionDoc>
}

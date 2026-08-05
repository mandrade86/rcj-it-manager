import { notifyKpiDataChanged } from '@/lib/kpiSync'
import type { Proyecto, ProyectoRiesgoAdjunto, ProyectoRiesgoRegistro } from '@/types/proyecto'
import type { ReporteStatusProyectos } from '@/types/reporteProyectos'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detalle?: string }
    return j.error ?? j.detalle ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchProyectos(params?: {
  fase?: string
  eje?: string
  estado?: string
  prioridad?: string
  tipo?: string
  usuario_id?: string
  departamento_id?: string
  scope?: 'equipo' | 'participo'
  empresa_id?: string
}): Promise<Proyecto[]> {
  const q = new URLSearchParams()
  if (params?.fase) q.set('fase', params.fase)
  if (params?.eje) q.set('eje', params.eje)
  if (params?.estado) q.set('estado', params.estado)
  if (params?.prioridad) q.set('prioridad', params.prioridad)
  if (params?.tipo) q.set('tipo', params.tipo)
  if (params?.usuario_id) q.set('usuario_id', params.usuario_id)
  if (params?.departamento_id) q.set('departamento_id', params.departamento_id)
  if (params?.empresa_id) q.set('empresa_id', params.empresa_id)
  if (params?.scope) q.set('scope', params.scope)
  const url = `/api/proyectos${q.toString() ? `?${q}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Proyecto[]>
}

export async function fetchEstadosProyecto(): Promise<string[]> {
  const res = await fetch('/api/proyectos/catalogo/estados')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<string[]>
}

export async function deleteProyecto(id: string): Promise<void> {
  const res = await fetch(`/api/proyectos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export type EliminarProyectosLoteResponse = {
  eliminados: number
  ids: string[]
  omitidos: string[]
}

/** Elimina varios proyectos en una sola petición (permiso `proyectos:editar`). */
export async function deleteProyectosLote(ids: string[]): Promise<EliminarProyectosLoteResponse> {
  const res = await fetch('/api/proyectos/eliminar-lote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EliminarProyectosLoteResponse>
}

/** Cambia el estado del proyecto registrando una entrada en el historial. */
export async function transicionarProyecto(
  id: string,
  a: string,
  comentario?: string,
): Promise<Proyecto> {
  const res = await fetch(`/api/proyectos/${encodeURIComponent(id)}/transicion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ a, comentario }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const doc = (await res.json()) as Proyecto
  notifyKpiDataChanged()
  return doc
}

export async function fetchProyecto(id: string): Promise<Proyecto> {
  const res = await fetch(`/api/proyectos/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Proyecto>
}

export async function createProyecto(
  body: Record<string, unknown>,
): Promise<Proyecto> {
  const res = await fetch('/api/proyectos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Proyecto>
}

export async function updateProyecto(
  id: string,
  body: Record<string, unknown>,
): Promise<Proyecto> {
  const res = await fetch(`/api/proyectos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const doc = (await res.json()) as Proyecto
  notifyKpiDataChanged()
  return doc
}

export type ImportProyectosResult = {
  ok: boolean
  hoja: string
  totalFilas: number
  creados: number
  actualizados: number
  omitidos: number
  errores: { fila: number; error: string }[]
}

export async function importProyectosExcel(file: File): Promise<ImportProyectosResult> {
  const body = new FormData()
  body.append('archivo', file)
  const res = await fetch('/api/proyectos/importar-excel', { method: 'POST', body })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ImportProyectosResult>
}

function queryFromParams(params?: Record<string, string | undefined>): string {
  const q = new URLSearchParams()
  if (!params) return ''
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v)
  }
  return q.toString()
}

/** Descarga plantilla Excel; `params` opcionales = mismos filtros que el listado actual. */
export async function descargarPlantillaProyectos(
  params?: Record<string, string | undefined>,
): Promise<void> {
  const qs = queryFromParams(params)
  const url = `/api/proyectos/plantilla-excel${qs ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  const match = cd?.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] ?? 'Proyectos-plantilla.xlsx'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Descarga los proyectos filtrados como Excel de lectura (no plantilla de importación). */
export async function exportarProyectosExcel(
  params?: Record<string, string | undefined>,
): Promise<void> {
  const qs = queryFromParams(params)
  const url = `/api/proyectos/exportar-excel${qs ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  const match = cd?.match(/filename="?([^";]+)"?/)
  const filename = match?.[1] ?? 'Proyectos.xlsx'
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function fetchReporteStatusProyectos(params: {
  alcance?: 'todos' | 'departamento'
  departamento_id?: string
  proyecto_id?: string
}): Promise<ReporteStatusProyectos> {
  const q = new URLSearchParams()
  if (params.alcance) q.set('alcance', params.alcance)
  if (params.departamento_id) q.set('departamento_id', params.departamento_id)
  if (params.proyecto_id) q.set('proyecto_id', params.proyecto_id)
  const res = await fetch(`/api/proyectos/reporte-status?${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ReporteStatusProyectos>
}

export async function fetchProyectoRiesgos(proyectoId: string): Promise<ProyectoRiesgoRegistro[]> {
  const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/riesgos`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ProyectoRiesgoRegistro[]>
}

export async function addProyectoRiesgo(
  proyectoId: string,
  payload: { texto: string; nivel?: 'Alto' | 'Medio' | 'Bajo' },
): Promise<ProyectoRiesgoRegistro> {
  const res = await fetch(`/api/proyectos/${encodeURIComponent(proyectoId)}/riesgos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ProyectoRiesgoRegistro>
}

export async function deleteProyectoRiesgo(proyectoId: string, riesgoId: string): Promise<void> {
  const res = await fetch(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/riesgos/${encodeURIComponent(riesgoId)}`,
    { method: 'DELETE' },
  )
  if (!res.ok) throw new Error(await parseError(res))
}

export async function uploadProyectoRiesgoAdjunto(
  proyectoId: string,
  riesgoId: string,
  file: File,
): Promise<ProyectoRiesgoAdjunto> {
  const fd = new FormData()
  fd.append('archivo', file)
  const res = await fetch(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/riesgos/${encodeURIComponent(riesgoId)}/adjuntos`,
    { method: 'POST', body: fd },
  )
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ProyectoRiesgoAdjunto>
}

export async function deleteProyectoRiesgoAdjunto(
  proyectoId: string,
  riesgoId: string,
  adjuntoId: string,
): Promise<void> {
  const res = await fetch(
    `/api/proyectos/${encodeURIComponent(proyectoId)}/riesgos/${encodeURIComponent(riesgoId)}/adjuntos/${encodeURIComponent(adjuntoId)}`,
    { method: 'DELETE' },
  )
  if (!res.ok) throw new Error(await parseError(res))
}

export function urlAdjuntoProyectoRiesgo(archivo: string): string {
  return `/api/adjuntos-proyectos/${encodeURIComponent(archivo)}`
}

export async function updateProyectoParticipantes(
  id: string,
  participantes: Array<{ usuario_id: string; rol: 'editor' | 'lectura' }>,
): Promise<Proyecto> {
  const res = await fetch(`/api/proyectos/${encodeURIComponent(id)}/participantes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantes }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Proyecto>
}

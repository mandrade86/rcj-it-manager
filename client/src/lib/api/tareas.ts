import type { KanbanColumna } from '@/lib/tareaKanban'
import type { Tarea, TareaAdjunto, TareaComentario, ReporteSemanalTareas } from '@/types/tarea'

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detalle?: string }
    return j.error ?? j.detalle ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchTareas(proyectoId: string): Promise<Tarea[]> {
  const q = new URLSearchParams({ proyecto_id: proyectoId })
  const res = await fetch(`/api/tareas?${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Tarea[]>
}

export async function createTarea(body: Record<string, unknown>): Promise<Tarea> {
  const res = await fetch('/api/tareas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Tarea>
}

export type ImportTareasResult = {
  ok: boolean
  hoja: string
  totalFilas: number
  creadas: number
  actualizadas: number
  omitidas: number
  errores: { fila: number; error: string }[]
}

export async function importTareasExcel(
  proyectoId: string,
  file: File,
): Promise<ImportTareasResult> {
  const body = new FormData()
  body.append('proyecto_id', proyectoId)
  body.append('archivo', file)
  const res = await fetch('/api/tareas/importar-excel', {
    method: 'POST',
    body,
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ImportTareasResult>
}

/**
 * Descarga la plantilla Excel de tareas. Si se pasa `proyectoId`, las tareas
 * existentes vienen precargadas con su `ID` para permitir actualizarlas.
 */
export async function descargarPlantillaTareas(proyectoId?: string): Promise<void> {
  const url = proyectoId
    ? `/api/tareas/plantilla-excel?proyecto_id=${encodeURIComponent(proyectoId)}`
    : '/api/tareas/plantilla-excel'
  const res = await fetch(url)
  if (!res.ok) throw new Error(await parseError(res))

  // Intenta tomar el nombre de archivo del header
  const cd = res.headers.get('Content-Disposition') ?? ''
  const match = cd.match(/filename="?([^"]+)"?/i)
  const filename = match?.[1] ?? 'Tareas-plantilla.xlsx'

  const blob = await res.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(blobUrl)
}

/** Mueve la tarea a una columna del tablero Kanban (permiso en servidor). */
export async function moverTareaKanban(id: string, columna: KanbanColumna): Promise<Tarea> {
  const res = await fetch(`/api/tareas/${id}/estado-kanban`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columna }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Tarea>
}

export async function updateTarea(
  id: string,
  body: Record<string, unknown>,
): Promise<Tarea> {
  const res = await fetch(`/api/tareas/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<Tarea>
}

export async function deleteTarea(id: string): Promise<void> {
  const res = await fetch(`/api/tareas/${id}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export type EliminarTareasLoteResponse = {
  eliminados: number
  ids: string[]
  omitidos: string[]
}

/** Elimina varias tareas en una sola petición (opcional: restringir al proyecto). */
export async function deleteTareasLote(
  ids: string[],
  proyectoId?: string,
): Promise<EliminarTareasLoteResponse> {
  const res = await fetch('/api/tareas/eliminar-lote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids,
      ...(proyectoId ? { proyecto_id: proyectoId } : {}),
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<EliminarTareasLoteResponse>
}

export async function fetchAdjuntosTarea(id: string): Promise<TareaAdjunto[]> {
  const res = await fetch(`/api/tareas/${id}/adjuntos`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<TareaAdjunto[]>
}

export async function uploadAdjuntoTarea(id: string, file: File): Promise<TareaAdjunto> {
  const body = new FormData()
  body.append('archivo', file)
  const res = await fetch(`/api/tareas/${id}/adjuntos`, { method: 'POST', body })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<TareaAdjunto>
}

export async function deleteAdjuntoTarea(tareaId: string, adjuntoId: string): Promise<void> {
  const res = await fetch(`/api/tareas/${tareaId}/adjuntos/${adjuntoId}`, { method: 'DELETE' })
  if (res.status === 204) return
  if (!res.ok) throw new Error(await parseError(res))
}

export function urlAdjuntoTarea(archivo: string): string {
  return `/api/adjuntos-tareas/${encodeURIComponent(archivo)}`
}

export async function addComentarioTarea(
  tareaId: string,
  texto: string,
): Promise<TareaComentario> {
  const res = await fetch(`/api/tareas/${tareaId}/comentarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<TareaComentario>
}

export async function fetchReporteSemanalTareas(params: {
  semana: string
  alcance?: 'todos' | 'proyecto' | 'departamento'
  proyecto_id?: string
  departamento_id?: string
}): Promise<ReporteSemanalTareas> {
  const q = new URLSearchParams({ semana: params.semana })
  if (params.alcance) q.set('alcance', params.alcance)
  if (params.proyecto_id) q.set('proyecto_id', params.proyecto_id)
  if (params.departamento_id) q.set('departamento_id', params.departamento_id)
  const res = await fetch(`/api/tareas/reporte-semanal?${q}`)
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<ReporteSemanalTareas>
}

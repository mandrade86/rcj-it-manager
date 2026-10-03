export type GrupoEstado = 'por_hacer' | 'en_curso' | 'detenido' | 'listo'

export type TareaEstadoDef = {
  clave: string
  etiqueta: string
  color: string
  grupo: GrupoEstado
  sistema: boolean
}

export const ESTADOS_BASE: TareaEstadoDef[] = [
  { clave: 'Pendiente', etiqueta: 'Pendiente', color: '#9ca3af', grupo: 'por_hacer', sistema: true },
  { clave: 'En progreso', etiqueta: 'En curso', color: '#c9a227', grupo: 'en_curso', sistema: true },
  { clave: 'Bloqueado', etiqueta: 'Detenido', color: '#c00000', grupo: 'detenido', sistema: true },
  { clave: 'Completado', etiqueta: 'Listo', color: '#70ad47', grupo: 'listo', sistema: true },
]

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    return j.error ?? res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchTareaEstados(): Promise<TareaEstadoDef[]> {
  const res = await fetch('/api/config/tarea-estados')
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<TareaEstadoDef[]>
}

export async function saveTareaEstados(estados: TareaEstadoDef[]): Promise<TareaEstadoDef[]> {
  const res = await fetch('/api/config/tarea-estados', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estados }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<TareaEstadoDef[]>
}

export type ColId =
  | 'tarea'
  | 'persona'
  | 'estado'
  | 'fecha'
  | 'prioridad'
  | 'avance'
  | 'monto'
  | 'archivos'
  | 'cronograma'
  | 'actualizado'

export const COLUMNAS_TAREA: Array<{ id: ColId; label: string; width: number }> = [
  { id: 'tarea', label: 'Tarea', width: 240 },
  { id: 'persona', label: 'Persona', width: 140 },
  { id: 'estado', label: 'Estado', width: 120 },
  { id: 'fecha', label: 'Fecha', width: 110 },
  { id: 'prioridad', label: 'Prioridad', width: 110 },
  { id: 'avance', label: 'Avance', width: 90 },
  { id: 'monto', label: 'Monto', width: 120 },
  { id: 'archivos', label: 'Archivos', width: 80 },
  { id: 'cronograma', label: 'Cronograma', width: 140 },
  { id: 'actualizado', label: 'Actualizado', width: 110 },
]

export type ColLayout = {
  order: ColId[]
  hidden: ColId[]
  widths: Partial<Record<ColId, number>>
}

export function layoutInicial(): ColLayout {
  return {
    order: COLUMNAS_TAREA.map((c) => c.id),
    hidden: [],
    widths: Object.fromEntries(COLUMNAS_TAREA.map((c) => [c.id, c.width])) as ColLayout['widths'],
  }
}

const COLS_KEY = 'rcj_cols_tareas'

export function loadColLayout(userId: string): ColLayout {
  const base = layoutInicial()
  try {
    const raw = localStorage.getItem(`${COLS_KEY}_${userId}`)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<ColLayout>
    const known = new Set(base.order)
    const order = (parsed.order ?? []).filter((id): id is ColId => known.has(id as ColId))
    for (const id of base.order) if (!order.includes(id)) order.push(id)
    const hidden = (parsed.hidden ?? []).filter((id): id is ColId => known.has(id as ColId) && id !== 'tarea')
    return { order, hidden, widths: { ...base.widths, ...(parsed.widths ?? {}) } }
  } catch {
    return base
  }
}

export function saveColLayout(userId: string, layout: ColLayout) {
  localStorage.setItem(`${COLS_KEY}_${userId}`, JSON.stringify(layout))
}

export type VistaGuardada = {
  id: string
  nombre: string
  vista: string
  columnas: ColLayout
}

function vistasKey(userId: string, proyectoId: string) {
  return `rcj_vistas_proy_${userId}_${proyectoId}`
}

export function loadVistas(userId: string, proyectoId: string): VistaGuardada[] {
  try {
    const raw = localStorage.getItem(vistasKey(userId, proyectoId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v) => v && typeof v.nombre === 'string' && typeof v.vista === 'string') as VistaGuardada[]
  } catch {
    return []
  }
}

export function saveVistas(userId: string, proyectoId: string, vistas: VistaGuardada[]) {
  localStorage.setItem(vistasKey(userId, proyectoId), JSON.stringify(vistas))
}

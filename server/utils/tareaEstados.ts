import { Config } from '../db/models/Config.js'

export type GrupoEstado = 'por_hacer' | 'en_curso' | 'detenido' | 'listo'

export type TareaEstadoDef = {
  clave: string
  etiqueta: string
  color: string
  grupo: GrupoEstado
  sistema: boolean
}

const CLAVE = 'tarea_estados'

export const ESTADOS_BASE: TareaEstadoDef[] = [
  { clave: 'Pendiente', etiqueta: 'Pendiente', color: '#9ca3af', grupo: 'por_hacer', sistema: true },
  { clave: 'En progreso', etiqueta: 'En curso', color: '#c9a227', grupo: 'en_curso', sistema: true },
  { clave: 'Bloqueado', etiqueta: 'Detenido', color: '#c00000', grupo: 'detenido', sistema: true },
  { clave: 'Completado', etiqueta: 'Listo', color: '#70ad47', grupo: 'listo', sistema: true },
]

const GRUPOS = new Set<GrupoEstado>(['por_hacer', 'en_curso', 'detenido', 'listo'])

function claveValida(raw: string): string {
  return raw.trim().slice(0, 40)
}

export function normalizarEstados(input: unknown): TareaEstadoDef[] {
  const rows = Array.isArray(input) ? input : []
  const byClave = new Map<string, TareaEstadoDef>()
  for (const base of ESTADOS_BASE) byClave.set(base.clave, { ...base })
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const clave = claveValida(typeof r.clave === 'string' ? r.clave : '')
    if (!clave) continue
    const grupo = GRUPOS.has(r.grupo as GrupoEstado) ? (r.grupo as GrupoEstado) : 'por_hacer'
    const sistema = ESTADOS_BASE.some((b) => b.clave === clave)
    const prev = byClave.get(clave)
    byClave.set(clave, {
      clave,
      etiqueta: (typeof r.etiqueta === 'string' && r.etiqueta.trim() ? r.etiqueta.trim() : prev?.etiqueta ?? clave).slice(0, 40),
      color: typeof r.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color : prev?.color ?? '#9ca3af',
      grupo: sistema ? (GRUPOS.has(r.grupo as GrupoEstado) ? grupo : prev?.grupo ?? grupo) : grupo,
      sistema,
    })
  }
  const extras = [...byClave.values()].filter((e) => !e.sistema)
  return [...ESTADOS_BASE.map((b) => byClave.get(b.clave) ?? b), ...extras].slice(0, 16)
}

export async function leerTareaEstados(): Promise<TareaEstadoDef[]> {
  const doc = await Config.findOne({ clave: CLAVE }).lean() as { valor?: string } | null
  if (!doc?.valor) return ESTADOS_BASE.map((e) => ({ ...e }))
  try {
    return normalizarEstados(JSON.parse(doc.valor))
  } catch {
    return ESTADOS_BASE.map((e) => ({ ...e }))
  }
}

export async function guardarTareaEstados(input: unknown): Promise<TareaEstadoDef[]> {
  const list = normalizarEstados(input)
  await Config.findOneAndUpdate(
    { clave: CLAVE },
    { valor: JSON.stringify(list) },
    { upsert: true },
  )
  return list
}

export async function estadoTareaPermitido(clave: string): Promise<boolean> {
  const list = await leerTareaEstados()
  return list.some((e) => e.clave === clave)
}

export async function clavesEstadoListo(): Promise<Set<string>> {
  const list = await leerTareaEstados()
  return new Set(list.filter((e) => e.grupo === 'listo').map((e) => e.clave))
}

import type { DepartamentoDoc } from './departamento'
import type { EmpresaDoc } from './empresa'
import type { KpiDoc } from './kpi'

export type ProyectoEje = string

export type ProyectoFase = 1 | 2 | 3 | null

export type ProyectoPrioridad = 'Alta' | 'Media' | 'Baja'

export const PROYECTO_ESTADOS = [
  'Idea',
  'Planificado',
  'En revisión',
  'Aprobado',
  'En progreso',
  'Bloqueado',
  'En pausa',
  'Completado',
  'Cancelado',
] as const

export type ProyectoEstado = (typeof PROYECTO_ESTADOS)[number]

export type ProyectoTipo = 'individual' | 'departamental'

export type ProyectoParticipanteRol = 'editor' | 'lectura'

export type ProyectoParticipante = {
  _id?: string
  usuario_id: string | UsuarioMini
  rol: ProyectoParticipanteRol
  agregado_en?: string
}

export type ProyectoAcceso = {
  puede_editar: boolean
  puede_gestionar_participantes: boolean
  rol_participante?: ProyectoParticipanteRol | null
  es_propietario?: boolean
}

export type UsuarioMini = {
  _id: string
  nombre: string
  email?: string
  empleado_id?: string | null
}

/** Empresa poblada en `empresa_ids` (subset de EmpresaDoc). */
export type EmpresaMini = Pick<EmpresaDoc, '_id' | 'codigo' | 'nombre' | 'color' | 'activo'>

export type ProyectoCambio = {
  fecha: string
  de?: string | null
  a: string
  usuario_id?: string | UsuarioMini | null
  usuario_nombre?: string | null
  comentario?: string | null
}

export type Proyecto = {
  _id: string
  nombre: string
  descripcion?: string | null
  eje?: ProyectoEje | null
  fase?: ProyectoFase
  tipo?: ProyectoTipo
  usuario_id?: string | UsuarioMini | null
  departamento_id?: string | DepartamentoDoc | null
  /** IDs o documentos poblados de empresas del grupo involucradas. */
  empresa_ids?: (string | EmpresaMini)[] | null
  responsable?: string | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  prioridad: ProyectoPrioridad
  estado: ProyectoEstado
  /** KPI del catálogo del departamento (`/api/kpis`). */
  kpi_id?: string | KpiDoc | null
  meta_kpi?: string | null
  porcentaje_avance: number
  notas?: string | null
  historial?: ProyectoCambio[]
  participantes?: ProyectoParticipante[]
  acceso?: ProyectoAcceso
  createdAt?: string
  updatedAt?: string
  riesgo?: RiesgoProyecto
}

export function proyectoOwnerId(p: Proyecto): string | null {
  const u = p.usuario_id
  if (!u) return null
  if (typeof u === 'string') return u
  return u._id
}

export function participanteUsuarioId(p: ProyectoParticipante): string | null {
  const u = p.usuario_id
  if (!u) return null
  if (typeof u === 'string') return u
  return u._id
}

export function participanteUsuarioNombre(p: ProyectoParticipante): string {
  const u = p.usuario_id
  if (!u || typeof u === 'string') return ''
  return u.nombre
}

export function proyectoPuedeEditar(p: Proyecto): boolean {
  return p.acceso?.puede_editar ?? false
}

export function proyectoPuedeGestionarParticipantes(p: Proyecto): boolean {
  return p.acceso?.puede_gestionar_participantes ?? false
}

export function rolParticipanteLabel(rol: ProyectoParticipanteRol): string {
  return rol === 'editor' ? 'Editor' : 'Solo lectura'
}

export function proyectoOwnerName(p: Proyecto): string {
  const u = p.usuario_id
  if (!u) return ''
  if (typeof u === 'string') return ''
  return u.nombre
}

export function proyectoDeptId(p: Proyecto): string | null {
  const d = p.departamento_id
  if (!d) return null
  if (typeof d === 'string') return d
  return d._id
}

export function proyectoKpiId(p: Proyecto): string | null {
  const k = p.kpi_id
  if (!k) return null
  if (typeof k === 'string') return k
  return k._id
}

export function proyectoKpiDoc(p: Proyecto): KpiDoc | null {
  const k = p.kpi_id
  if (!k || typeof k === 'string') return null
  return k as KpiDoc
}

export function proyectoDeptDoc(p: Proyecto): DepartamentoDoc | null {
  const d = p.departamento_id
  if (!d || typeof d === 'string') return null
  return d as DepartamentoDoc
}

export function proyectoEmpresasDocs(p: Proyecto): EmpresaMini[] {
  const raw = p.empresa_ids
  if (!raw?.length) return []
  return raw.filter((x): x is EmpresaMini => typeof x === 'object' && x != null && '_id' in x)
}

/** IDs de empresa (poblados o sólo ObjectId string). */
export function proyectoEmpresaIdList(p: Proyecto): string[] {
  const docs = proyectoEmpresasDocs(p)
  if (docs.length) return docs.map((e) => e._id)
  const raw = p.empresa_ids
  if (!raw?.length) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

export function proyectoEmpresasLabel(p: Proyecto): string {
  const docs = proyectoEmpresasDocs(p)
  if (docs.length) return docs.map((e) => e.nombre).join(', ')
  const raw = p.empresa_ids
  const n = raw?.filter((x) => typeof x === 'string').length ?? 0
  if (n > 0) return `${n} empresa(s)`
  return ''
}

/** Color asociado al estado para badges. */
export function estadoColor(estado: ProyectoEstado): string {
  switch (estado) {
    case 'Idea': return 'bg-gray-100 text-gray-700 border-gray-300'
    case 'Planificado': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'En revisión': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Aprobado': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'En progreso': return 'bg-[var(--lime-lt)] text-[var(--navy)] border-[var(--lime)]/40'
    case 'Bloqueado': return 'bg-red-50 text-red-700 border-red-200'
    case 'En pausa': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    case 'Completado': return 'bg-green-100 text-green-800 border-green-300'
    case 'Cancelado': return 'bg-slate-100 text-slate-700 border-slate-300 line-through'
    default: return 'bg-gray-100 text-gray-700 border-gray-300'
  }
}

/**
 * Transiciones válidas para guiar el flujo. El usuario también puede saltar a
 * cualquier otro estado, pero éstas son las sugeridas.
 */
export const TRANSICIONES_SUGERIDAS: Record<ProyectoEstado, ProyectoEstado[]> = {
  'Idea': ['Planificado', 'Cancelado'],
  'Planificado': ['En revisión', 'Aprobado', 'Cancelado'],
  'En revisión': ['Aprobado', 'Planificado', 'Cancelado'],
  'Aprobado': ['En progreso', 'Cancelado'],
  'En progreso': ['Bloqueado', 'En pausa', 'Completado', 'Cancelado'],
  'Bloqueado': ['En progreso', 'Cancelado'],
  'En pausa': ['En progreso', 'Cancelado'],
  'Completado': [],
  'Cancelado': [],
}

export type RiesgoNivel = 'Alto' | 'Medio' | 'Bajo' | 'Sin fecha'

export type RiesgoProyecto = {
  nivel: RiesgoNivel
  motivo: string
  color: string
}

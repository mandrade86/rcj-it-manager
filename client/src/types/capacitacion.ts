import type { DepartamentoDoc } from './departamento'

export type ModalidadCap = 'Online' | 'Presencial' | 'Mixto'
export type EstadoCap = 'Pendiente' | 'En progreso' | 'Completado'

export type ColaboradorMini = {
  _id: string
  nombre: string
  codigo: string
  puesto: string
  frente?: string
  estado?: string
  departamento_id?: string | DepartamentoDoc | null
}

export type ProveedorCapacitacionDoc = {
  _id: string
  nombre: string
  descripcion?: string
  sitio_web?: string
  contacto?: string
  activo?: boolean
  createdAt?: string
  updatedAt?: string
}

export type AsignadoCap = {
  colaborador_id: string | ColaboradorMini
  estado?: EstadoCap
  fecha_completado?: string | null
  calificacion?: number | null
  certificado?: string | null
  certificado_nombre?: string | null
}

export type CapacitacionesAlcance = {
  isGlobal: boolean
  requiereDepartamentos: boolean
  departamentos: { _id: string; codigo: string; nombre: string; color?: string }[]
  etiqueta: string
  descripcion: string
}

export type CapacitacionDoc = {
  _id: string
  nombre: string
  /** Proveedor amarrado al maestro (preferente). */
  proveedor_id?: string | ProveedorCapacitacionDoc | null
  /** Nombre libre del proveedor (compat). */
  proveedor?: string
  /** Departamentos elegibles. Vacío = abierta a todos. */
  departamentos_ids?: Array<string | DepartamentoDoc>
  modalidad?: ModalidadCap
  duracion_horas?: number | null
  costo?: number | null
  fecha_inicio?: string | null
  fecha_fin?: string | null
  estado: EstadoCap
  asignados: AsignadoCap[]
  createdAt?: string
  updatedAt?: string
}

export function proveedorFromCap(c: CapacitacionDoc): ProveedorCapacitacionDoc | null {
  const p = c.proveedor_id
  if (!p || typeof p === 'string') return null
  return p as ProveedorCapacitacionDoc
}

export function proveedorNombreFromCap(c: CapacitacionDoc): string {
  const p = proveedorFromCap(c)
  if (p) return p.nombre
  return c.proveedor ?? ''
}

export function departamentosFromCap(c: CapacitacionDoc): DepartamentoDoc[] {
  const arr = c.departamentos_ids ?? []
  return arr.filter((d): d is DepartamentoDoc => typeof d !== 'string' && d != null)
}

export function departamentoIdsFromCap(c: CapacitacionDoc): string[] {
  const arr = c.departamentos_ids ?? []
  return arr.map((d) => (typeof d === 'string' ? d : d._id))
}

export function colaboradorIdFromAsignado(a: AsignadoCap): string {
  const c = a.colaborador_id
  if (c && typeof c === 'object' && '_id' in c) return String((c as ColaboradorMini)._id)
  return String(c)
}

export function nombreColaboradorAsignado(a: AsignadoCap): string {
  const c = a.colaborador_id
  if (c && typeof c === 'object' && 'nombre' in c) return (c as ColaboradorMini).nombre
  return '—'
}

/** Ruta pública para abrir el certificado (compatible con valor guardado como nombre o ruta completa). */
export function certificadoPublicUrl(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null
  const s = stored.trim().replace(/\\/g, '/')
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('/api/certificados/')) return s
  const name = s.replace(/^\/+/, '').replace(/^api\/certificados\//i, '')
  return `/api/certificados/${name}`
}

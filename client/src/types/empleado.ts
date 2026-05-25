export type DepartamentoRef = { _id: string; codigo: string; nombre: string; color?: string }

export type EmpleadoDoc = {
  _id: string
  codigo: string
  nombre: string
  puesto?: string
  departamento?: string
  departamento_id?: string | DepartamentoRef | null
  /** Departamentos cuya dotación se incluye en Mi Equipo. */
  departamentos_a_cargo?: (string | DepartamentoRef)[]
  email?: string
  telefono?: string
  jefe_id?: string | { _id: string; codigo: string; nombre: string; puesto?: string } | null
  foto_url?: string
  activo?: boolean
  fecha_ingreso?: string | null
  createdAt?: string
  updatedAt?: string
}

export function departamentoIdsFromRefs(refs?: (string | DepartamentoRef)[] | null): string[] {
  if (!refs?.length) return []
  return refs.map((d) => (typeof d === 'string' ? d : d._id))
}

export function jefeFromEmpleado(e: EmpleadoDoc): { _id: string; nombre: string; puesto?: string } | null {
  const j = e.jefe_id
  if (!j || typeof j === 'string') return null
  return j as { _id: string; nombre: string; puesto?: string }
}

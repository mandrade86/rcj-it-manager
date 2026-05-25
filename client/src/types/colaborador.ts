import type { PerfilPuestoDoc } from './perfilPuesto'

export type ColaboradorFrente = string
export type ColaboradorEstado = 'Activo' | 'Por contratar' | 'Futuro'
export type ColaboradorNivel = 'Junior' | 'Mid-Senior' | 'Senior' | null

export type Colaborador = {
  _id: string
  codigo: string
  nombre: string
  puesto: string
  codigo_puesto: string
  frente: ColaboradorFrente
  nivel?: ColaboradorNivel
  fecha_ingreso?: string | null
  estado: ColaboradorEstado
  salario_mensual?: number | null
  notas?: string | null
  departamento_id?: string | { _id: string; codigo?: string; nombre?: string; color?: string } | null
  /**
   * El perfil de puesto asignado al colaborador. El backend lo devuelve
   * populated (`PerfilPuestoDoc`), pero también puede venir como `string`
   * cuando se envía desde el cliente.
   */
  perfil_puesto_id?: string | PerfilPuestoDoc | null
  empleado_id?: string | { _id: string; codigo?: string; nombre?: string; activo?: boolean } | null
  createdAt?: string
  updatedAt?: string
}

/** Helper: devuelve el perfil populado del colaborador o null. */
export function perfilFromColaborador(c: Colaborador): PerfilPuestoDoc | null {
  const p = c.perfil_puesto_id
  if (!p || typeof p === 'string') return null
  return p
}

/** Helper: devuelve el id del perfil del colaborador (string) o null. */
export function perfilIdFromColaborador(c: Colaborador): string | null {
  const p = c.perfil_puesto_id
  if (!p) return null
  if (typeof p === 'string') return p
  return p._id
}

export type ColaboradorInput = Omit<Colaborador, '_id' | 'createdAt' | 'updatedAt'>

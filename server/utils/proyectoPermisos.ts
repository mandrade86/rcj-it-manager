import mongoose from 'mongoose'

export const PROYECTO_PARTICIPANTE_ROLES = ['editor', 'lectura'] as const
export type ProyectoParticipanteRol = (typeof PROYECTO_PARTICIPANTE_ROLES)[number]

export type ProyectoAccesoLean = {
  usuario_id?: mongoose.Types.ObjectId | string | null
  participantes?: Array<{
    usuario_id?: mongoose.Types.ObjectId | string | null
    rol?: string
  }>
}

export function esPropietarioProyecto(
  userId: string,
  proyecto: ProyectoAccesoLean,
): boolean {
  if (proyecto.usuario_id == null) return false
  return String(proyecto.usuario_id) === String(userId)
}

export function rolParticipanteEnProyecto(
  userId: string,
  proyecto: ProyectoAccesoLean,
): ProyectoParticipanteRol | null {
  const uid = String(userId)
  for (const p of proyecto.participantes ?? []) {
    if (p.usuario_id != null && String(p.usuario_id) === uid) {
      return p.rol === 'editor' ? 'editor' : 'lectura'
    }
  }
  return null
}

export function tienePermisoGlobalEditar(permisos: string[]): boolean {
  return permisos.includes('*') || permisos.includes('proyectos:editar')
}

/** Puede modificar el proyecto, tareas, transiciones, etc. */
export function usuarioPuedeEditarProyecto(
  userId: string,
  permisos: string[],
  proyecto: ProyectoAccesoLean,
): boolean {
  if (tienePermisoGlobalEditar(permisos)) return true
  if (esPropietarioProyecto(userId, proyecto)) return true
  return rolParticipanteEnProyecto(userId, proyecto) === 'editor'
}

/** Puede agregar o quitar participantes y cambiar sus roles. */
export function usuarioPuedeGestionarParticipantes(
  userId: string,
  permisos: string[],
  proyecto: ProyectoAccesoLean,
): boolean {
  if (permisos.includes('*')) return true
  if (esPropietarioProyecto(userId, proyecto)) return true
  if (tienePermisoGlobalEditar(permisos)) return true
  return rolParticipanteEnProyecto(userId, proyecto) === 'editor'
}

export function enrichProyectoAcceso<T extends Record<string, unknown>>(
  doc: T,
  userId: string,
  permisos: string[],
): T & {
  acceso: {
    puede_editar: boolean
    puede_gestionar_participantes: boolean
    rol_participante: ProyectoParticipanteRol | null
    es_propietario: boolean
  }
} {
  const lean: ProyectoAccesoLean = {
    usuario_id: doc.usuario_id as ProyectoAccesoLean['usuario_id'],
    participantes: doc.participantes as ProyectoAccesoLean['participantes'],
  }
  return {
    ...doc,
    acceso: {
      puede_editar: usuarioPuedeEditarProyecto(userId, permisos, lean),
      puede_gestionar_participantes: usuarioPuedeGestionarParticipantes(userId, permisos, lean),
      rol_participante: rolParticipanteEnProyecto(userId, lean),
      es_propietario: esPropietarioProyecto(userId, lean),
    },
  }
}

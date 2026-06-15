import type { Request } from 'express'
import mongoose from 'mongoose'

import { Proyecto } from '../db/models/Proyecto.js'
import { Usuario } from '../db/models/Usuario.js'
import {
  rolParticipanteEnProyecto,
  usuarioPuedeEditarProyecto,
  type ProyectoAccesoLean,
} from './proyectoPermisos.js'

type TareaPermisoLean = {
  responsable_id?: mongoose.Types.ObjectId | string | null
  proyecto_id: string
}

async function empleadoIdUsuario(req: Request): Promise<string | null> {
  const fromJwt = req.user?.empleado_id
  if (fromJwt) return String(fromJwt)
  const uid = req.user?._id
  if (!uid || !mongoose.isValidObjectId(uid)) return null
  const u = await Usuario.findById(uid).select('empleado_id').lean() as {
    empleado_id?: mongoose.Types.ObjectId | string | null
  } | null
  return u?.empleado_id ? String(u.empleado_id) : null
}

async function proyectoAcceso(proyectoId: string): Promise<ProyectoAccesoLean | null> {
  return Proyecto.findById(proyectoId)
    .select('usuario_id participantes')
    .lean() as Promise<ProyectoAccesoLean | null>
}

/** Dueño del proyecto, participante editor, responsable de la tarea o permiso global. */
export async function usuarioPuedeMoverTarea(
  req: Request,
  tarea: TareaPermisoLean,
): Promise<boolean> {
  const userId = req.user?._id
  if (!userId) return false

  const proyecto = await proyectoAcceso(tarea.proyecto_id)
  if (!proyecto) return false

  if (usuarioPuedeEditarProyecto(userId, req.user?.permisos ?? [], proyecto)) return true

  const empId = await empleadoIdUsuario(req)
  const respId = tarea.responsable_id ? String(tarea.responsable_id) : null
  if (empId && respId && empId === respId) return true

  return false
}

/** Puede crear, editar o eliminar tareas del proyecto. */
export async function usuarioPuedeEditarTareasProyecto(
  req: Request,
  proyectoId: string,
): Promise<boolean> {
  const userId = req.user?._id
  if (!userId) return false
  const proyecto = await proyectoAcceso(proyectoId)
  if (!proyecto) return false
  return usuarioPuedeEditarProyecto(userId, req.user?.permisos ?? [], proyecto)
}

/** Rol del usuario en el proyecto (null si no es participante explícito). */
export async function rolParticipanteUsuario(
  req: Request,
  proyectoId: string,
): Promise<'editor' | 'lectura' | null> {
  const userId = req.user?._id
  if (!userId) return null
  const proyecto = await proyectoAcceso(proyectoId)
  if (!proyecto) return null
  return rolParticipanteEnProyecto(userId, proyecto)
}

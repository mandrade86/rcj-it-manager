import type { Request } from 'express'
import mongoose from 'mongoose'

import { Proyecto } from '../db/models/Proyecto.js'
import { Usuario } from '../db/models/Usuario.js'

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

/** Dueño del proyecto o responsable asignado a la tarea. */
export async function usuarioPuedeMoverTarea(
  req: Request,
  tarea: TareaPermisoLean,
): Promise<boolean> {
  const userId = req.user?._id
  if (!userId) return false

  const proyecto = await Proyecto.findById(tarea.proyecto_id).select('usuario_id').lean() as {
    usuario_id?: mongoose.Types.ObjectId | string | null
  } | null
  if (!proyecto) return false

  const ownerId = proyecto.usuario_id ? String(proyecto.usuario_id) : null
  if (ownerId && ownerId === String(userId)) return true

  const empId = await empleadoIdUsuario(req)
  const respId = tarea.responsable_id ? String(tarea.responsable_id) : null
  if (empId && respId && empId === respId) return true

  return false
}

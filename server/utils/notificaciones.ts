import mongoose from 'mongoose'

import { Notificacion } from '../db/models/Notificacion.js'
import { Usuario } from '../db/models/Usuario.js'
import { appPublicUrl, enviarCorreo, isMailConfigured } from './mailer.js'
import { enviarTeams, isTeamsConfigured } from './teams.js'

type Actor = { _id: string; nombre?: string }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ROL_TEXTO: Record<string, string> = {
  responsable: 'como responsable',
  editor: 'como editor (puedes editar el proyecto y sus tareas)',
  lectura: 'como participante de solo lectura',
}

async function enviarAvisoUsuarios(opts: {
  usuarioIds: string[]
  actor: Actor
  tipo: string
  titulo: string
  detalle: string
  href: string
  mensaje: string
}): Promise<void> {
  const destinos = [...new Set(opts.usuarioIds)].filter(
    (id) => mongoose.isValidObjectId(id) && id !== String(opts.actor._id),
  )
  if (destinos.length === 0) {
    console.log(`[notif] sin destinatarios (actor=${opts.actor._id}, tipo=${opts.tipo})`)
    return
  }

  await Notificacion.insertMany(
    destinos.map((id) => ({
      usuario_id: id,
      tipo: opts.tipo,
      titulo: opts.titulo,
      detalle: opts.detalle,
      href: opts.href,
      creado_por: opts.actor.nombre || 'Alguien',
    })),
  )
  console.log(`[notif] ${destinos.length} aviso(s) en app · tipo=${opts.tipo} · ${opts.titulo}`)

  const porCorreo = isMailConfigured()
  const porTeams = isTeamsConfigured()
  if (!porCorreo && !porTeams) {
    console.warn('[notif] SendGrid y Teams no configurados; solo quedó el aviso en la app')
    return
  }

  const usuarios = await Usuario.find({
    _id: { $in: destinos },
    activo: { $ne: false },
  }).select('nombre email').lean() as unknown as Array<{ _id: unknown; nombre: string; email: string }>

  const url = `${appPublicUrl()}${opts.href}`
  await Promise.all(usuarios.map(async (usr) => {
    if (!usr.email) {
      console.warn(`[notif] usuario ${String(usr._id)} sin email`)
      return
    }
    if (porTeams) {
      const t = await enviarTeams({
        destinatario: usr.email,
        titulo: opts.titulo,
        mensaje: opts.mensaje,
        url,
        boton: 'Abrir en IT Manager',
      })
      if (!t.ok) console.warn(`[notif] Teams a ${usr.email}: ${t.error}`)
      else console.log(`[notif] Teams OK → ${usr.email}`)
    }
    if (!porCorreo) return
    const text = [
      `Hola ${usr.nombre},`,
      '',
      opts.mensaje,
      '',
      `Ver: ${url}`,
    ].join('\n')
    const html = `
      <p>Hola <strong>${escapeHtml(usr.nombre)}</strong>,</p>
      <p>${escapeHtml(opts.mensaje)}</p>
      <p><a href="${escapeHtml(url)}">Abrir en IT Manager</a></p>
    `
    const r = await enviarCorreo({ to: usr.email, subject: opts.titulo, text, html })
    if (!r.ok) console.warn(`[notif] correo a ${usr.email}: ${r.error}`)
    else console.log(`[notif] correo OK → ${usr.email}`)
  }))
}

/**
 * Avisa a cada usuario agregado a un proyecto (participante o responsable).
 * No lanza: un fallo de correo/Teams no debe romper el guardado.
 */
export async function notificarAgregadoAProyecto(opts: {
  proyectoId: string
  proyectoNombre: string
  usuarios: Array<{ usuario_id: string; rol: 'responsable' | 'editor' | 'lectura' }>
  actor: Actor
}): Promise<void> {
  try {
    const actorNombre = opts.actor.nombre || 'Alguien'
    const href = `/proyectos/${encodeURIComponent(opts.proyectoId)}`
    for (const u of opts.usuarios) {
      const rol = ROL_TEXTO[u.rol] ?? ''
      await enviarAvisoUsuarios({
        usuarioIds: [u.usuario_id],
        actor: opts.actor,
        tipo: 'proyecto_agregado',
        titulo: `Te agregaron al proyecto ${opts.proyectoNombre}`,
        detalle: `${actorNombre} te agregó ${rol} · ${opts.proyectoId}`,
        href,
        mensaje: `${actorNombre} te agregó al proyecto "${opts.proyectoNombre}" (${opts.proyectoId}) ${rol}.`,
      })
    }
  } catch (err) {
    console.warn('[notif] error al notificar asignación a proyecto:', err)
  }
}

/** Resuelve el usuario del portal ligado a un empleado (responsable de tarea). */
export async function usuarioIdDesdeEmpleado(empleadoId: string | null | undefined): Promise<string | null> {
  if (!empleadoId || !mongoose.isValidObjectId(empleadoId)) return null
  const u = await Usuario.findOne({
    empleado_id: empleadoId,
    activo: { $ne: false },
  }).select('_id').lean() as { _id?: unknown } | null
  return u?._id ? String(u._id) : null
}

/**
 * Avisa cuando se asigna (o reasigna) una tarea a un empleado con usuario en el portal.
 */
export async function notificarAsignacionTarea(opts: {
  tareaId: string
  tareaNombre: string
  proyectoId?: string | null
  proyectoNombre?: string
  responsableEmpleadoId: string | null | undefined
  actor: Actor
}): Promise<void> {
  try {
    const usuarioId = await usuarioIdDesdeEmpleado(opts.responsableEmpleadoId)
    if (!usuarioId) {
      console.log(`[notif] tarea ${opts.tareaId}: responsable sin usuario de portal, sin aviso`)
      return
    }
    const actorNombre = opts.actor.nombre || 'Alguien'
    const href = opts.proyectoId
      ? `/proyectos/${encodeURIComponent(opts.proyectoId)}`
      : '/mis-tareas'
    const proyectoTxt = opts.proyectoNombre
      ? ` del proyecto "${opts.proyectoNombre}"`
      : opts.proyectoId
        ? ` del proyecto ${opts.proyectoId}`
        : ''
    await enviarAvisoUsuarios({
      usuarioIds: [usuarioId],
      actor: opts.actor,
      tipo: 'tarea_asignada',
      titulo: `Te asignaron la tarea ${opts.tareaNombre}`,
      detalle: `${actorNombre} te asignó una tarea${proyectoTxt}`,
      href,
      mensaje: `${actorNombre} te asignó la tarea "${opts.tareaNombre}"${proyectoTxt}.`,
    })
  } catch (err) {
    console.warn('[notif] error al notificar asignación de tarea:', err)
  }
}

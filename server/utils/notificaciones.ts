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

/**
 * Crea la notificación en la app y avisa por correo y Teams a cada usuario agregado a un proyecto.
 * Nunca lanza: un fallo de correo o Teams no debe romper el guardado del proyecto.
 */
export async function notificarAgregadoAProyecto(opts: {
  proyectoId: string
  proyectoNombre: string
  usuarios: Array<{ usuario_id: string; rol: 'responsable' | 'editor' | 'lectura' }>
  actor: Actor
}): Promise<void> {
  try {
    const destinos = opts.usuarios.filter(
      (d) => mongoose.isValidObjectId(d.usuario_id) && d.usuario_id !== String(opts.actor._id),
    )
    if (destinos.length === 0) return

    const actorNombre = opts.actor.nombre || 'Alguien'
    const href = `/proyectos/${encodeURIComponent(opts.proyectoId)}`
    const titulo = `Te agregaron al proyecto ${opts.proyectoNombre}`

    await Notificacion.insertMany(
      destinos.map((d) => ({
        usuario_id: d.usuario_id,
        tipo: 'proyecto_agregado',
        titulo,
        detalle: `${actorNombre} te agregó ${ROL_TEXTO[d.rol] ?? ''} · ${opts.proyectoId}`,
        href,
        creado_por: actorNombre,
      })),
    )

    const porCorreo = isMailConfigured()
    const porTeams = isTeamsConfigured()
    if (!porCorreo && !porTeams) return
    const usuarios = await Usuario.find({
      _id: { $in: destinos.map((d) => d.usuario_id) },
      activo: { $ne: false },
    }).select('nombre email').lean() as unknown as Array<{ _id: unknown; nombre: string; email: string }>
    const rolPorId = new Map(destinos.map((d) => [d.usuario_id, d.rol]))
    const url = `${appPublicUrl()}${href}`

    await Promise.all(usuarios.map(async (usr) => {
      if (!usr.email) return
      const rol = ROL_TEXTO[rolPorId.get(String(usr._id)) ?? ''] ?? ''
      const mensaje = `${actorNombre} te agregó al proyecto "${opts.proyectoNombre}" (${opts.proyectoId}) ${rol}.`

      if (porTeams) {
        const t = await enviarTeams({
          destinatario: usr.email, titulo, mensaje, url, boton: 'Abrir proyecto',
        })
        if (!t.ok) console.warn(`Aviso de Teams a ${usr.email} no enviado: ${t.error}`)
      }
      if (!porCorreo) return

      const text = [
        `Hola ${usr.nombre},`,
        '',
        mensaje,
        '',
        `Ver proyecto: ${url}`,
      ].join('\n')
      const html = `
        <p>Hola <strong>${escapeHtml(usr.nombre)}</strong>,</p>
        <p>${escapeHtml(actorNombre)} te agregó al proyecto
          <strong>${escapeHtml(opts.proyectoNombre)}</strong> (${escapeHtml(opts.proyectoId)}) ${escapeHtml(rol)}.</p>
        <p><a href="${escapeHtml(url)}">Abrir proyecto en IT Manager</a></p>
      `
      const r = await enviarCorreo({ to: usr.email, subject: titulo, text, html })
      if (!r.ok) console.warn(`Notificación de proyecto a ${usr.email} no enviada: ${r.error}`)
    }))
  } catch (err) {
    console.warn('No se pudo notificar la asignación al proyecto:', err)
  }
}

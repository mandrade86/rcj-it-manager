import mongoose, { Schema } from 'mongoose'

/** Aviso persistente dirigido a un usuario (p. ej. "te agregaron a un proyecto"). */
const NotificacionSchema = new Schema(
  {
    usuario_id: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    tipo: { type: String, required: true },
    titulo: { type: String, required: true },
    detalle: { type: String, default: '' },
    href: { type: String, default: '/' },
    creado_por: { type: String, default: '' },
  },
  { timestamps: true },
)

NotificacionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })

export const Notificacion =
  mongoose.models.Notificacion ?? mongoose.model('Notificacion', NotificacionSchema)

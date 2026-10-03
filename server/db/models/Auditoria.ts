import mongoose, { Schema } from 'mongoose'

const AuditoriaSchema = new Schema(
  {
    usuario_id: { type: String, default: '' },
    usuario_nombre: { type: String, default: '' },
    accion: { type: String, required: true },
    entidad: { type: String, default: '' },
    entidad_id: { type: String, default: '' },
    detalle: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
)

AuditoriaSchema.index({ createdAt: -1 })

export const Auditoria =
  mongoose.models.Auditoria ?? mongoose.model('Auditoria', AuditoriaSchema)

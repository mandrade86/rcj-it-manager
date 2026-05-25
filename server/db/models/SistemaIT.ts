import mongoose, { Schema } from 'mongoose'

export const SISTEMA_ESTADOS = ['stable', 'warning', 'legacy'] as const
export type SistemaEstado = (typeof SISTEMA_ESTADOS)[number]

const SistemaITSchema = new Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, default: '' },
    estado: { type: String, enum: SISTEMA_ESTADOS, default: 'stable' },
    stack: { type: String, required: true },
    integraciones: { type: String, default: '' },
    responsable: { type: String, default: '' },
    notas: { type: String, default: '' },
    tags: { type: [String], default: [] },
    orden: { type: Number, default: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const SistemaIT =
  mongoose.models.SistemaIT ?? mongoose.model('SistemaIT', SistemaITSchema)

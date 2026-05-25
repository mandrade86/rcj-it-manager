import mongoose, { Schema } from 'mongoose'

const DescriptorPuestoSchema = new Schema(
  {
    codigo_puesto: { type: String, required: true, unique: true },
    titulo: { type: String, required: true },
    reporta_a: { type: String, default: '' },
    objetivo: { type: String, default: '' },
    requisitos: [{ type: String }],
    autoridad: [{ type: String }],
    responsabilidades: [{ type: String }],
    educacion: { type: String, default: '' },
    experiencia: { type: String, default: '' },
    competencias: [{ type: String }],
    notas: { type: String, default: '' },
  },
  { timestamps: true },
)

export const DescriptorPuesto =
  mongoose.models.DescriptorPuesto ??
  mongoose.model('DescriptorPuesto', DescriptorPuestoSchema)

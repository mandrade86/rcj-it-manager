import mongoose, { Schema } from 'mongoose'

export const COSTOS_IT_FUENTES = ['regla', 'ia', 'vista', 'manual'] as const
export type CostosItFuente = (typeof COSTOS_IT_FUENTES)[number]

const CostosItClasificacionSchema = new Schema(
  {
    row_hash: { type: String, required: true, unique: true, index: true },
    categoria: { type: String, required: true },
    subcategoria: { type: String, default: '' },
    tipo_gasto: {
      type: String,
      enum: ['recurrente', 'no_recurrente', 'extraordinario', ''],
      default: '',
    },
    fuente: { type: String, enum: COSTOS_IT_FUENTES, required: true },
    confianza: { type: Number, default: 1 },
    notas: { type: String, default: '' },
  },
  { timestamps: true },
)

export const CostosItClasificacion =
  mongoose.models.CostosItClasificacion
  ?? mongoose.model('CostosItClasificacion', CostosItClasificacionSchema)

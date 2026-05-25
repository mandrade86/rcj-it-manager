import mongoose, { Schema } from 'mongoose'

const PlantillaItemSchema = new Schema(
  {
    codigo: { type: String },
    seccion: { type: String },
    requisito: { type: String, required: true },
    tipo_requisito: {
      type: String,
      enum: ['Indispensable', 'Recomendado'],
    },
    plazo_estimado: { type: String },
    recurso: { type: String },
  },
  { _id: true },
)

const PlantillaCarreraSchema = new Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, default: '' },
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento' },
    tipo_ruta: { type: String, required: true },
    activo: { type: Boolean, default: true },
    items: [PlantillaItemSchema],
  },
  { timestamps: true },
)

export const PlantillaCarrera =
  mongoose.models.PlantillaCarrera ??
  mongoose.model('PlantillaCarrera', PlantillaCarreraSchema)

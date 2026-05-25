import mongoose, { Schema } from 'mongoose'

const PlanCarreraItemSchema = new Schema({
  codigo: String,
  seccion: String,
  requisito: { type: String, required: true },
  tipo_requisito: {
    type: String,
    enum: ['Indispensable', 'Recomendado'],
  },
  plazo_estimado: String,
  recurso: String,
  estado: {
    type: String,
    enum: ['Pendiente', 'En progreso', 'Completado'],
    default: 'Pendiente',
  },
  notas: String,
})

const PlanCarreraSchema = new Schema(
  {
    colaborador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Colaborador',
      required: true,
    },
    plantilla_id: { type: Schema.Types.ObjectId, ref: 'PlantillaCarrera' },
    tipo: { type: String, required: true },
    fecha_inicio: { type: Date },
    periodo_estimado: { type: String },
    responsable_seguimiento: { type: String },
    items: [PlanCarreraItemSchema],
  },
  { timestamps: true },
)

export const PlanCarrera =
  mongoose.models.PlanCarrera ?? mongoose.model('PlanCarrera', PlanCarreraSchema)

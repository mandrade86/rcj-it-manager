import mongoose, { Schema } from 'mongoose'

const CriterioSchema = new Schema(
  {
    categoria: String,
    criterio: String,
    calificacion: {
      type: String,
      enum: ['No cumple', 'En desarrollo', 'Cumple', 'Supera'],
    },
    comentario: String,
    accion_mejora: String,
  },
  { _id: false },
)

const EvaluacionSchema = new Schema(
  {
    colaborador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Colaborador',
      required: true,
    },
    /**
     * Tipo de evaluación:
     *  - 'autoevaluacion': la registra el propio colaborador.
     *  - 'jefe':           la registra su jefe / supervisor.
     */
    tipo: {
      type: String,
      enum: ['autoevaluacion', 'jefe'],
      default: 'jefe',
      index: true,
    },
    fecha: { type: Date, required: true },
    evaluado_por: { type: String },
    nivel_actual: {
      type: String,
      enum: ['Junior', 'Mid-Senior', 'Senior'],
    },
    resultado_global: {
      type: String,
      enum: ['No cumple', 'En desarrollo', 'Cumple', 'Supera'],
    },
    decision: {
      type: String,
      enum: ['Promover', 'Continuar', 'Plan de mejora'],
    },
    criterios: [CriterioSchema],
    comentarios: { type: String },
    firmas: {
      colaborador: { type: Boolean, default: false },
      coordinador: { type: Boolean, default: false },
      jefe: { type: Boolean, default: false },
      rrhh: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
)

export const Evaluacion =
  mongoose.models.Evaluacion ?? mongoose.model('Evaluacion', EvaluacionSchema)

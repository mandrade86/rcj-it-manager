import mongoose, { Schema } from 'mongoose'

/**
 * Ítem evaluado: corresponde a un KPI listado en
 * PerfilPuesto.kpis_evaluacion al momento de la evaluación.
 */
const EvalKpiItemSchema = new Schema(
  {
    kpi_id: { type: Schema.Types.ObjectId, ref: 'KPI', required: true },
    kpi_nombre: { type: String, required: true },
    kpi_eje: { type: String, default: '' },
    kpi_meta: { type: String, default: '' },
    kpi_unidad: { type: String, default: '' },
    peso: { type: Number, required: true, min: 0, max: 100 },
    valor_observado: { type: Number, default: null },
    /**
     * Porcentaje de cumplimiento (0-100+) calculado o ingresado manualmente.
     * El servidor usa este valor para el promedio ponderado.
     */
    cumplimiento_pct: { type: Number, default: 0 },
    comentario: { type: String, default: '' },
  },
  { _id: false },
)

const EvaluacionKpiSchema = new Schema(
  {
    colaborador_id: {
      type: Schema.Types.ObjectId,
      ref: 'Colaborador',
      required: true,
    },
    perfil_puesto_id: {
      type: Schema.Types.ObjectId,
      ref: 'PerfilPuesto',
      default: null,
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
    periodo: { type: String, default: '' }, // p.ej. "Q1 2026" / "Anual 2026"
    evaluado_por: { type: String, default: '' },
    items: { type: [EvalKpiItemSchema], default: [] },
    score_global: { type: Number, default: 0 }, // 0..100+ ponderado
    nivel_cumplimiento: {
      type: String,
      enum: ['No cumple', 'Parcial', 'Cumple', 'Supera'],
      default: 'No cumple',
    },
    decision: {
      type: String,
      enum: ['Promover', 'Continuar', 'Plan de mejora', 'Reconocer'],
      default: 'Continuar',
    },
    comentarios: { type: String, default: '' },
    firmas: {
      colaborador: { type: Boolean, default: false },
      coordinador: { type: Boolean, default: false },
      jefe: { type: Boolean, default: false },
      rrhh: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
)

EvaluacionKpiSchema.index({ colaborador_id: 1, fecha: -1 })

export const EvaluacionKPI =
  mongoose.models.EvaluacionKPI ??
  mongoose.model('EvaluacionKPI', EvaluacionKpiSchema)

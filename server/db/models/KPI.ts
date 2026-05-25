import mongoose, { Schema } from 'mongoose'

import { KPI_TIPOS_CALCULO } from '../data/kpiCalculoTipos.js'
const KpiRegistroSchema = new Schema(
  {
    fecha: { type: Date, required: true },
    valor: Number,
    notas: String,
  },
  { _id: false },
)

const KpiSchema = new Schema(
  {
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento' },
    /** Meta estratégica del departamento (continuidad, modernización, etc.). */
    meta_id: { type: String, index: true },
    /** Tipo/categoría (mismo criterio que el eje del proyecto para vincular). */
    tipo: { type: String, default: '' },
    eje: { type: String, required: true },
    nombre: { type: String, required: true },
    /** Proyectos vinculados explícitamente (también se sincroniza kpi_id en Proyecto). */
    /** IDs de proyecto (string: INV-001, AD-001, …). */
    proyecto_ids: {
      type: [{ type: String, ref: 'Proyecto' }],
      default: [],
    },
    descripcion: String,
    meta: String,
    unidad: String,
    frecuencia: {
      type: String,
      enum: ['Mensual', 'Trimestral', 'Anual', 'Único'],
    },
    responsable: String,
    /** Cómo calcular el % de cumplimiento (ver server/utils/kpiCalculo.ts). */
    tipo_calculo: {
      type: String,
      enum: KPI_TIPOS_CALCULO,
      default: 'auto_meta',
    },
    registros: [KpiRegistroSchema],
  },
  { timestamps: true },
)

KpiSchema.index({ departamento_id: 1, nombre: 1 }, { unique: false })

export const KPI = mongoose.models.KPI ?? mongoose.model('KPI', KpiSchema)

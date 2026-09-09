import mongoose, { Schema } from 'mongoose'

const GastosItAnalisisReglasSchema = new Schema(
  {
    clave: { type: String, required: true, unique: true, default: 'gastos_it_analisis' },
    variacion_relevante_pct: { type: Number, default: 20 },
    variacion_critica_pct: { type: Number, default: 40 },
    meses_promedio_anomalia: { type: Number, default: 6 },
    meses_min_recurrente: { type: Number, default: 3 },
    top_proveedores: { type: Number, default: 10 },
    top_concentracion: { type: Number, default: 5 },
  },
  { timestamps: true },
)

export const GastosItAnalisisReglas =
  mongoose.models.GastosItAnalisisReglas
  ?? mongoose.model('GastosItAnalisisReglas', GastosItAnalisisReglasSchema)

import mongoose, { Schema } from 'mongoose'

/**
 * Registro de un período de vacaciones gozado (o programado) por un empleado.
 * Se descuenta del derecho devengado por la Ley HN (Art. 346).
 */
const RegistroVacacionSchema = new Schema(
  {
    empleado_id: { type: Schema.Types.ObjectId, ref: 'Empleado', required: true },
    fecha_inicio: { type: Date, required: true },
    fecha_fin: { type: Date, required: true },
    dias_habiles: { type: Number, required: true, min: 0 },
    estado: {
      type: String,
      enum: ['Programado', 'Aprobado', 'Gozado', 'Cancelado'],
      default: 'Aprobado',
    },
    notas: { type: String, default: '' },
    registrado_por: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
  },
  { timestamps: true },
)

RegistroVacacionSchema.index({ empleado_id: 1, fecha_inicio: 1 })

export const RegistroVacacion =
  mongoose.models.RegistroVacacion ??
  mongoose.model('RegistroVacacion', RegistroVacacionSchema)

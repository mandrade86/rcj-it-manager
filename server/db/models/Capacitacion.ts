import mongoose, { Schema } from 'mongoose'

const AsignadoSchema = new Schema(
  {
    colaborador_id: { type: Schema.Types.ObjectId, ref: 'Colaborador' },
    estado: {
      type: String,
      enum: ['Pendiente', 'En progreso', 'Completado'],
      default: 'Pendiente',
    },
    fecha_completado: Date,
    calificacion: Number,
    /** URL / ruta al archivo del certificado o diploma de prueba (opcional). */
    certificado: String,
    /** Nombre original del archivo subido (para mostrar al usuario). */
    certificado_nombre: String,
  },
  { _id: false },
)

const CapacitacionSchema = new Schema(
  {
    nombre: { type: String, required: true },
    /** Proveedor amarrado al catálogo (master). Tiene preferencia sobre `proveedor`. */
    proveedor_id: { type: Schema.Types.ObjectId, ref: 'ProveedorCapacitacion', default: null },
    /** Nombre libre del proveedor (compat. con datos previos / proveedores ad-hoc). */
    proveedor: { type: String, default: '' },
    /** Departamentos elegibles para esta capacitación.
     *  Vacío = abierta a todos los departamentos. */
    departamentos_ids: [{ type: Schema.Types.ObjectId, ref: 'Departamento' }],
    modalidad: {
      type: String,
      enum: ['Online', 'Presencial', 'Mixto'],
    },
    duracion_horas: Number,
    costo: Number,
    fecha_inicio: Date,
    fecha_fin: Date,
    estado: {
      type: String,
      enum: ['Pendiente', 'En progreso', 'Completado'],
      default: 'Pendiente',
    },
    asignados: [AsignadoSchema],
  },
  { timestamps: true },
)

export const Capacitacion =
  mongoose.models.Capacitacion ?? mongoose.model('Capacitacion', CapacitacionSchema)

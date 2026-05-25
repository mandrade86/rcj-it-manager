import mongoose, { Schema } from 'mongoose'

const EmpleadoSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true },
    nombre: { type: String, required: true },
    puesto: { type: String, default: '' },
    departamento: { type: String, default: '' },
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento', default: null },
    /** Departamentos cuya dotación entra en Mi Equipo (jefes con varias áreas). */
    departamentos_a_cargo: [{ type: Schema.Types.ObjectId, ref: 'Departamento' }],
    email: { type: String, default: '' },
    telefono: { type: String, default: '' },
    jefe_id: { type: Schema.Types.ObjectId, ref: 'Empleado', default: null },
    foto_url: { type: String, default: '' },
    activo: { type: Boolean, default: true },
    fecha_ingreso: { type: Date, default: null },
    datos_externos: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const Empleado =
  mongoose.models.Empleado ?? mongoose.model('Empleado', EmpleadoSchema)

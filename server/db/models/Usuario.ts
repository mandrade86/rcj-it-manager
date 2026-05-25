import mongoose, { Schema } from 'mongoose'

const UsuarioSchema = new Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    rol_id: { type: Schema.Types.ObjectId, ref: 'Rol', required: true },
    /**
     * Identidad del usuario en el maestro de empleados (su "número de empleado").
     * Punto de partida principal del alcance: sus subordinados se descubren
     * automáticamente vía Empleado.jefe_id == empleado_id.
     */
    empleado_id: { type: Schema.Types.ObjectId, ref: 'Empleado', default: null },
    /** Asignaciones adicionales explícitas (empleados visibles además de tu cadena por jefe_id). */
    empleados_ids: [{ type: Schema.Types.ObjectId, ref: 'Empleado' }],
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento', default: null },
    activo: { type: Boolean, default: true },
    ultimo_acceso: { type: Date, default: null },
  },
  { timestamps: true },
)

export const Usuario = mongoose.models.Usuario ?? mongoose.model('Usuario', UsuarioSchema)

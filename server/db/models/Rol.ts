import mongoose, { Schema } from 'mongoose'

const RolSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true },
    descripcion: { type: String, default: '' },
    /** Primer departamento (legacy / orden); usar `departamentos_ids` para varios. */
    departamento_id: { type: Schema.Types.ObjectId, ref: 'Departamento', default: null },
    departamentos_ids: [{ type: Schema.Types.ObjectId, ref: 'Departamento' }],
    /**
     * Perfil de puesto sugerido para usuarios con este rol. Permite vincular
     * la estructura de permisos del rol al perfil organizacional (descriptor
     * de puesto) correspondiente.
     */
    perfil_puesto_id: { type: Schema.Types.ObjectId, ref: 'PerfilPuesto', default: null },
    permisos: [{ type: String }],
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const Rol = mongoose.models.Rol ?? mongoose.model('Rol', RolSchema)

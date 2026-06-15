import mongoose, { Schema } from 'mongoose'

const UsuarioSchema = new Schema(
  {
    nombre: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** Usuario AD sin sufijo @dominio (ej. nombre.apellido). */
    login_dominio: { type: String, default: '', sparse: true, index: true },
    /** Si true, el acceso es solo con credenciales de dominio (login_dominio). */
    es_usuario_dominio: { type: Boolean, default: false },
    /** Hash bcrypt; opcional si el usuario solo entra con Active Directory. */
    password: { type: String, default: '' },
    /** Legado Entra ID (sin uso; login vía AD/EHR). */
    microsoft_oid: { type: String, default: '', sparse: true, index: true },
    mfa_enabled: { type: Boolean, default: false },
    /** Secreto TOTP (Base32) activo cuando mfa_enabled es true. */
    mfa_secret: { type: String, default: '' },
    /** Secreto temporal mientras el usuario confirma el enrolamiento MFA. */
    mfa_pending_secret: { type: String, default: '' },
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

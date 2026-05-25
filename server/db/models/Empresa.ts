import mongoose, { Schema } from 'mongoose'

const EmpresaSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, default: '' },
    color: { type: String, default: '#002060' },
    activo: { type: Boolean, default: true },
    /** ID de empresa en el EHR RCJ (`empresaId` en /api/Company/list). */
    ehr_empresa_id: { type: Number, unique: true, sparse: true, index: true },
    origen: { type: String, enum: ['manual', 'ehr'], default: 'manual' },
  },
  { timestamps: true },
)

export const Empresa =
  mongoose.models.Empresa ?? mongoose.model('Empresa', EmpresaSchema)

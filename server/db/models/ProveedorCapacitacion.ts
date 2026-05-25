import mongoose, { Schema } from 'mongoose'

const ProveedorCapacitacionSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true },
    descripcion: { type: String, default: '' },
    sitio_web: { type: String, default: '' },
    contacto: { type: String, default: '' },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const ProveedorCapacitacion =
  mongoose.models.ProveedorCapacitacion ??
  mongoose.model('ProveedorCapacitacion', ProveedorCapacitacionSchema)

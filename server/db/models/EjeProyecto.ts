import mongoose, { Schema } from 'mongoose'

/**
 * Catálogo global de ejes/categorías de proyecto (como las fases 1–3, pero texto).
 * `nombre` es el valor guardado en `Proyecto.eje` y en `Departamento.ejes_proyecto`.
 */
const EjeProyectoSchema = new Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nombre: { type: String, required: true, trim: true },
    descripcion: { type: String, default: '' },
    color: { type: String, default: '#1F4E79' },
    orden: { type: Number, default: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
)

EjeProyectoSchema.index({ orden: 1, nombre: 1 })

export const EjeProyecto =
  mongoose.models.EjeProyecto ?? mongoose.model('EjeProyecto', EjeProyectoSchema)

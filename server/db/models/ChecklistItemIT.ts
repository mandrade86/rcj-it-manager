import mongoose, { Schema } from 'mongoose'

const ChecklistItemITSchema = new Schema(
  {
    categoria: { type: String, required: true },
    texto: { type: String, required: true },
    orden: { type: Number, default: 0 },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const ChecklistItemIT =
  mongoose.models.ChecklistItemIT ?? mongoose.model('ChecklistItemIT', ChecklistItemITSchema)

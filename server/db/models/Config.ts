import mongoose, { Schema } from 'mongoose'

const ConfigSchema = new Schema(
  {
    clave: { type: String, required: true, unique: true },
    valor: { type: String },
  },
  { timestamps: true },
)

export const Config = mongoose.models.Config ?? mongoose.model('Config', ConfigSchema)

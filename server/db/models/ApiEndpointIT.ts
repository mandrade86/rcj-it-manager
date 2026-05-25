import mongoose, { Schema } from 'mongoose'

export const ENDPOINT_METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

const ApiEndpointITSchema = new Schema(
  {
    grupo: { type: String, required: true },
    metodo: { type: String, enum: ENDPOINT_METODOS, required: true },
    path: { type: String, required: true },
    descripcion: { type: String, default: '' },
    version: { type: String, default: 'v1' },
    notas: { type: String, default: '' },
    activo: { type: Boolean, default: true },
    orden: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const ApiEndpointIT =
  mongoose.models.ApiEndpointIT ?? mongoose.model('ApiEndpointIT', ApiEndpointITSchema)

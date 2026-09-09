import mongoose, { Schema } from 'mongoose'

export type GastosItSubcategoria = {
  id: string
  nombre: string
  activo: boolean
}

export type GastosItCategoria = {
  id: string
  nombre: string
  activo: boolean
  subcategorias: GastosItSubcategoria[]
}

const SubcategoriaSchema = new Schema(
  {
    id: { type: String, required: true },
    nombre: { type: String, required: true },
    activo: { type: Boolean, default: true },
  },
  { _id: false },
)

const CategoriaSchema = new Schema(
  {
    id: { type: String, required: true },
    nombre: { type: String, required: true },
    activo: { type: Boolean, default: true },
    subcategorias: { type: [SubcategoriaSchema], default: [] },
  },
  { _id: false },
)

const GastosItCategoriaConfigSchema = new Schema(
  {
    clave: { type: String, required: true, unique: true, default: 'gastos_it_categorias' },
    categorias: { type: [CategoriaSchema], default: [] },
  },
  { timestamps: true },
)

export const GastosItCategoriaConfig =
  mongoose.models.GastosItCategoriaConfig
  ?? mongoose.model('GastosItCategoriaConfig', GastosItCategoriaConfigSchema)

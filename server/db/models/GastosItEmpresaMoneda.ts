import mongoose, { Schema } from 'mongoose'

/** Moneda operativa de una empresa del grupo (para presupuesto / gastos IT). */
export const MONEDAS_EMPRESA = ['USD', 'HNL'] as const
export type MonedaEmpresa = (typeof MONEDAS_EMPRESA)[number]

const GastosItEmpresaMonedaSchema = new Schema(
  {
    empresa: { type: String, required: true, unique: true, trim: true, index: true },
    moneda: { type: String, required: true, enum: MONEDAS_EMPRESA, default: 'USD' },
  },
  { timestamps: true },
)

export const GastosItEmpresaMoneda =
  mongoose.models.GastosItEmpresaMoneda
  ?? mongoose.model('GastosItEmpresaMoneda', GastosItEmpresaMonedaSchema)

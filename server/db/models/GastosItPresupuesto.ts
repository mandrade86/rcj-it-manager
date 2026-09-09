import mongoose, { Schema } from 'mongoose'

/**
 * Presupuesto IT por empresa + cuenta contable.
 * No existe presupuesto global: siempre requiere empresa.
 */
const GastosItPresupuestoSchema = new Schema(
  {
    anio: { type: Number, required: true, index: true },
    mes: { type: Number, required: true, min: 1, max: 12, index: true },
    empresa: { type: String, required: true, trim: true, index: true },
    cuenta: { type: String, required: true, index: true },
    cuenta_nombre: { type: String, default: '' },
    /** Monto en la moneda de la empresa (USD o HNL). */
    monto: { type: Number, required: true, default: 0 },
    /** @deprecated Usar `monto`. Se mantiene por compatibilidad con datos previos. */
    monto_usd: { type: Number, default: 0 },
    moneda: { type: String, enum: ['USD', 'HNL'], default: 'USD' },
    notas: { type: String, default: '' },
  },
  { timestamps: true },
)

GastosItPresupuestoSchema.index(
  { anio: 1, mes: 1, empresa: 1, cuenta: 1 },
  { unique: true },
)

/** Elimina el índice legacy sin empresa (presupuesto global). */
export async function ensurePresupuestoIndexes(): Promise<void> {
  try {
    const col = mongoose.connection.collection('gastositpresupuestos')
    const indexes = await col.indexes()
    for (const idx of indexes) {
      const keys = Object.keys(idx.key ?? {})
      const isLegacy =
        idx.unique
        && keys.includes('anio')
        && keys.includes('mes')
        && keys.includes('cuenta')
        && !keys.includes('empresa')
      if (isLegacy && idx.name) {
        await col.dropIndex(idx.name)
      }
    }
  } catch {
    /* colección aún no existe o índice ya eliminado */
  }
}

export const GastosItPresupuesto =
  mongoose.models.GastosItPresupuesto
  ?? mongoose.model('GastosItPresupuesto', GastosItPresupuestoSchema)

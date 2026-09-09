import { querySapBiGeneric } from './sapBiGenericQuery.js'
import { rowHash } from './costosItCategorize.js'
import { resolveCostosItConnection, getCostosItFields } from './sapCostosItConfig.js'
import type { CostosItFieldMap } from './sapCostosItFields.js'

export type CuentaItCatalogo = {
  cuenta: string
  nombre: string
  transacciones: number
  monto_total: number
}

function toNumber(value: unknown): number {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toDateIso(value: unknown): string | null {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function str(value: unknown): string {
  return String(value ?? '').trim()
}

function pickNombreCuenta(row: Record<string, unknown>, fields: CostosItFieldMap): string {
  const candidatos = [
    fields.cuenta_nombre ? str(row[fields.cuenta_nombre]) : '',
    str(row.NombreCuenta),
    str(row.AcctName),
    str(row.nombre_cuenta),
  ].filter(Boolean)
  return candidatos[0] ?? ''
}

async function fetchRawRowsRango(
  desde: string,
  hasta: string,
  fields: CostosItFieldMap,
  viewName: string,
  sapCfg: Parameters<typeof querySapBiGeneric>[0],
) {
  const raw = await querySapBiGeneric(sapCfg, viewName, fields, { desde, hasta })
  return raw
    .map((row) => {
      const fecha = toDateIso(row.fecha)
      const monto = Math.abs(toNumber(row.monto ?? row.total_linea))
      const cuenta = str(row.cuenta)
      return {
        cuenta,
        cuenta_nombre: pickNombreCuenta(row, fields),
        monto,
        fecha,
        row_hash: rowHash([fecha, monto, str(row.descripcion), str(row.proveedor), str(row.documento), cuenta]),
      }
    })
    .filter((f) => f.monto !== 0 && f.cuenta)
}

/** Catálogo de cuentas contables usadas en gastos IT (desde SAP). */
export async function listCuentasItDesdeSap(opts?: { anio?: number }): Promise<CuentaItCatalogo[]> {
  const now = new Date()
  const anio = opts?.anio ?? now.getFullYear()
  const desde = `${anio - 1}-01-01`
  const hasta = `${anio}-12-31`

  const { sapCfg, itCfg } = await resolveCostosItConnection()
  const fields = await getCostosItFields(sapCfg, itCfg)
  const rows = await fetchRawRowsRango(desde, hasta, fields, itCfg.viewName, sapCfg)

  const map = new Map<string, { nombre: string; n: number; monto: number }>()
  for (const r of rows) {
    const c = map.get(r.cuenta) ?? { nombre: r.cuenta_nombre, n: 0, monto: 0 }
    if (r.cuenta_nombre && (!c.nombre || c.nombre === r.cuenta)) c.nombre = r.cuenta_nombre
    c.n += 1
    c.monto += r.monto
    map.set(r.cuenta, c)
  }

  return [...map.entries()]
    .map(([cuenta, v]) => ({
      cuenta,
      nombre: v.nombre || cuenta,
      transacciones: v.n,
      monto_total: v.monto,
    }))
    .sort((a, b) => a.cuenta.localeCompare(b.cuenta, 'es'))
}

export function normalizeCuentaKey(cuenta: string): string {
  return cuenta.trim()
}

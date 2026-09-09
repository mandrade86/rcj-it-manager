import { querySapBiGeneric } from './sapBiGenericQuery.js'
import { resolveCostosItConnection, getCostosItFields } from './sapCostosItConfig.js'
import type { CostosItFieldMap } from './sapCostosItFields.js'
import { monedaDeEmpresa, loadEmpresasMonedaMap, type MonedaEmpresa } from './gastosItEmpresaMoneda.js'

export type GastoCuentaDetalle = {
  fecha: string | null
  empresa: string
  proveedor: string
  descripcion: string
  documento: string
  cuenta: string
  cuenta_nombre: string
  monto: number
  moneda: MonedaEmpresa
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

function ultimoDiaMes(anio: number, mes: number): string {
  return new Date(anio, mes, 0).toISOString().slice(0, 10)
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

/**
 * Gastos reales de una cuenta (y opcionalmente empresa) desde la vista de costos IT.
 * Usado al expandir el detalle de presupuesto por cuenta.
 */
export async function fetchGastosPorCuenta(opts: {
  anio: number
  mes?: number
  empresa: string
  cuenta: string
}): Promise<{
  empresa: string
  cuenta: string
  moneda: MonedaEmpresa
  total: number
  gastos: GastoCuentaDetalle[]
}> {
  const empresa = opts.empresa.trim()
  const cuenta = opts.cuenta.trim()
  if (!empresa) throw new Error('Debe indicar la empresa (no hay presupuesto global).')
  if (!cuenta) throw new Error('Debe indicar la cuenta contable.')

  const anio = opts.anio
  const desde = opts.mes != null ? `${anio}-${String(opts.mes).padStart(2, '0')}-01` : `${anio}-01-01`
  const hasta =
    opts.mes != null ? ultimoDiaMes(anio, opts.mes) : `${anio}-12-31`

  const monedas = await loadEmpresasMonedaMap()
  const moneda = monedaDeEmpresa(monedas, empresa)

  const { sapCfg, itCfg } = await resolveCostosItConnection()
  const fields = await getCostosItFields(sapCfg, itCfg)
  const raw = await querySapBiGeneric(sapCfg, itCfg.viewName, fields, { desde, hasta })

  const gastos: GastoCuentaDetalle[] = []
  for (const row of raw) {
    const emp = str(row.empresa)
    const cta = str(row.cuenta)
    if (emp !== empresa) continue
    if (cta !== cuenta) continue
    const monto = Math.abs(toNumber(row.monto ?? row.total_linea))
    if (monto === 0) continue
    gastos.push({
      fecha: toDateIso(row.fecha),
      empresa: emp,
      proveedor: str(row.proveedor),
      descripcion: str(row.descripcion),
      documento: str(row.documento),
      cuenta: cta,
      cuenta_nombre: pickNombreCuenta(row, fields),
      monto,
      moneda,
    })
  }

  gastos.sort((a, b) => String(b.fecha ?? '').localeCompare(String(a.fecha ?? '')))
  const total = gastos.reduce((s, g) => s + g.monto, 0)

  return { empresa, cuenta, moneda, total, gastos }
}

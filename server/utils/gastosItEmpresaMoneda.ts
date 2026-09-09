import { GastosItEmpresaMoneda, type MonedaEmpresa, MONEDAS_EMPRESA } from '../db/models/GastosItEmpresaMoneda.js'

export { MONEDAS_EMPRESA }
export type { MonedaEmpresa }

export type EmpresaMonedaItem = {
  empresa: string
  moneda: MonedaEmpresa
}

export async function loadEmpresasMonedaMap(): Promise<Map<string, MonedaEmpresa>> {
  const rows = await GastosItEmpresaMoneda.find({}).lean()
  const map = new Map<string, MonedaEmpresa>()
  for (const r of rows) {
    const emp = String(r.empresa ?? '').trim()
    if (!emp) continue
    const mon = String(r.moneda ?? 'USD').toUpperCase()
    map.set(emp, mon === 'HNL' ? 'HNL' : 'USD')
  }
  return map
}

export function monedaDeEmpresa(
  map: Map<string, MonedaEmpresa>,
  empresa: string | null | undefined,
  fallback: MonedaEmpresa = 'USD',
): MonedaEmpresa {
  const emp = String(empresa ?? '').trim()
  if (!emp) return fallback
  return map.get(emp) ?? fallback
}

export async function listEmpresasMoneda(): Promise<EmpresaMonedaItem[]> {
  const rows = await GastosItEmpresaMoneda.find({}).sort({ empresa: 1 }).lean()
  return rows.map((r) => ({
    empresa: String(r.empresa).trim(),
    moneda: (String(r.moneda).toUpperCase() === 'HNL' ? 'HNL' : 'USD') as MonedaEmpresa,
  }))
}

export async function saveEmpresasMoneda(
  items: Array<{ empresa: string; moneda: string }>,
): Promise<EmpresaMonedaItem[]> {
  const ops = items
    .map((item) => {
      const empresa = String(item.empresa ?? '').trim()
      if (!empresa) return null
      const moneda: MonedaEmpresa = String(item.moneda ?? 'USD').toUpperCase() === 'HNL' ? 'HNL' : 'USD'
      return {
        updateOne: {
          filter: { empresa },
          update: { $set: { moneda } },
          upsert: true,
        },
      }
    })
    .filter(Boolean)

  if (ops.length) await GastosItEmpresaMoneda.bulkWrite(ops)
  return listEmpresasMoneda()
}

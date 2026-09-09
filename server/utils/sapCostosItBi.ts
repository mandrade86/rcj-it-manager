import { querySapBiGeneric } from './sapBiGenericQuery.js'
import {
  aplicarCategoriaOrigen,
  categorizarPorReglas,
  categorizarPorReglasPrioritarias,
  debeUsarCategoriaSap,
  clasificarSoporteControlPresupuesto,
  CATEGORIAS_IT,
  loadClasificacionesMap,
  rowHash,
  saveClasificaciones,
  type CostosItFila,
} from './costosItCategorize.js'
import type { SapBiCosteoConfig } from './sapBiCosteoConfig.js'
import {
  getCostosItFields,
  setUltimoSyncCostosIt,
  type CostosItConfig,
} from './sapCostosItConfig.js'
import type { CostosItFieldMap } from './sapCostosItFields.js'

export const MONEDA_COSTOS_IT = 'USD'

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

function anioFromFecha(fecha: string | null): number | null {
  if (!fecha) return null
  const y = Number(fecha.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function mapRawRows(raw: Record<string, unknown>[]): Omit<CostosItFila, 'categoria' | 'fuente_categoria' | 'confianza' | 'anio'>[] {
  return raw.map((row) => {
    const fecha = toDateIso(row.fecha)
    const monto = Math.abs(toNumber(row.monto ?? row.total_linea))
    const descripcion = str(row.descripcion)
    const proveedor = str(row.proveedor)
    const documento = str(row.documento)
    const cuenta = str(row.cuenta)
    const empresa = str(row.empresa)
    const categoria_origen = str(row.categoria_origen)
    const departamento = str(row.departamento)
    const tipo = str(row.tipo)

    return {
      row_hash: rowHash([fecha, monto, descripcion, proveedor, documento, cuenta]),
      fecha,
      monto,
      descripcion,
      proveedor,
      documento,
      cuenta,
      empresa,
      categoria_origen,
      departamento,
      tipo,
    }
  })
}

export type CostosItComparacionAnual = {
  anio_base: number
  anio_comp: number
  total_base: number
  total_comp: number
  variacion_usd: number
  variacion_pct: number
  por_categoria: Array<{
    categoria: string
    monto_base: number
    monto_comp: number
    variacion_usd: number
    variacion_pct: number
  }>
}

export type CostosItDashboard = {
  moneda: typeof MONEDA_COSTOS_IT
  resumen: {
    total: number
    transacciones: number
    promedio: number
    periodo_desde: string | null
    periodo_hasta: string | null
    anio_base: number
    anio_comp: number
    empresa_filtro: string | null
    categoria_filtro: string | null
  }
  empresas: string[]
  categorias_disponibles: string[]
  por_categoria: Array<{ categoria: string; monto: number; pct: number; transacciones: number }>
  por_mes: Array<{ mes: string; monto: number; transacciones: number }>
  evolucion_mensual: Array<{ mes: string; mes_label: string; monto_base: number; monto_comp: number }>
  por_anio: Array<{ anio: number; monto: number; transacciones: number }>
  por_categoria_anio: Array<{ anio: number; categoria: string; monto: number; transacciones: number }>
  comparacion: CostosItComparacionAnual
  top_proveedores: Array<{ proveedor: string; monto: number; transacciones: number }>
  filas: CostosItFila[]
  categorizacion: {
    reglas: number
    ia: number
    vista: number
    manual: number
    pendiente: number
  }
  vista: string
  campos_mapeados: CostosItFieldMap
  ultimo_sync: string | null
  aviso?: string | null
}

function mesKey(fecha: string | null): string {
  if (!fecha) return 'Sin fecha'
  return fecha.slice(0, 7)
}

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const

function buildEvolucionMensual(
  filas: CostosItFila[],
  anioBase: number,
  anioComp: number,
): CostosItDashboard['evolucion_mensual'] {
  const montos = new Map<string, number>()

  for (const f of filas) {
    if (f.anio !== anioBase && f.anio !== anioComp) continue
    const mk = mesKey(f.fecha)
    if (mk === 'Sin fecha') continue
    const mesNum = mk.slice(5, 7)
    const key = `${f.anio}|${mesNum}`
    montos.set(key, (montos.get(key) ?? 0) + f.monto)
  }

  return MESES_LABEL.map((mes_label, i) => {
    const mes = String(i + 1).padStart(2, '0')
    return {
      mes,
      mes_label,
      monto_base: montos.get(`${anioBase}|${mes}`) ?? 0,
      monto_comp: montos.get(`${anioComp}|${mes}`) ?? 0,
    }
  })
}

function pctVar(actual: number, anterior: number): number {
  if (anterior === 0) return actual > 0 ? 100 : 0
  return ((actual - anterior) / anterior) * 100
}

function buildComparacion(
  filas: CostosItFila[],
  anioBase: number,
  anioComp: number,
): CostosItComparacionAnual {
  const baseFilas = filas.filter((f) => f.anio === anioBase)
  const compFilas = filas.filter((f) => f.anio === anioComp)

  const totalBase = baseFilas.reduce((s, f) => s + f.monto, 0)
  const totalComp = compFilas.reduce((s, f) => s + f.monto, 0)

  const catMap = new Map<string, { base: number; comp: number }>()
  for (const cat of CATEGORIAS_IT) {
    catMap.set(cat, { base: 0, comp: 0 })
  }

  for (const f of baseFilas) {
    const c = catMap.get(f.categoria) ?? { base: 0, comp: 0 }
    c.base += f.monto
    catMap.set(f.categoria, c)
  }
  for (const f of compFilas) {
    const c = catMap.get(f.categoria) ?? { base: 0, comp: 0 }
    c.comp += f.monto
    catMap.set(f.categoria, c)
  }

  const por_categoria = [...catMap.entries()]
    .map(([categoria, v]) => ({
      categoria,
      monto_base: v.base,
      monto_comp: v.comp,
      variacion_usd: v.base - v.comp,
      variacion_pct: pctVar(v.base, v.comp),
    }))
    .filter((c) => c.monto_base > 0 || c.monto_comp > 0)
    .sort((a, b) => b.monto_base - a.monto_base)

  return {
    anio_base: anioBase,
    anio_comp: anioComp,
    total_base: totalBase,
    total_comp: totalComp,
    variacion_usd: totalBase - totalComp,
    variacion_pct: pctVar(totalBase, totalComp),
    por_categoria,
  }
}

function buildAgregados(
  filas: CostosItFila[],
  anioFoco: number,
  anioComp: number,
): Pick<
  CostosItDashboard,
  | 'resumen'
  | 'por_categoria'
  | 'por_mes'
  | 'evolucion_mensual'
  | 'por_anio'
  | 'por_categoria_anio'
  | 'top_proveedores'
  | 'categorizacion'
> {
  const filasAnio = filas.filter((f) => f.anio === anioFoco)
  const total = filasAnio.reduce((s, f) => s + f.monto, 0)
  const fechas = filasAnio.map((f) => f.fecha).filter(Boolean) as string[]
  fechas.sort()

  const porCat = new Map<string, { monto: number; n: number }>()
  const porMes = new Map<string, { monto: number; n: number }>()
  const porAnio = new Map<number, { monto: number; n: number }>()
  const porCatAnio = new Map<string, { monto: number; n: number }>()
  const porProv = new Map<string, { monto: number; n: number }>()
  const stats = { reglas: 0, ia: 0, vista: 0, manual: 0, pendiente: 0 }

  for (const f of filas) {
    if (f.anio != null) {
      const a = porAnio.get(f.anio) ?? { monto: 0, n: 0 }
      a.monto += f.monto
      a.n += 1
      porAnio.set(f.anio, a)
    }

    const keyCatAnio = `${f.anio ?? 0}|${f.categoria}`
    const ca = porCatAnio.get(keyCatAnio) ?? { monto: 0, n: 0 }
    ca.monto += f.monto
    ca.n += 1
    porCatAnio.set(keyCatAnio, ca)
  }

  for (const f of filasAnio) {
    const cat = f.categoria || 'Otros'
    const c1 = porCat.get(cat) ?? { monto: 0, n: 0 }
    c1.monto += f.monto
    c1.n += 1
    porCat.set(cat, c1)

    const mk = mesKey(f.fecha)
    const c2 = porMes.get(mk) ?? { monto: 0, n: 0 }
    c2.monto += f.monto
    c2.n += 1
    porMes.set(mk, c2)

    const prov = f.proveedor || 'Sin proveedor'
    const c3 = porProv.get(prov) ?? { monto: 0, n: 0 }
    c3.monto += f.monto
    c3.n += 1
    porProv.set(prov, c3)

    if (f.fuente_categoria === 'regla') stats.reglas += 1
    else if (f.fuente_categoria === 'ia') stats.ia += 1
    else if (f.fuente_categoria === 'vista') stats.vista += 1
    else if (f.fuente_categoria === 'manual') stats.manual += 1
    else stats.pendiente += 1
  }

  const por_categoria = [...porCat.entries()]
    .map(([categoria, v]) => ({
      categoria,
      monto: v.monto,
      pct: total > 0 ? (v.monto / total) * 100 : 0,
      transacciones: v.n,
    }))
    .sort((a, b) => b.monto - a.monto)

  const por_mes = [...porMes.entries()]
    .map(([mes, v]) => ({ mes, monto: v.monto, transacciones: v.n }))
    .sort((a, b) => a.mes.localeCompare(b.mes))

  const por_anio = [...porAnio.entries()]
    .map(([anio, v]) => ({ anio, monto: v.monto, transacciones: v.n }))
    .sort((a, b) => a.anio - b.anio)

  const por_categoria_anio = [...porCatAnio.entries()]
    .map(([key, v]) => {
      const [anioStr, categoria] = key.split('|')
      return {
        anio: Number(anioStr),
        categoria,
        monto: v.monto,
        transacciones: v.n,
      }
    })
    .filter((r) => r.anio > 0)
    .sort((a, b) => a.anio - b.anio || b.monto - a.monto)

  const top_proveedores = [...porProv.entries()]
    .map(([proveedor, v]) => ({ proveedor, monto: v.monto, transacciones: v.n }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 15)

  return {
    resumen: {
      total,
      transacciones: filasAnio.length,
      promedio: filasAnio.length ? total / filasAnio.length : 0,
      periodo_desde: fechas[0] ?? null,
      periodo_hasta: fechas[fechas.length - 1] ?? null,
      anio_base: anioFoco,
      anio_comp: anioComp,
      empresa_filtro: null,
    },
    por_categoria,
    por_mes,
    evolucion_mensual: buildEvolucionMensual(filas, anioFoco, anioComp),
    por_anio,
    por_categoria_anio,
    top_proveedores,
    categorizacion: stats,
  }
}

async function clasificarFilas(
  base: Omit<CostosItFila, 'categoria' | 'fuente_categoria' | 'confianza' | 'anio'>[],
): Promise<CostosItFila[]> {
  const hashes = base.map((f) => f.row_hash)
  const cache = await loadClasificacionesMap(hashes)
  const filas: CostosItFila[] = []
  const nuevasGuardar: Array<{ row_hash: string; categoria: string; fuente: 'regla' | 'vista'; confianza: number }> = []

  for (const f of base) {
    const anio = anioFromFecha(f.fecha)
    const cached = cache.get(f.row_hash)

    if (cached?.fuente === 'manual') {
      filas.push({
        ...f,
        anio,
        categoria: cached.categoria,
        fuente_categoria: 'manual',
        confianza: cached.confianza,
      })
      continue
    }

    if (debeUsarCategoriaSap(f)) {
      const desdeVista = clasificarSoporteControlPresupuesto(f.categoria_origen)
      filas.push({
        ...f,
        anio,
        categoria: desdeVista.categoria,
        fuente_categoria: 'vista',
        confianza: desdeVista.confianza,
      })
      nuevasGuardar.push({
        row_hash: f.row_hash,
        categoria: desdeVista.categoria,
        fuente: 'vista',
        confianza: desdeVista.confianza,
      })
      continue
    }

    const prio = categorizarPorReglasPrioritarias(f)
    if (prio) {
      filas.push({
        ...f,
        anio,
        categoria: prio.categoria,
        fuente_categoria: 'regla',
        confianza: prio.confianza,
      })
      nuevasGuardar.push({
        row_hash: f.row_hash,
        categoria: prio.categoria,
        fuente: 'regla',
        confianza: prio.confianza,
      })
      continue
    }

    const desdeVista = f.categoria_origen ? aplicarCategoriaOrigen(f.categoria_origen) : null
    if (desdeVista) {
      filas.push({
        ...f,
        anio,
        categoria: desdeVista.categoria,
        fuente_categoria: 'vista',
        confianza: desdeVista.confianza,
      })
      nuevasGuardar.push({
        row_hash: f.row_hash,
        categoria: desdeVista.categoria,
        fuente: 'vista',
        confianza: desdeVista.confianza,
      })
      continue
    }

    const regla = categorizarPorReglas(f)
    if (regla) {
      filas.push({
        ...f,
        anio,
        categoria: regla.categoria,
        fuente_categoria: 'regla',
        confianza: regla.confianza,
      })
      nuevasGuardar.push({
        row_hash: f.row_hash,
        categoria: regla.categoria,
        fuente: 'regla',
        confianza: regla.confianza,
      })
      continue
    }

    filas.push({
      ...f,
      anio,
      categoria: 'Otros',
      fuente_categoria: 'regla',
      confianza: 0.5,
    })
  }

  if (nuevasGuardar.length) {
    await saveClasificaciones(nuevasGuardar)
  }

  return filas.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
}

export async function buildCostosItDashboard(
  sapCfg: SapBiCosteoConfig,
  itCfg: CostosItConfig,
  fields: CostosItFieldMap,
  opts: {
    anio_base?: number
    anio_comp?: number
    categoria?: string
    empresa?: string
  },
): Promise<CostosItDashboard> {
  const nowYear = new Date().getFullYear()
  const anioBase = opts.anio_base ?? nowYear
  const anioComp = opts.anio_comp ?? anioBase - 1
  const anioMin = Math.min(anioBase, anioComp)
  const anioMax = Math.max(anioBase, anioComp)

  const raw = await querySapBiGeneric(sapCfg, itCfg.viewName, fields, {
    desde: `${anioMin}-01-01`,
    hasta: `${anioMax}-12-31`,
  })

  const base = mapRawRows(raw).filter((f) => f.monto !== 0)
  let filas = await clasificarFilas(base)

  const empresas = [...new Set(filas.map((f) => f.empresa).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )

  if (opts.empresa?.trim()) {
    const emp = opts.empresa.trim()
    filas = filas.filter((f) => f.empresa === emp)
  }

  const categorias_disponibles = [
    ...new Set(
      filas
        .filter((f) => f.anio === anioBase || f.anio === anioComp)
        .map((f) => f.categoria)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'))

  if (opts.categoria?.trim()) {
    filas = filas.filter((f) => f.categoria === opts.categoria?.trim())
  }

  const agg = buildAgregados(filas, anioBase, anioComp)
  const comparacion = buildComparacion(filas, anioBase, anioComp)

  const filasDetalle = filas
    .filter((f) => f.anio === anioBase || f.anio === anioComp)
    .slice(0, 800)

  const totalDetalle = filas.filter((f) => f.anio === anioBase || f.anio === anioComp).length

  const now = new Date().toISOString()
  await setUltimoSyncCostosIt(now)

  const schema = sapCfg.schema?.trim() || sapCfg.database?.trim() || ''

  return {
    moneda: MONEDA_COSTOS_IT,
    ...agg,
    resumen: {
      ...agg.resumen,
      empresa_filtro: opts.empresa?.trim() || null,
      categoria_filtro: opts.categoria?.trim() || null,
    },
    empresas,
    categorias_disponibles,
    comparacion,
    filas: filasDetalle,
    vista: schema ? `${schema}.${itCfg.viewName}` : itCfg.viewName,
    campos_mapeados: fields,
    ultimo_sync: now,
    aviso:
      totalDetalle > 800
        ? `Mostrando 800 de ${totalDetalle} transacciones. Filtre por categoría o empresa para ver más detalle.`
        : null,
  }
}

export async function fetchCostosItDashboard(opts: {
  anio_base?: number
  anio_comp?: number
  categoria?: string
  empresa?: string
}): Promise<CostosItDashboard> {
  const { resolveCostosItConnection, getCostosItFields } = await import('./sapCostosItConfig.js')
  const { sapCfg, itCfg } = await resolveCostosItConnection()
  const fields = await getCostosItFields(sapCfg, itCfg)
  return buildCostosItDashboard(sapCfg, itCfg, fields, opts)
}

export async function fetchCostosItFilasClasificadas(anio: number): Promise<{
  filas: CostosItFila[]
  empresas: string[]
  vista: string
  ultimo_sync: string | null
}> {
  const { resolveCostosItConnection, getCostosItFields, setUltimoSyncCostosIt } = await import(
    './sapCostosItConfig.js'
  )
  const { sapCfg, itCfg } = await resolveCostosItConnection()
  const fields = await getCostosItFields(sapCfg, itCfg)

  const raw = await querySapBiGeneric(sapCfg, itCfg.viewName, fields, {
    desde: `${anio}-01-01`,
    hasta: `${anio}-12-31`,
  })

  const base = mapRawRows(raw).filter((f) => f.monto !== 0)
  const filas = await clasificarFilas(base)
  const empresas = [...new Set(filas.map((f) => f.empresa).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )

  const now = new Date().toISOString()
  await setUltimoSyncCostosIt(now)
  const schema = sapCfg.schema?.trim() || sapCfg.database?.trim() || ''

  return {
    filas,
    empresas,
    vista: schema ? `${schema}.${itCfg.viewName}` : itCfg.viewName,
    ultimo_sync: now,
  }
}

export { CATEGORIAS_IT }

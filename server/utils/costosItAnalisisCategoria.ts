import type { CostosItFila } from './costosItCategorize.js'
import { CATEGORIAS_IT } from './costosItCategorize.js'
import { MONEDA_COSTOS_IT, fetchCostosItFilasClasificadas } from './sapCostosItBi.js'

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const

export type CostosItAnalisisCategoria = {
  moneda: typeof MONEDA_COSTOS_IT
  filtros: {
    empresa: string | null
    anio: number
    mes: number | null
    categoria: string | null
  }
  empresas: string[]
  anios_disponibles: number[]
  categorias: readonly string[]
  resumen: {
    total: number
    transacciones: number
    promedio: number
    periodo_desde: string | null
    periodo_hasta: string | null
  }
  por_categoria: Array<{ categoria: string; monto: number; pct: number; transacciones: number }>
  por_empresa: Array<{ empresa: string; monto: number; pct: number; transacciones: number }>
  por_mes: Array<{ mes: number; mes_label: string; monto: number; transacciones: number }>
  por_categoria_empresa: Array<{
    empresa: string
    categoria: string
    monto: number
    transacciones: number
  }>
  filas: CostosItFila[]
  vista: string
  ultimo_sync: string | null
  aviso?: string | null
}

function mesNumero(fecha: string | null): number | null {
  if (!fecha) return null
  const m = Number(fecha.slice(5, 7))
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null
}

function filtrarFilas(
  filas: CostosItFila[],
  opts: { empresa?: string; anio: number; mes?: number; categoria?: string },
): CostosItFila[] {
  return filas.filter((f) => {
    if (f.anio !== opts.anio) return false
    if (opts.empresa?.trim() && f.empresa !== opts.empresa.trim()) return false
    if (opts.mes != null) {
      const m = mesNumero(f.fecha)
      if (m !== opts.mes) return false
    }
    if (opts.categoria?.trim() && f.categoria !== opts.categoria.trim()) return false
    return true
  })
}

function buildAgregadosAnalisis(filas: CostosItFila[]): Pick<
  CostosItAnalisisCategoria,
  'resumen' | 'por_categoria' | 'por_empresa' | 'por_mes' | 'por_categoria_empresa'
> {
  const total = filas.reduce((s, f) => s + f.monto, 0)
  const fechas = filas.map((f) => f.fecha).filter(Boolean) as string[]
  fechas.sort()

  const porCat = new Map<string, { monto: number; n: number }>()
  const porEmp = new Map<string, { monto: number; n: number }>()
  const porMes = new Map<number, { monto: number; n: number }>()
  const porCatEmp = new Map<string, { monto: number; n: number }>()

  for (const f of filas) {
    const cat = f.categoria || 'Otros'
    const c1 = porCat.get(cat) ?? { monto: 0, n: 0 }
    c1.monto += f.monto
    c1.n += 1
    porCat.set(cat, c1)

    const emp = f.empresa || 'Sin empresa'
    const c2 = porEmp.get(emp) ?? { monto: 0, n: 0 }
    c2.monto += f.monto
    c2.n += 1
    porEmp.set(emp, c2)

    const m = mesNumero(f.fecha)
    if (m != null) {
      const c3 = porMes.get(m) ?? { monto: 0, n: 0 }
      c3.monto += f.monto
      c3.n += 1
      porMes.set(m, c3)
    }

    const key = `${emp}|${cat}`
    const c4 = porCatEmp.get(key) ?? { monto: 0, n: 0 }
    c4.monto += f.monto
    c4.n += 1
    porCatEmp.set(key, c4)
  }

  const por_categoria = [...porCat.entries()]
    .map(([categoria, v]) => ({
      categoria,
      monto: v.monto,
      pct: total > 0 ? (v.monto / total) * 100 : 0,
      transacciones: v.n,
    }))
    .sort((a, b) => b.monto - a.monto)

  const por_empresa = [...porEmp.entries()]
    .map(([empresa, v]) => ({
      empresa,
      monto: v.monto,
      pct: total > 0 ? (v.monto / total) * 100 : 0,
      transacciones: v.n,
    }))
    .sort((a, b) => b.monto - a.monto)

  const por_mes = [...porMes.entries()]
    .map(([mes, v]) => ({
      mes,
      mes_label: MESES_LABEL[mes - 1] ?? String(mes),
      monto: v.monto,
      transacciones: v.n,
    }))
    .sort((a, b) => a.mes - b.mes)

  const por_categoria_empresa = [...porCatEmp.entries()]
    .map(([key, v]) => {
      const [empresa, categoria] = key.split('|')
      return { empresa, categoria, monto: v.monto, transacciones: v.n }
    })
    .sort((a, b) => b.monto - a.monto)

  return {
    resumen: {
      total,
      transacciones: filas.length,
      promedio: filas.length ? total / filas.length : 0,
      periodo_desde: fechas[0] ?? null,
      periodo_hasta: fechas[fechas.length - 1] ?? null,
    },
    por_categoria,
    por_empresa,
    por_mes,
    por_categoria_empresa,
  }
}

export async function fetchCostosItAnalisisCategoria(opts: {
  anio?: number
  mes?: number
  empresa?: string
  categoria?: string
}): Promise<CostosItAnalisisCategoria> {
  const nowYear = new Date().getFullYear()
  const anio = opts.anio ?? nowYear
  const mes = opts.mes != null && opts.mes >= 1 && opts.mes <= 12 ? opts.mes : undefined

  const { filas: todasFilas, empresas, vista, ultimo_sync } = await fetchCostosItFilasClasificadas(anio)

  const aniosSet = new Set<number>()
  for (const f of todasFilas) {
    if (f.anio != null) aniosSet.add(f.anio)
  }
  aniosSet.add(anio)
  const anios_disponibles = [...aniosSet].sort((a, b) => b - a)

  const filtradas = filtrarFilas(todasFilas, {
    anio,
    mes,
    empresa: opts.empresa,
    categoria: opts.categoria,
  })

  const agg = buildAgregadosAnalisis(filtradas)
  const filasDetalle = filtradas.slice(0, 500)
  const totalFilas = filtradas.length

  const categoriasDisponibles = [
    ...new Set(
      todasFilas
        .filter((f) => f.anio === anio)
        .map((f) => f.categoria)
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'es'))

  return {
    moneda: MONEDA_COSTOS_IT,
    filtros: {
      empresa: opts.empresa?.trim() || null,
      anio,
      mes: mes ?? null,
      categoria: opts.categoria?.trim() || null,
    },
    empresas,
    anios_disponibles,
    categorias: categoriasDisponibles.length ? categoriasDisponibles : CATEGORIAS_IT,
    ...agg,
    filas: filasDetalle,
    vista,
    ultimo_sync,
    aviso:
      totalFilas > 500
        ? `Mostrando 500 de ${totalFilas} transacciones. Ajuste filtros para ver más detalle.`
        : null,
  }
}

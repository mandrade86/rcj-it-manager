import type { GastosItCategoria } from '../db/models/GastosItCategoriaConfig.js'
import { findCategoriaNombre, findSubcategoriaNombre } from './gastosItCategorias.js'
import type { TipoGasto } from './gastosItClasificacionAvanzada.js'

export type GastoItEnriquecido = {
  row_hash: string
  fecha: string | null
  mes: string
  anio: number | null
  monto: number
  descripcion: string
  proveedor: string
  documento: string
  cuenta: string
  empresa: string
  departamento: string
  categoria_id: string
  subcategoria_id: string
  categoria: string
  subcategoria: string
  tipo_gasto: TipoGasto | 'por_determinar'
  fuente_clasificacion: string
  confianza: number
}

export type AnalisisReglas = {
  variacion_relevante_pct: number
  variacion_critica_pct: number
  meses_promedio_anomalia: number
  meses_min_recurrente: number
  top_proveedores: number
  top_concentracion: number
}

export type SemafaroEstado = 'controlado' | 'atencion' | 'critico'

export function mesKey(fecha: string | null): string {
  if (!fecha) return '0000-00'
  return fecha.slice(0, 7)
}

export function pctVar(actual: number, anterior: number): number {
  if (anterior === 0) return actual > 0 ? 100 : 0
  return ((actual - anterior) / anterior) * 100
}

export function inferirTiposGasto(
  filas: GastoItEnriquecido[],
  mesFoco: string,
  reglas: AnalisisReglas,
): GastoItEnriquecido[] {
  const mesesHistorial = [...new Set(filas.map((f) => f.mes))].sort()
  const idxFoco = mesesHistorial.indexOf(mesFoco)
  const mesesPrev = mesesHistorial.slice(Math.max(0, idxFoco - reglas.meses_promedio_anomalia), idxFoco)

  const provMesMap = new Map<string, Set<string>>()
  for (const f of filas) {
    if (f.mes >= mesFoco) continue
    const key = `${f.proveedor}|${f.descripcion.slice(0, 40)}`
    const set = provMesMap.get(key) ?? new Set<string>()
    set.add(f.mes)
    provMesMap.set(key, set)
  }

  return filas.map((f) => {
    if (f.tipo_gasto !== 'por_determinar' && f.tipo_gasto !== '') {
      return f
    }
    const key = `${f.proveedor}|${f.descripcion.slice(0, 40)}`
    const mesesProv = provMesMap.get(key)
    const apariciones = mesesProv?.size ?? 0
    const existiaAntes = mesesPrev.some((m) => mesesProv?.has(m))

    if (f.mes === mesFoco && !existiaAntes && apariciones === 0) {
      return { ...f, tipo_gasto: 'extraordinario' as TipoGasto }
    }
    if (apariciones >= reglas.meses_min_recurrente - 1) {
      return { ...f, tipo_gasto: 'recurrente' as TipoGasto }
    }
    return { ...f, tipo_gasto: 'no_recurrente' as TipoGasto }
  })
}

export function calcularSemafaro(opts: {
  variacionPresupuestoPct: number | null
  variacionMesAnteriorPct: number
  tieneExtraordinarios: boolean
  reglas: AnalisisReglas
}): SemafaroEstado {
  const { variacionPresupuestoPct, variacionMesAnteriorPct, tieneExtraordinarios, reglas } = opts
  if (
    (variacionPresupuestoPct != null && variacionPresupuestoPct > reglas.variacion_critica_pct)
    || variacionMesAnteriorPct > reglas.variacion_critica_pct
  ) {
    return 'critico'
  }
  if (
    (variacionPresupuestoPct != null && variacionPresupuestoPct > reglas.variacion_relevante_pct)
    || variacionMesAnteriorPct > reglas.variacion_relevante_pct
    || tieneExtraordinarios
  ) {
    return 'atencion'
  }
  return 'controlado'
}

export function generarResumenMes(opts: {
  mesLabel: string
  total: number
  moneda: string
  variacionMesAnteriorPct: number | null
  variacionPresupuestoPct: number | null
  topCategorias: Array<{ categoria: string; pct: number }>
  anomalias: string[]
  oportunidades: number
  extraordinarios: number
}): string {
  const partes: string[] = []
  partes.push(
    `Durante ${opts.mesLabel} se registraron ${opts.moneda} ${opts.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en gastos IT.`,
  )

  if (opts.variacionMesAnteriorPct != null) {
    const dir = opts.variacionMesAnteriorPct >= 0 ? 'aumentó' : 'disminuyó'
    partes.push(
      `El gasto ${dir} ${Math.abs(opts.variacionMesAnteriorPct).toFixed(1)}% respecto al mes anterior.`,
    )
  }

  if (opts.variacionPresupuestoPct != null) {
    const dir = opts.variacionPresupuestoPct > 0 ? 'por encima' : 'por debajo'
    partes.push(`Se encuentra ${Math.abs(opts.variacionPresupuestoPct).toFixed(1)}% ${dir} del presupuesto.`)
  } else {
    partes.push('No hay presupuesto configurado para comparar este período.')
  }

  if (opts.topCategorias.length >= 2) {
    const nombres = opts.topCategorias.slice(0, 2).map((c) => c.categoria).join(' e ')
    const pctSum = opts.topCategorias.slice(0, 2).reduce((s, c) => s + c.pct, 0)
    partes.push(`${nombres} representan el ${pctSum.toFixed(0)}% del gasto total.`)
  }

  if (opts.anomalias.length > 0) {
    partes.push(`El principal incremento corresponde a ${opts.anomalias[0]}.`)
  }

  if (opts.extraordinarios > 0 || opts.oportunidades > 0) {
    partes.push(
      `Se identificaron ${opts.extraordinarios} gasto(s) extraordinario(s) y ${opts.oportunidades} posible(s) oportunidad(es) de revisión.`,
    )
  }

  return partes.join(' ')
}

export function enriquecerNombres(
  filas: GastoItEnriquecido[],
  categorias: GastosItCategoria[],
): GastoItEnriquecido[] {
  return filas.map((f) => ({
    ...f,
    categoria: findCategoriaNombre(categorias, f.categoria_id),
    subcategoria: findSubcategoriaNombre(categorias, f.categoria_id, f.subcategoria_id),
  }))
}

export function exportCsvRows(filas: GastoItEnriquecido[]): string {
  const headers = [
    'Fecha', 'Proveedor', 'Descripción', 'Empresa', 'Categoría', 'Subcategoría',
    'Tipo', 'Monto USD', 'Documento',
  ]
  const lines = filas.map((f) =>
    [
      f.fecha ?? '',
      f.proveedor,
      `"${f.descripcion.replace(/"/g, '""')}"`,
      f.empresa,
      f.categoria,
      f.subcategoria,
      f.tipo_gasto,
      f.monto.toFixed(2),
      f.documento,
    ].join(','),
  )
  return [headers.join(','), ...lines].join('\n')
}

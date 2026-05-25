import type { KpiDoc, KpiRegistro } from '@/types/kpi'
import type { MetaEstrategicaDepto } from '@/types/departamento'
import type { KpiTipoCalculo, MetaTipoCalculo } from '@/lib/kpiCalculoTipos'
import { metaEstrategicaDeKpi } from '@/types/kpi'

export function ultimoRegistro(k: KpiDoc): KpiRegistro | null {
  const r = k.registros ?? []
  if (!r.length) return null
  return [...r].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0]
}

function ultimoValor(regs: KpiRegistro[]): number | null {
  const u = [...regs].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )[0]
  if (u?.valor == null || Number.isNaN(Number(u.valor))) return null
  return Number(u.valor)
}

function valoresNumericos(regs: KpiRegistro[]): number[] {
  return regs
    .map((r) => r.valor)
    .filter((v): v is number => v != null && !Number.isNaN(Number(v)))
    .map(Number)
}

function avancesProyectosVinculados(k: KpiDoc): number[] {
  const raw = k.proyecto_ids ?? []
  return raw
    .map((p) => {
      if (typeof p === 'string') return null
      const v = p.porcentaje_avance
      return typeof v === 'number' && Number.isFinite(v) ? v : null
    })
    .filter((v): v is number => v != null)
}

function calcPct(
  valor: number,
  meta?: string | null,
  unidad?: string | null,
  nombre?: string,
): number {
  const m = (meta ?? '').trim()
  const u = (unidad ?? '').toLowerCase()

  const ltH = m.match(/<\s*([\d.]+)\s*h/i)
  if (ltH) {
    const cap = parseFloat(ltH[1])
    if (cap > 0 && valor > 0) return Math.min(100, Math.round((cap / valor) * 100))
    return 0
  }

  const ge = m.match(/≥\s*([\d.]+)\s*%?/i)
  if (ge) {
    const t = parseFloat(ge[1])
    if (t > 0) return Math.min(100, Math.round((valor / t) * 100))
  }

  if (/100\s*%/i.test(m) && u.includes('%')) {
    return Math.min(100, Math.round(valor))
  }

  if (/firmado/i.test(m) || u.includes('estado')) {
    if (valor >= 1) return 100
    return Math.min(100, Math.round(valor))
  }

  const negPct = m.match(/^-\s*([\d.]+)\s*%/)
  if (negPct) {
    const t = parseFloat(negPct[1])
    if (t > 0) return Math.min(100, Math.round((valor / t) * 100))
  }

  const band = m.match(/([\d.]+)\s*[-–]\s*([\d.]+)\s*%/)
  if (band) {
    const mid = (parseFloat(band[1]) + parseFloat(band[2])) / 2
    if (mid > 0) return Math.min(100, Math.round((valor / mid) * 100))
  }

  const plain = m.match(/^([\d.]+)\s*$/)
  if (plain && (/persona/i.test(u) || /coordinador/i.test(nombre ?? ''))) {
    const t = parseFloat(plain[1])
    if (t > 0) return Math.min(100, Math.round((valor / t) * 100))
  }

  return Math.min(100, Math.max(0, Math.round(valor)))
}

/** % de cumplimiento 0–100 según tipo_calculo del KPI. */
export function pctCumplimientoKpi(k: KpiDoc): number {
  const tipo = (k.tipo_calculo ?? 'auto_meta') as KpiTipoCalculo
  const regs = k.registros ?? []

  if (tipo === 'proyectos_vinculados') {
    const av = avancesProyectosVinculados(k)
    if (!av.length) return 0
    const sum = av.reduce((a, n) => a + Math.max(0, Math.min(100, n)), 0)
    return Math.round(sum / av.length)
  }

  if (tipo === 'promedio_registros') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return 0
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return calcPct(avg, k.meta, k.unidad, k.nombre)
  }

  if (tipo === 'max_registro') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return 0
    return calcPct(Math.max(...vals), k.meta, k.unidad, k.nombre)
  }

  if (tipo === 'min_registro') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return 0
    return calcPct(Math.min(...vals), k.meta, k.unidad, k.nombre)
  }

  const ultimo = ultimoValor(regs)
  if (ultimo == null) return 0
  return calcPct(ultimo, k.meta, k.unidad, k.nombre)
}

export function pctMetaEstrategica(
  kpis: KpiDoc[],
  ids: string[],
  meta?: MetaEstrategicaDepto | null,
): number {
  const subset = kpis.filter((k) => ids.includes(k._id))
  if (!subset.length) return 0
  const pcts = subset.map((k) => pctCumplimientoKpi(k))
  const tipo = (meta?.tipo_calculo ?? 'promedio_kpis') as MetaTipoCalculo
  if (tipo === 'min_kpis') return Math.min(...pcts)
  if (tipo === 'max_kpis') return Math.max(...pcts)
  const sum = pcts.reduce((a, n) => a + n, 0)
  return Math.round(sum / pcts.length)
}

/** Etiqueta corta del tipo de cálculo para tablas. */
export function labelTipoCalculoKpi(k: KpiDoc): string {
  const t = k.tipo_calculo ?? 'auto_meta'
  if (t === 'proyectos_vinculados') return 'Proyectos'
  if (t === 'promedio_registros') return 'Prom. registros'
  if (t === 'max_registro') return 'Máx. registro'
  if (t === 'min_registro') return 'Mín. registro'
  return 'Último vs meta'
}

export { metaEstrategicaDeKpi }

import type { KpiTipoCalculo, MetaTipoCalculo } from '../db/data/kpiCalculoTipos.js'

export type KpiRegistroLike = { fecha?: Date | string; valor?: number | null }
export type KpiCalculoInput = {
  tipo_calculo?: KpiTipoCalculo | string | null
  meta?: string | null
  unidad?: string | null
  nombre?: string | null
  registros?: KpiRegistroLike[] | null
  /** Avance % de proyectos vinculados (para tipo proyectos_vinculados). */
  proyectosAvance?: number[] | null
}

function ultimoValor(registros: KpiRegistroLike[]): number | null {
  if (!registros.length) return null
  const sorted = [...registros].sort(
    (a, b) => new Date(b.fecha ?? 0).getTime() - new Date(a.fecha ?? 0).getTime(),
  )
  const v = sorted[0]?.valor
  if (v == null || Number.isNaN(Number(v))) return null
  return Number(v)
}

function valoresNumericos(registros: KpiRegistroLike[]): number[] {
  return registros
    .map((r) => r.valor)
    .filter((v): v is number => v != null && !Number.isNaN(Number(v)))
    .map(Number)
}

function calcPctMeta(
  valor: number,
  meta?: string | null,
  unidad?: string | null,
  nombre?: string | null,
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
export function pctCumplimientoKpi(input: KpiCalculoInput): number {
  const tipo = (input.tipo_calculo ?? 'auto_meta') as KpiTipoCalculo
  const regs = input.registros ?? []

  if (tipo === 'proyectos_vinculados') {
    const av = input.proyectosAvance ?? []
    if (!av.length) return 0
    const sum = av.reduce((a, n) => a + Math.max(0, Math.min(100, n)), 0)
    return Math.round(sum / av.length)
  }

  if (tipo === 'promedio_registros') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return 0
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return calcPctMeta(avg, input.meta, input.unidad, input.nombre)
  }

  if (tipo === 'max_registro') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return 0
    return calcPctMeta(Math.max(...vals), input.meta, input.unidad, input.nombre)
  }

  if (tipo === 'min_registro') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return 0
    return calcPctMeta(Math.min(...vals), input.meta, input.unidad, input.nombre)
  }

  const ultimo = ultimoValor(regs)
  if (ultimo == null) return 0
  return calcPctMeta(ultimo, input.meta, input.unidad, input.nombre)
}

export function pctMetaEstrategica(
  kpisPct: number[],
  tipo: MetaTipoCalculo | string | null | undefined,
): number {
  if (!kpisPct.length) return 0
  const t = (tipo ?? 'promedio_kpis') as MetaTipoCalculo
  if (t === 'min_kpis') return Math.min(...kpisPct)
  if (t === 'max_kpis') return Math.max(...kpisPct)
  const sum = kpisPct.reduce((a, n) => a + n, 0)
  return Math.round(sum / kpisPct.length)
}

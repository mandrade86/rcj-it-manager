/** Misma heurística que `client/src/lib/kpiAvance.ts` para uso en servidor. */

export type KpiRegistroLean = {
  fecha: Date | string
  valor?: number | null
  notas?: string | null
}

export type KpiLean = {
  _id: unknown
  meta?: string | null
  unidad?: string | null
  nombre?: string | null
  registros?: KpiRegistroLean[]
}

export function ultimoRegistro(k: KpiLean): KpiRegistroLean | null {
  const r = k.registros ?? []
  if (!r.length) return null
  return [...r].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )[0]
}

export function calcPct(
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

export function pctCumplimientoKpi(k: KpiLean): number {
  const u = ultimoRegistro(k)
  if (u?.valor == null || Number.isNaN(Number(u.valor))) return 0
  return calcPct(Number(u.valor), k.meta, k.unidad, k.nombre)
}

export function kpiPromedioGlobal(kpis: KpiLean[]): number {
  if (!kpis.length) return 0
  const sum = kpis.reduce((a, k) => a + pctCumplimientoKpi(k), 0)
  return Math.round(sum / kpis.length)
}

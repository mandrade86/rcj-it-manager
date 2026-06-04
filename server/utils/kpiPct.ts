/** Misma heurística que `client/src/lib/kpiAvance.ts` para uso en servidor. */

export type KpiRegistroLean = {
  fecha: Date | string
  valor?: number | null
  notas?: string | null
}

export type ProyectoAvanceLean = {
  porcentaje_avance?: number | null
  estado?: string | null
}

export type KpiLean = {
  _id: unknown
  meta?: string | null
  unidad?: string | null
  nombre?: string | null
  tipo_calculo?: string | null
  registros?: KpiRegistroLean[]
  proyecto_ids?: (string | ProyectoAvanceLean)[] | null
}

export function ultimoRegistro(k: KpiLean): KpiRegistroLean | null {
  const r = k.registros ?? []
  if (!r.length) return null
  return [...r].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )[0]
}

function ultimoValor(regs: KpiRegistroLean[]): number | null {
  const u = [...regs].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  )[0]
  if (u?.valor == null || Number.isNaN(Number(u.valor))) return null
  return Number(u.valor)
}

function valoresNumericos(regs: KpiRegistroLean[]): number[] {
  return regs
    .map((r) => r.valor)
    .filter((v): v is number => v != null && !Number.isNaN(Number(v)))
    .map(Number)
}

function pctAvanceProyecto(p: ProyectoAvanceLean): number {
  if (p.estado === 'Completado') return 100
  const v = p.porcentaje_avance
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.max(0, Math.min(100, Math.round(v)))
    : 0
}

/** Avances 0–100 de proyectos vinculados al KPI (lista en KPI + extras por kpi_id en Proyecto). */
export function avancesProyectosVinculados(
  k: KpiLean,
  extraProyectos: ProyectoAvanceLean[] = [],
): number[] {
  const seen = new Set<string>()
  const out: number[] = []

  const push = (p: ProyectoAvanceLean, key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    out.push(pctAvanceProyecto(p))
  }

  for (const raw of k.proyecto_ids ?? []) {
    if (typeof raw === 'string') continue
    const id = '_id' in raw && raw._id != null ? String((raw as { _id: unknown })._id) : JSON.stringify(raw)
    push(raw, id)
  }

  for (const p of extraProyectos) {
    push(p, JSON.stringify(p))
  }

  return out
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

function promedioAvances(av: number[]): number {
  if (!av.length) return 0
  return Math.round(av.reduce((a, n) => a + n, 0) / av.length)
}

export function pctCumplimientoKpi(
  k: KpiLean,
  extraProyectos: ProyectoAvanceLean[] = [],
): number {
  const tipo = (k.tipo_calculo ?? 'auto_meta').trim()
  const regs = k.registros ?? []
  const avances = avancesProyectosVinculados(k, extraProyectos)

  if (tipo === 'proyectos_vinculados') {
    return promedioAvances(avances)
  }

  if (tipo === 'promedio_registros') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return promedioAvances(avances)
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    return calcPct(avg, k.meta, k.unidad, k.nombre)
  }

  if (tipo === 'max_registro') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return promedioAvances(avances)
    return calcPct(Math.max(...vals), k.meta, k.unidad, k.nombre)
  }

  if (tipo === 'min_registro') {
    const vals = valoresNumericos(regs)
    if (!vals.length) return promedioAvances(avances)
    return calcPct(Math.min(...vals), k.meta, k.unidad, k.nombre)
  }

  const ultimo = ultimoValor(regs)
  if (ultimo != null) {
    return calcPct(ultimo, k.meta, k.unidad, k.nombre)
  }

  return promedioAvances(avances)
}

export function kpiPromedioGlobal(
  kpis: KpiLean[],
  extraPorKpiId?: Map<string, ProyectoAvanceLean[]>,
): number {
  if (!kpis.length) return 0
  const sum = kpis.reduce((a, k) => {
    const extras = extraPorKpiId?.get(String(k._id)) ?? []
    return a + pctCumplimientoKpi(k, extras)
  }, 0)
  return Math.round(sum / kpis.length)
}

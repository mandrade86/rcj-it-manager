const MONTH_MS = 30 * 24 * 60 * 60 * 1000
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type TimelineRange = {
  start: number
  end: number
  spanMs: number
}

export type MonthTick = {
  t: number
  label: string
}

/** Rango del roadmap a partir de fechas de proyectos (con margen de un mes). */
export function computeTimelineRange(
  proyectos: { fecha_inicio?: string | null; fecha_fin?: string | null }[],
): TimelineRange {
  const fallbackStart = new Date('2026-01-01T00:00:00').getTime()
  const fallbackEnd = new Date('2026-12-31T23:59:59').getTime()

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const p of proyectos) {
    for (const raw of [p.fecha_inicio, p.fecha_fin]) {
      if (!raw) continue
      const t = new Date(raw).getTime()
      if (!Number.isNaN(t)) {
        min = Math.min(min, t)
        max = Math.max(max, t)
      }
    }
  }

  if (!Number.isFinite(min)) {
    return { start: fallbackStart, end: fallbackEnd, spanMs: fallbackEnd - fallbackStart }
  }

  const pad = MONTH_MS
  const start = min - pad
  const end = max + pad
  return { start, end, spanMs: Math.max(end - start, MONTH_MS) }
}

export function barLayoutInRange(
  fi: string | null | undefined,
  ff: string | null | undefined,
  range: TimelineRange,
): { left: number; width: number } {
  if (!fi && !ff) return { left: 0, width: 1.2 }
  const a = fi ? new Date(fi).getTime() : range.start
  const b = ff ? new Date(ff).getTime() : a + 7 * 24 * 60 * 60 * 1000
  const lo = Math.max(range.start, Math.min(range.end, a))
  const hi = Math.max(range.start, Math.min(range.end, b))
  if (hi <= lo) {
    return { left: ((lo - range.start) / range.spanMs) * 100, width: 0.9 }
  }
  return {
    left: ((lo - range.start) / range.spanMs) * 100,
    width: Math.max(0.9, ((hi - lo) / range.spanMs) * 100),
  }
}

export function monthTicks(range: TimelineRange): MonthTick[] {
  const out: MonthTick[] = []
  const d = new Date(range.start)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  while (d.getTime() < range.end) {
    out.push({
      t: d.getTime(),
      label: d.toLocaleDateString('es-HN', { month: 'short', year: '2-digit' }),
    })
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

export type WeekTick = {
  t: number
  label: string
}

export function weekTicks(range: TimelineRange): WeekTick[] {
  const out: WeekTick[] = []
  const d = new Date(range.start)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const toMon = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + toMon)
  let t = d.getTime()
  while (t < range.end) {
    out.push({
      t,
      label: new Date(t).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' }),
    })
    t += WEEK_MS
  }
  return out
}

export type TimelineScale = 'mes' | 'semana'

/** Posición % de un instante dentro del rango (0–100). */
export function percentInRange(t: number, range: TimelineRange): number {
  return Math.max(0, Math.min(100, ((t - range.start) / range.spanMs) * 100))
}

/** Línea "hoy" si cae dentro del rango; si no, null. */
export function todayMarkerPercent(range: TimelineRange): number | null {
  const now = Date.now()
  if (now < range.start || now > range.end) return null
  return percentInRange(now, range)
}

export function formatRangeLabel(range: TimelineRange): string {
  const a = new Date(range.start).toLocaleDateString('es-HN', { month: 'short', year: 'numeric' })
  const b = new Date(range.end).toLocaleDateString('es-HN', { month: 'short', year: 'numeric' })
  return `${a} — ${b}`
}

/** Marcadores de inicio de cada fase del Plan IT 2026 (referencia visual). */
export const FASE_MARKERS = [
  { fase: 1, label: 'Fase 1', start: '2026-03-01' },
  { fase: 2, label: 'Fase 2', start: '2026-05-01' },
  { fase: 3, label: 'Fase 3', start: '2026-07-01' },
] as const

export type PhaseLane = {
  fase: number | null
  label: string
  proyectos: { fecha_inicio?: string | null; fecha_fin?: string | null }[]
}

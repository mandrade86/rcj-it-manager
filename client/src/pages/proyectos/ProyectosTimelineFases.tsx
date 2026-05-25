import { useMemo } from 'react'
import { Layers } from 'lucide-react'

import { TimelineGanttChart, type TimelineGanttRow } from '@/components/proyectos/TimelineGanttChart'
import { ejeBarClass } from '@/lib/ejeColors'
import { formatDateDMY } from '@/lib/format'
import {
  computeTimelineRange,
  FASE_MARKERS,
  percentInRange,
  type TimelineRange,
} from '@/lib/roadmapTimeline'
import type { Proyecto } from '@/types/proyecto'

type Props = {
  proyectos: Proyecto[]
  onSelect: (p: Proyecto) => void
}

function laneLabel(fase: number | null): string {
  if (fase === 1 || fase === 2 || fase === 3) return `Fase ${fase}`
  return 'Sin fase asignada'
}

function laneDateSpan(items: Proyecto[]): { fi: string | null; ff: string | null } {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of items) {
    for (const raw of [p.fecha_inicio, p.fecha_fin]) {
      if (!raw) continue
      const t = new Date(raw).getTime()
      if (!Number.isNaN(t)) {
        min = Math.min(min, t)
        max = Math.max(max, t)
      }
    }
  }
  if (!Number.isFinite(min)) return { fi: null, ff: null }
  return { fi: new Date(min).toISOString(), ff: new Date(max).toISOString() }
}

export function ProyectosTimelineFases({ proyectos, onSelect }: Props) {
  const range = useMemo(() => computeTimelineRange(proyectos), [proyectos])

  const lanes = useMemo(() => {
    const map = new Map<number | null, Proyecto[]>()
    for (const p of proyectos) {
      const f = p.fase === 1 || p.fase === 2 || p.fase === 3 ? p.fase : null
      const arr = map.get(f) ?? []
      arr.push(p)
      map.set(f, arr)
    }
    const order: (number | null)[] = [1, 2, 3, null]
    return order
      .filter((f) => (map.get(f)?.length ?? 0) > 0)
      .map((f) => ({
        fase: f,
        label: laneLabel(f),
        items: map.get(f) ?? [],
      }))
  }, [proyectos])

  const rows = useMemo((): TimelineGanttRow[] => {
    const out: TimelineGanttRow[] = []
    for (const lane of lanes) {
      const { fi, ff } = laneDateSpan(lane.items)
      out.push({
        id: `lane-${lane.fase ?? 'x'}`,
        label: lane.label,
        sublabel: `${lane.items.length} proyecto(s)`,
        isGroup: true,
        fecha_inicio: fi,
        fecha_fin: ff,
        barClassName: 'bg-[var(--navy)]/20 ring-[var(--navy)]/25',
      })
      for (const p of lane.items.sort((a, b) =>
        a.nombre.localeCompare(b.nombre, 'es'),
      )) {
        out.push({
          id: p._id,
          label: p.nombre,
          sublabel: `${p._id} · ${p.estado} · ${p.porcentaje_avance ?? 0}%`,
          level: 1,
          fecha_inicio: p.fecha_inicio,
          fecha_fin: p.fecha_fin,
          progress: p.porcentaje_avance ?? 0,
          barClassName: ejeBarClass(p.eje),
          tooltip: `${p.nombre} · ${formatDateDMY(p.fecha_inicio)} → ${formatDateDMY(p.fecha_fin)}`,
          onClick: () => onSelect(p),
        })
      }
    }
    return out
  }, [lanes, onSelect])

  if (!proyectos.length) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-[var(--navy)]" />
        <h3 className="text-sm font-semibold text-foreground">Timeline por fases</h3>
      </div>
      <PhaseMarkersStrip range={range} />
      <TimelineGanttChart
        rows={rows}
        range={range}
        scale="mes"
        labelColumnTitle="Fase / Proyecto"
        headerNote="Vista por fases del Plan IT — barras según fechas de cada proyecto."
      />
    </div>
  )
}

/** Franja compacta con hitos de inicio de fase. */
function PhaseMarkersStrip({ range }: { range: TimelineRange }) {
  return (
    <div className="relative h-10 overflow-hidden rounded-md border border-border bg-gradient-to-r from-[var(--blue-lt)] to-white px-2">
      <div className="absolute inset-0 flex items-end pb-1">
        {FASE_MARKERS.map((m) => {
          const t = new Date(m.start).getTime()
          if (t < range.start || t > range.end) return null
          const left = percentInRange(t, range)
          return (
            <div
              key={m.fase}
              className="absolute bottom-1 flex flex-col items-center"
              style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
            >
              <span className="whitespace-nowrap rounded bg-[var(--navy)] px-1.5 py-0.5 text-[9px] font-medium text-white">
                {m.label}
              </span>
              <span className="mt-0.5 h-3 w-px bg-[var(--navy)]/50" />
            </div>
          )
        })}
      </div>
      <p className="absolute left-2 top-1 text-[9px] text-muted-foreground">Hitos Plan IT 2026</p>
    </div>
  )
}

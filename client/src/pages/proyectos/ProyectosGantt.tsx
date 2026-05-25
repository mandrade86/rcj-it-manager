import { useMemo, useState } from 'react'

import { TimelineGanttChart, type TimelineGanttRow } from '@/components/proyectos/TimelineGanttChart'
import { ejeBarClass } from '@/lib/ejeColors'
import { formatDateDMY } from '@/lib/format'
import { computeTimelineRange, type TimelineScale } from '@/lib/roadmapTimeline'
import { estadoColor } from '@/types/proyecto'
import type { Proyecto } from '@/types/proyecto'

export function ProyectosGantt({
  proyectos,
  onSelect,
}: {
  proyectos: Proyecto[]
  onSelect: (p: Proyecto) => void
}) {
  const [scale, setScale] = useState<TimelineScale>('semana')
  const range = useMemo(() => computeTimelineRange(proyectos), [proyectos])

  const rows = useMemo((): TimelineGanttRow[] => {
    return proyectos
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((p) => ({
        id: p._id,
        label: p.nombre,
        sublabel: `${p._id} · Fase ${p.fase ?? '—'} · ${p.estado}`,
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin,
        progress: p.porcentaje_avance ?? 0,
        barClassName: ejeBarClass(p.eje),
        tooltip: `${p.nombre} · ${p.responsable ?? '—'} · ${p.porcentaje_avance}% · ${formatDateDMY(p.fecha_inicio)} → ${formatDateDMY(p.fecha_fin)}`,
        onClick: () => onSelect(p),
        leading: (
          <span
            className={`mr-1 shrink-0 rounded border px-1 py-0 text-[8px] font-medium ${estadoColor(p.estado)}`}
          >
            {p.estado.slice(0, 3)}
          </span>
        ),
      }))
  }, [proyectos, onSelect])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="gantt-escala">
          Escala del timeline
        </label>
        <select
          id="gantt-escala"
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
          value={scale}
          onChange={(e) => setScale(e.target.value as TimelineScale)}
        >
          <option value="mes">Meses</option>
          <option value="semana">Semanas</option>
        </select>
      </div>
      <TimelineGanttChart
        rows={rows}
        range={range}
        scale={scale}
        labelColumnTitle="Proyecto"
        headerNote="Gantt de proyectos — clic en la fila o barra para abrir detalle."
        emptyMessage="No hay proyectos con fechas para el Gantt."
      />
    </div>
  )
}

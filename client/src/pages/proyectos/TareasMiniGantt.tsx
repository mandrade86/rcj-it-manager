import { useMemo, useState } from 'react'

import { TimelineGanttChart, type TimelineGanttRow } from '@/components/proyectos/TimelineGanttChart'
import { ejeBarClass } from '@/lib/ejeColors'
import { formatDateDMY } from '@/lib/format'
import { computeTimelineRange, type TimelineScale } from '@/lib/roadmapTimeline'
import {
  estadoTareaColor,
  evaluarSaludTarea,
  mapaTareas,
  type TareaSalud,
} from '@/lib/tareaDependencias'
import type { Proyecto } from '@/types/proyecto'
import type { Tarea } from '@/types/tarea'

function tareaBarClass(t: Tarea, salud: TareaSalud): string {
  if (salud === 'atrasada') return 'bg-red-600'
  if (salud === 'en_riesgo') return 'bg-red-500'
  if (t.eje) return ejeBarClass(t.eje)
  switch (t.estado) {
    case 'Completado':
      return 'bg-[var(--lime)]'
    case 'En progreso':
      return 'bg-[var(--navy)]'
    case 'Bloqueado':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground/75'
  }
}

type Props = {
  proyecto: Proyecto
  tareas: Tarea[]
  onSelect?: (t: Tarea) => void
}

export function TareasMiniGantt({ proyecto, tareas, onSelect }: Props) {
  const [scale, setScale] = useState<TimelineScale>('semana')
  const mapa = useMemo(() => mapaTareas(tareas), [tareas])

  const range = useMemo(
    () =>
      computeTimelineRange([
        { fecha_inicio: proyecto.fecha_inicio, fecha_fin: proyecto.fecha_fin },
        ...tareas,
      ]),
    [proyecto.fecha_inicio, proyecto.fecha_fin, tareas],
  )

  const rows = useMemo((): TimelineGanttRow[] => {
    const proyectoRow: TimelineGanttRow = {
      id: '__proyecto__',
      label: proyecto.nombre,
      sublabel: `${proyecto._id} · ventana del proyecto`,
      isGroup: true,
      fecha_inicio: proyecto.fecha_inicio,
      fecha_fin: proyecto.fecha_fin,
      progress: proyecto.porcentaje_avance ?? 0,
      barClassName: ejeBarClass(proyecto.eje),
      tooltip: `${proyecto.nombre} · ${formatDateDMY(proyecto.fecha_inicio)} → ${formatDateDMY(proyecto.fecha_fin)} · ${proyecto.porcentaje_avance ?? 0}%`,
    }

    const taskRows = tareas
      .slice()
      .sort((a, b) => {
        const ta = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : Number.MAX_SAFE_INTEGER
        const tb = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : Number.MAX_SAFE_INTEGER
        if (ta !== tb) return ta - tb
        return a.nombre.localeCompare(b.nombre, 'es')
      })
      .map((t): TimelineGanttRow => {
        const salud = evaluarSaludTarea(t, mapa)
        return {
          id: t._id,
          label: t.nombre,
          sublabel: [t.responsable ?? 'Sin responsable', t.estado, `${t.porcentaje ?? 0}%`]
            .filter(Boolean)
            .join(' · '),
          fecha_inicio: t.fecha_inicio,
          fecha_fin: t.fecha_fin,
          progress: t.estado === 'Completado' ? 100 : (t.porcentaje ?? 0),
          barClassName: tareaBarClass(t, salud),
          tooltip: `${t.nombre} · ${formatDateDMY(t.fecha_inicio)} → ${formatDateDMY(t.fecha_fin)} · ${t.estado} · ${t.porcentaje ?? 0}%`,
          onClick: onSelect ? () => onSelect(t) : undefined,
          leading: (
            <span
              className={`mr-1 shrink-0 rounded border px-1 py-0 text-[8px] font-medium ${estadoTareaColor(t.estado)}`}
            >
              {t.estado === 'En progreso' ? 'Prog.' : t.estado.slice(0, 4)}
            </span>
          ),
        }
      })

    return [proyectoRow, ...taskRows]
  }, [proyecto, tareas, mapa, onSelect])

  const conFechas = tareas.filter((t) => t.fecha_inicio || t.fecha_fin).length

  if (tareas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        Agrega tareas con fechas de inicio y fin para ver el mini Gantt.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {conFechas} de {tareas.length} tarea(s) con fechas · barra gris superior = proyecto
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="tareas-gantt-escala">Escala</label>
          <select
            id="tareas-gantt-escala"
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
            value={scale}
            onChange={(e) => setScale(e.target.value as TimelineScale)}
          >
            <option value="semana">Semanas</option>
            <option value="mes">Meses</option>
          </select>
        </div>
      </div>
      <TimelineGanttChart
        rows={rows}
        range={range}
        scale={scale}
        labelWidth={220}
        minChartWidth={520}
        labelColumnTitle="Tarea"
        headerNote="Mini Gantt del proyecto — clic en una tarea para ver detalle."
        emptyMessage="No hay tareas para mostrar."
      />
    </div>
  )
}

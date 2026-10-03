import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  GanttChartSquare,
  Gauge,
  ShieldAlert,
  Timer,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { TimelineGanttChart, type TimelineGanttRow } from '@/components/proyectos/TimelineGanttChart'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ejeBarClass } from '@/lib/ejeColors'
import { formatDateDMY } from '@/lib/format'
import {
  buildRoadmapTree,
  collectGroupIds,
  flattenRoadmapTree,
  ROADMAP_HIERARCHY_OPTIONS,
  type RoadmapHierarchyMode,
  type RoadmapTreeNode,
} from '@/lib/roadmapHierarchy'
import {
  atencionEjecutiva,
  buildRoadmapLanes,
  computeRoadmapResumen,
  insightsRoadmap,
  laneSpan,
  proyectoAtrasado,
  ROADMAP_LANE_OPTIONS,
  type RoadmapLaneMode,
} from '@/lib/roadmapSummary'
import { computeTimelineRange, formatRangeLabel, percentInRange, FASE_MARKERS } from '@/lib/roadmapTimeline'
import { cn } from '@/lib/utils'
import type { Proyecto } from '@/types/proyecto'

type Props = {
  proyectos: Proyecto[]
  onSelect: (p: Proyecto) => void
}

function barClassForProject(p: Proyecto): string {
  if (p.estado === 'Bloqueado' || proyectoAtrasado(p)) return 'bg-[#C00000]'
  if (p.riesgo?.nivel === 'Alto') return 'bg-[#F59E0B]'
  return ejeBarClass(p.eje)
}

function ownerShort(p: Proyecto): string {
  const u = p.usuario_id
  if (u && typeof u === 'object' && u.nombre) return u.nombre.split(/\s+/)[0] ?? u.nombre
  return p.responsable?.split(/\s+/)[0] || '—'
}

function roadmapNodeToGanttRow(
  node: RoadmapTreeNode,
  onToggleGroup: (id: string) => void,
  onSelect: (p: Proyecto) => void,
): TimelineGanttRow {
  const isGroup = node.kind === 'group'
  return {
    id: node.id,
    label: node.label,
    sublabel: isGroup
      ? `${node.projectCount} proy. · ${node.avgAvance}%`
      : `${node.sublabel ?? ''}`,
    level: node.level,
    isGroup,
    fecha_inicio: node.fecha_inicio,
    fecha_fin: node.fecha_fin,
    progress: node.avgAvance,
    barClassName: isGroup
      ? 'bg-[var(--navy)]/25'
      : node.project
        ? barClassForProject(node.project)
        : ejeBarClass(undefined),
    onClick: isGroup ? undefined : node.project ? () => onSelect(node.project!) : undefined,
    onToggleExpand: isGroup ? () => onToggleGroup(node.id) : undefined,
  }
}

export function ProyectosRoadmap({ proyectos, onSelect }: Props) {
  const [laneMode, setLaneMode] = useState<RoadmapLaneMode>('fase')
  const [hierMode, setHierMode] = useState<RoadmapHierarchyMode>('depto-fase-eje')
  const [ganttOpen, setGanttOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(collectGroupIds(buildRoadmapTree(proyectos, hierMode))),
  )

  const resumen = useMemo(() => computeRoadmapResumen(proyectos), [proyectos])
  const insights = useMemo(() => insightsRoadmap(resumen), [resumen])
  const atencion = useMemo(() => atencionEjecutiva(proyectos), [proyectos])
  const lanes = useMemo(() => buildRoadmapLanes(proyectos, laneMode), [proyectos, laneMode])
  const range = useMemo(() => computeTimelineRange(proyectos), [proyectos])

  const tree = useMemo(() => buildRoadmapTree(proyectos, hierMode), [proyectos, hierMode])
  const flat = useMemo(() => flattenRoadmapTree(tree, collapsed), [tree, collapsed])

  const swimRows = useMemo((): TimelineGanttRow[] => {
    const out: TimelineGanttRow[] = []
    for (const lane of lanes) {
      const span = laneSpan(lane.items)
      const atrasados = lane.items.filter((p) => proyectoAtrasado(p)).length
      out.push({
        id: lane.id,
        label: lane.label,
        sublabel: `${lane.items.length} proyecto${lane.items.length === 1 ? '' : 's'}${atrasados ? ` · ${atrasados} atrasado${atrasados === 1 ? '' : 's'}` : ''}`,
        isGroup: true,
        fecha_inicio: span.fi,
        fecha_fin: span.ff,
        barClassName: 'bg-[var(--navy)]/20',
      })
      for (const p of lane.items) {
        out.push({
          id: p._id,
          label: p.nombre,
          sublabel: `${p.estado} · ${p.porcentaje_avance ?? 0}% · ${ownerShort(p)}`,
          level: 1,
          fecha_inicio: p.fecha_inicio,
          fecha_fin: p.fecha_fin,
          progress: p.porcentaje_avance ?? 0,
          barClassName: barClassForProject(p),
          tooltip: `${p.nombre} · ${formatDateDMY(p.fecha_inicio)} → ${formatDateDMY(p.fecha_fin)} · ${p.porcentaje_avance ?? 0}%`,
          onClick: () => onSelect(p),
        })
      }
    }
    return out
  }, [lanes, onSelect])

  const ganttRows = useMemo(
    () =>
      flat.map(({ node }) =>
        roadmapNodeToGanttRow(
          node,
          (id) => {
            setCollapsed((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          },
          onSelect,
        ),
      ),
    [flat, onSelect],
  )

  const saludChart = useMemo(
    () =>
      [
        { name: 'En tiempo', value: resumen.salud.bajo, color: '#70AD47' },
        { name: 'Medio', value: resumen.salud.medio, color: '#F59E0B' },
        { name: 'Alto', value: resumen.salud.alto, color: '#C00000' },
        { name: 'Sin fecha', value: resumen.salud.sinFecha, color: '#6B7280' },
      ].filter((d) => d.value > 0),
    [resumen.salud],
  )

  if (!proyectos.length) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        No hay proyectos para el roadmap. Ajuste filtros o agregue proyectos con fechas.
      </p>
    )
  }

  const calHint =
    resumen.gapCalendario == null
      ? resumen.avanceEsperado == null
        ? 'Faltan fechas para estimar el ritmo'
        : `${resumen.avanceEsperado}% esperado por calendario`
      : resumen.gapCalendario >= 0
        ? `${resumen.gapCalendario} pts vs. calendario`
        : `${Math.abs(resumen.gapCalendario)} pts detrás del calendario`

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile
          label="Avance vs. calendario"
          value={`${resumen.avancePromedio}%`}
          hint={calHint}
          icon={Gauge}
          tone={resumen.gapCalendario != null && resumen.gapCalendario < -10 ? 'warn' : 'navy'}
        />
        <KpiTile
          label="En tiempo"
          value={String(resumen.enTiempo)}
          hint={`${resumen.activos} activos · ${resumen.completados} cerrados`}
          icon={CheckCircle2}
          tone="ok"
        />
        <KpiTile
          label="Atrasados"
          value={String(resumen.atrasados)}
          hint="Fecha de fin vencida"
          icon={Timer}
          tone={resumen.atrasados > 0 ? 'danger' : 'ok'}
        />
        <KpiTile
          label="Riesgo alto"
          value={String(resumen.enRiesgoAlto)}
          hint={`${resumen.bloqueados} bloqueado${resumen.bloqueados === 1 ? '' : 's'}`}
          icon={ShieldAlert}
          tone={resumen.enRiesgoAlto > 0 ? 'warn' : 'ok'}
        />
        <KpiTile
          label="Cierran en 30 días"
          value={String(resumen.porVencer30)}
          hint={resumen.sinFechaFin ? `${resumen.sinFechaFin} sin fecha de fin` : 'Compromisos de cierre'}
          icon={CalendarClock}
          tone={resumen.porVencer30 > 0 ? 'navy' : undefined}
        />
      </div>

      <div className="rounded-xl border border-[var(--navy)]/15 bg-[var(--blue-lt)]/60 px-4 py-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--navy)]">
          Lectura ejecutiva
        </p>
        <ul className="space-y-1 text-sm text-[var(--navy)]">
          {insights.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--lime)]" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold text-[var(--navy)]">
                Roadmap · {formatRangeLabel(range)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Un carril por grupo, un renglón por proyecto. La parte clara de la barra es el % de avance.
                Rojo = atrasado o bloqueado · ámbar = riesgo alto.
              </p>
            </div>
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
              {ROADMAP_LANE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium',
                    laneMode === o.id ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-muted-foreground',
                  )}
                  onClick={() => setLaneMode(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <PhaseMarkersStrip range={range} />
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-[#C00000]" />
              Atrasado / bloqueado
            </li>
          </ul>
          <TimelineGanttChart
            rows={swimRows}
            range={range}
            scale="mes"
            labelWidth={240}
            labelColumnTitle={laneMode === 'fase' ? 'Fase / Proyecto' : 'Grupo / Proyecto'}
            headerNote="Clic en una barra para abrir el proyecto · línea verde = hoy"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
              <AlertTriangle className="size-4 text-[#C00000]" />
              Atención inmediata
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Bloqueos, atraso, riesgo alto y cierres de las próximas 2 semanas
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {atencion.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nada urgente en este alcance.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Proyecto</th>
                    <th className="px-2 py-2 font-medium">Vence</th>
                    <th className="px-4 py-2 font-medium">Señal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {atencion.map(({ proyecto: p, motivo, nivel }) => (
                    <tr
                      key={p._id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => onSelect(p)}
                    >
                      <td className="max-w-[220px] px-4 py-2">
                        <p className="truncate font-medium text-[var(--navy)]">{p.nombre}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {p.estado} · {p.porcentaje_avance ?? 0}% · {ownerShort(p)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-muted-foreground">
                        {formatDateDMY(p.fecha_fin)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            nivel === 'critico' && 'bg-red-50 text-[#C00000]',
                            nivel === 'alerta' && 'bg-amber-50 text-amber-800',
                            nivel === 'proxima' && 'bg-[var(--blue-lt)] text-[var(--navy)]',
                          )}
                        >
                          {motivo}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-[var(--navy)]">Salud del portafolio</CardTitle>
            <p className="text-xs text-muted-foreground">
              Riesgo automático según fechas y avance
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {saludChart.length === 0 ? (
                <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Sin datos de riesgo
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={saludChart} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Proyectos" radius={[0, 4, 4, 0]} barSize={16}>
                      {saludChart.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[var(--navy)]">Plan IT · avance por fase</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {resumen.porFase
            .filter((f) => f.fase !== null)
            .map((f) => (
              <div key={f.fase ?? 'x'} className="rounded-lg border border-border bg-muted/15 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--navy)]">{f.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {f.count} proy.
                  </Badge>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--lime)] transition-all"
                    style={{ width: `${f.avance}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Avance {f.avance}%
                  {f.atrasados > 0 ? (
                    <span className="ml-2 font-medium text-[#C00000]">{f.atrasados} atrasado{f.atrasados === 1 ? '' : 's'}</span>
                  ) : (
                    <span className="ml-2 text-[var(--lime)]">sin atraso</span>
                  )}
                </p>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setGanttOpen((v) => !v)}
          >
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <GanttChartSquare className="size-4" />
              Gantt por departamento
            </CardTitle>
            <ChevronDown className={cn('size-5 text-muted-foreground transition', ganttOpen && 'rotate-180')} />
          </button>
        </CardHeader>
        {ganttOpen && (
          <CardContent className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Vista ampliada con niveles expandibles · {formatRangeLabel(range)}
              </p>
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={hierMode}
                onChange={(e) => {
                  const next = e.target.value as RoadmapHierarchyMode
                  setHierMode(next)
                  setCollapsed(new Set(collectGroupIds(buildRoadmapTree(proyectos, next))))
                }}
              >
                {ROADMAP_HIERARCHY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <TimelineGanttChart
              rows={ganttRows}
              range={range}
              scale="mes"
              labelWidth={260}
              labelColumnTitle="Jerarquía"
              headerNote=""
            />
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Gauge
  tone?: 'ok' | 'warn' | 'danger' | 'navy'
}) {
  const ring =
    tone === 'danger'
      ? 'bg-red-50 text-[#C00000]'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-700'
        : tone === 'ok'
          ? 'bg-[var(--lime-lt)] text-[var(--navy)]'
          : 'bg-[var(--blue-lt)] text-[var(--navy)]'
  const valueColor =
    tone === 'danger' ? 'text-[#C00000]' : tone === 'warn' ? 'text-amber-800' : 'text-[var(--navy)]'
  return (
    <Card className={cn('shadow-sm', tone === 'danger' && 'border-red-200', tone === 'warn' && 'border-amber-200')}>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', ring)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('text-2xl font-semibold tabular-nums', valueColor)}>{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PhaseMarkersStrip({ range }: { range: ReturnType<typeof computeTimelineRange> }) {
  const visible = FASE_MARKERS.filter((m) => {
    const t = new Date(m.start).getTime()
    return t >= range.start && t <= range.end
  })
  if (!visible.length) return null
  return (
    <div className="relative h-9 overflow-hidden rounded-md border border-border bg-gradient-to-r from-[var(--blue-lt)] to-white">
      {visible.map((m) => {
        const left = percentInRange(new Date(m.start).getTime(), range)
        return (
          <div
            key={m.fase}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${left}%` }}
          >
            <span className="whitespace-nowrap rounded bg-[var(--navy)] px-1.5 py-0.5 text-[9px] font-medium text-white">
              {m.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

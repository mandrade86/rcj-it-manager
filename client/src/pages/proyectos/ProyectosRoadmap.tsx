import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FolderKanban,
  GanttChartSquare,
  Layers,
  TrendingUp,
} from 'lucide-react'

import { TimelineGanttChart, type TimelineGanttRow } from '@/components/proyectos/TimelineGanttChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ejeBarClass } from '@/lib/ejeColors'
import {
  buildRoadmapTree,
  collectGroupIds,
  flattenRoadmapTree,
  ROADMAP_HIERARCHY_OPTIONS,
  type RoadmapHierarchyMode,
  type RoadmapTreeNode,
} from '@/lib/roadmapHierarchy'
import {
  computeRoadmapResumen,
  roadmapGruposResumen,
} from '@/lib/roadmapSummary'
import { computeTimelineRange, formatRangeLabel, percentInRange, FASE_MARKERS } from '@/lib/roadmapTimeline'
import { cn } from '@/lib/utils'
import type { Proyecto } from '@/types/proyecto'

type Props = {
  proyectos: Proyecto[]
  onSelect: (p: Proyecto) => void
}

function MiniTimeline({ proyectos, onSelect }: { proyectos: Proyecto[]; onSelect: (p: Proyecto) => void }) {
  const range = useMemo(() => computeTimelineRange(proyectos), [proyectos])

  return (
    <div className="relative mt-2 h-14 overflow-hidden rounded-md border border-border/80 bg-muted/20">
      {FASE_MARKERS.map((m) => {
        const t = new Date(m.start).getTime()
        if (t < range.start || t > range.end) return null
        const left = percentInRange(t, range)
        return (
          <div
            key={m.fase}
            className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-[var(--navy)]/25"
            style={{ left: `${left}%` }}
            title={m.label}
          />
        )
      })}
      {proyectos.map((p) => {
        if (!p.fecha_inicio && !p.fecha_fin) return null
        const a = p.fecha_inicio ? new Date(p.fecha_inicio).getTime() : range.start
        const b = p.fecha_fin ? new Date(p.fecha_fin).getTime() : a
        const lo = Math.max(range.start, a)
        const hi = Math.max(lo, Math.min(range.end, b))
        const left = percentInRange(lo, range)
        const width = Math.max(0.8, percentInRange(hi, range) - left)
        return (
          <button
            key={p._id}
            type="button"
            className={cn(
              'absolute top-3 h-8 rounded-sm opacity-90 ring-1 ring-black/10 transition hover:z-10 hover:opacity-100 hover:ring-2',
              ejeBarClass(p.eje),
            )}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={`${p.nombre} · ${p.porcentaje_avance}%`}
            onClick={() => onSelect(p)}
          />
        )
      })}
      <p className="absolute bottom-0.5 right-2 text-[9px] text-muted-foreground">{formatRangeLabel(range)}</p>
    </div>
  )
}

function roadmapNodeToGanttRow(
  node: RoadmapTreeNode,
  collapsed: Set<string>,
  onToggleGroup: (id: string) => void,
  onSelect: (p: Proyecto) => void,
): TimelineGanttRow {
  const isGroup = node.kind === 'group'
  const isCollapsed = isGroup && collapsed.has(node.id)

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
    barClassName: isGroup ? 'bg-[var(--navy)]/25' : ejeBarClass(node.project?.eje),
    onClick: isGroup ? undefined : node.project ? () => onSelect(node.project!) : undefined,
    onToggleExpand: isGroup ? () => onToggleGroup(node.id) : undefined,
  }
}

export function ProyectosRoadmap({ proyectos, onSelect }: Props) {
  const [mode, setMode] = useState<RoadmapHierarchyMode>('depto-fase-eje')
  const [ganttOpen, setGanttOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(collectGroupIds(buildRoadmapTree(proyectos, mode))))

  const resumen = useMemo(() => computeRoadmapResumen(proyectos), [proyectos])
  const grupos = useMemo(() => roadmapGruposResumen(proyectos, mode), [proyectos, mode])

  const tree = useMemo(() => buildRoadmapTree(proyectos, mode), [proyectos, mode])
  const flat = useMemo(() => flattenRoadmapTree(tree, collapsed), [tree, collapsed])
  const range = useMemo(() => computeTimelineRange(proyectos), [proyectos])

  const ganttRows = useMemo(
    () =>
      flat.map(({ node }) =>
        roadmapNodeToGanttRow(node, collapsed, (id) => {
          setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }, onSelect),
      ),
    [flat, collapsed, onSelect],
  )

  const topProyectos = useMemo(
    () =>
      proyectos
        .slice()
        .sort((a, b) => (b.porcentaje_avance ?? 0) - (a.porcentaje_avance ?? 0))
        .slice(0, 8),
    [proyectos],
  )

  if (!proyectos.length) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
        No hay proyectos para el roadmap. Ajuste filtros o agregue proyectos con fechas.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Resumen ejecutivo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResumenCard
          icon={FolderKanban}
          label="Total proyectos"
          value={String(resumen.total)}
          sub="En el alcance actual"
        />
        <ResumenCard
          icon={TrendingUp}
          label="Avance promedio"
          value={`${resumen.avancePromedio}%`}
          sub={`${resumen.activos} activos`}
          accent
        />
        <ResumenCard
          icon={CheckCircle2}
          label="Completados"
          value={String(resumen.completados)}
          sub="Estado Completado"
        />
        <ResumenCard
          icon={AlertTriangle}
          label="Bloqueados"
          value={String(resumen.bloqueados)}
          sub="Requieren atención"
          warn={resumen.bloqueados > 0}
        />
      </div>

      {/* Fases */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="size-4 text-[var(--lime)]" />
            Resumen por fase
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {resumen.porFase
            .filter((f) => f.fase !== null)
            .map((f) => (
              <div
                key={f.fase ?? 'x'}
                className="rounded-lg border border-border bg-muted/15 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
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
                <p className="mt-1 text-xs text-muted-foreground">Avance {f.avance}%</p>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Timeline compacto */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Línea de tiempo (resumen)</CardTitle>
            <span className="text-xs text-muted-foreground">Clic en una barra para abrir el proyecto</span>
          </div>
        </CardHeader>
        <CardContent>
          <MiniTimeline proyectos={proyectos} onSelect={onSelect} />
        </CardContent>
      </Card>

      {/* Agrupación + lista corta */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Por grupo</CardTitle>
              <select
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                value={mode}
                onChange={(e) => setMode(e.target.value as RoadmapHierarchyMode)}
              >
                {ROADMAP_HIERARCHY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="max-h-[280px] space-y-2 overflow-y-auto">
            {grupos.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-3 rounded-md border border-border/80 px-3 py-2 hover:bg-muted/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{g.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.count} proyecto{g.count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="w-20">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-[var(--navy)]"
                      style={{ width: `${g.avance}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{g.avance}%</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Proyectos destacados</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[280px] overflow-y-auto p-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-left text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Proyecto</th>
                  <th className="px-2 py-2 font-medium">Fase</th>
                  <th className="px-2 py-2 font-medium">Avance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topProyectos.map((p) => (
                  <tr
                    key={p._id}
                    className="cursor-pointer hover:bg-muted/25"
                    onClick={() => onSelect(p)}
                  >
                    <td className="max-w-[180px] truncate px-3 py-2 font-medium">{p.nombre}</td>
                    <td className="px-2 py-2 text-muted-foreground">{p.fase ?? '—'}</td>
                    <td className="px-2 py-2">
                      <span className="font-medium text-[var(--navy)]">{p.porcentaje_avance ?? 0}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Gantt detallado colapsable */}
      <Card>
        <CardHeader className="pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setGanttOpen((v) => !v)}
          >
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <GanttChartSquare className="size-4" />
              Gantt detallado (jerárquico)
            </CardTitle>
            <ChevronDown
              className={cn('size-5 text-muted-foreground transition', ganttOpen && 'rotate-180')}
            />
          </button>
        </CardHeader>
        {ganttOpen && (
          <CardContent className="space-y-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Vista ampliada con niveles expandibles · {formatRangeLabel(range)}
            </p>
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

function ResumenCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  warn,
}: {
  icon: typeof FolderKanban
  label: string
  value: string
  sub: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <Card className={cn(warn && 'border-amber-300/60 bg-amber-50/30')}>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            accent ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  )
}

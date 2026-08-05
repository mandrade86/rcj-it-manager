import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  Layers,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { GaugeRing } from '@/components/kpis/GaugeRing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchReporteStatusProyectos } from '@/lib/api/proyectos'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import { estadoColor, type ProyectoEstado } from '@/types/proyecto'
import type { ReporteStatusProyectoItem, ReporteStatusProyectos } from '@/types/reporteProyectos'

import { ReportePdfButtons } from '@/components/reportes/ReportePdfButtons'
import { ReporteStatusPrintSheet } from '@/components/reportes/ReporteStatusPrintSheet'
import { ReporteTareasDetalleList } from '@/components/reportes/ReporteTareasDetalleList'

const selectClass =
  'flex h-10 w-full rounded-lg border border-white/20 bg-white/90 px-3 py-1 text-sm shadow-sm outline-none backdrop-blur-sm focus-visible:border-[var(--lime)] focus-visible:ring-2 focus-visible:ring-[var(--lime)]/40'

const RIESGO_CHART_COLORS: Record<string, string> = {
  Alto: '#C00000',
  Medio: '#F59E0B',
  Bajo: '#70AD47',
  'Sin fecha': '#6B7280',
}

import { ProyectoStatusSheet } from './ProyectoStatusSheet'

type Props = {
  embedded?: boolean
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  alert,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof FolderKanban
  accent: string
  alert?: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/60 bg-white/95 p-4 shadow-md backdrop-blur-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg',
        alert && 'ring-2 ring-red-400/50',
      )}
    >
      <div
        className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              'mt-1 text-3xl font-bold tabular-nums tracking-tight',
              alert ? 'text-red-600' : 'text-[var(--navy)]',
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[10px] font-medium text-red-600">{sub}</p>}
        </div>
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-inner"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  )
}

function ProjectStatusCard({
  proyecto: p,
  deptNombre,
  onClick,
}: {
  proyecto: ReporteStatusProyectoItem
  deptNombre: string
  onClick: () => void
}) {
  const riesgoColor = p.riesgo_auto.color
  const avance = Math.min(100, p.porcentaje_avance)

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-border/80 bg-white text-left shadow-md transition-all duration-200 hover:-translate-y-1 hover:border-[var(--lime)]/60 hover:shadow-xl print:break-inside-avoid"
    >
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${riesgoColor}, ${riesgoColor}88)` }}
      />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div
              className="flex size-14 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(${riesgoColor} ${avance * 3.6}deg, var(--gray-lt) 0deg)`,
              }}
            >
              <div className="flex size-11 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <span className="text-sm font-bold text-[var(--navy)]">{avance}%</span>
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-semibold leading-snug text-[var(--navy)] group-hover:text-[var(--navy)]">
              {p.nombre}
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {p.proyecto_id} · {deptNombre}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge
                variant="outline"
                className={cn('text-[10px]', estadoColor(p.estado as ProyectoEstado))}
              >
                {p.estado}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold"
                style={{
                  borderColor: riesgoColor,
                  color: riesgoColor,
                  backgroundColor: `${riesgoColor}12`,
                }}
              >
                {p.riesgo_auto.nivel}
              </Badge>
              {p.riesgos_registrados > 0 && (
                <Badge
                  variant="outline"
                  className="gap-0.5 border-red-300 bg-red-50 text-[10px] font-semibold text-red-700"
                >
                  <AlertTriangle className="size-2.5" />
                  {p.riesgos_registrados} riesgo{p.riesgos_registrados === 1 ? '' : 's'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {p.riesgo_auto.motivo}
        </p>

        <div className="mt-3 rounded-lg bg-[var(--gray-lt)]/50 px-2.5 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tareas · {p.tareas_completadas}/{p.tareas_total} completadas · Avance {p.avance_tareas_promedio}%
          </p>
          {p.tareas.length > 0 ? (
            <ReporteTareasDetalleList tareas={p.tareas.slice(0, 3)} compact />
          ) : (
            <p className="text-[10px] text-muted-foreground">Sin tareas</p>
          )}
          {p.tareas.length > 3 && (
            <p className="mt-1 text-[10px] text-[var(--navy)]">+{p.tareas.length - 3} tareas más…</p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-dashed border-border/80 pt-3 text-[10px] font-semibold text-[var(--lime)] opacity-80 transition-opacity group-hover:opacity-100 print:hidden">
          <span>Ver detalle y documentar riesgos</span>
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  )
}

export function ReporteStatusProyectosPage({ embedded = false }: Props) {
  const [data, setData] = useState<ReporteStatusProyectos | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filtroDepto, setFiltroDepto] = useState<string | null>(null)
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [proyectoSheet, setProyectoSheet] = useState<ReporteStatusProyectoItem | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetchReporteStatusProyectos({
        alcance: filtroDepto ? 'departamento' : 'todos',
        departamento_id: filtroDepto ?? undefined,
        proyecto_id: filtroProyecto || undefined,
      })
      setData(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar reporte')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [filtroDepto, filtroProyecto])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const onBefore = () => document.body.classList.add('reporte-status-print-active')
    const onAfter = () => document.body.classList.remove('reporte-status-print-active')
    window.addEventListener('beforeprint', onBefore)
    window.addEventListener('afterprint', onAfter)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      window.removeEventListener('afterprint', onAfter)
      document.body.classList.remove('reporte-status-print-active')
    }
  }, [])

  const todosProyectos = useMemo(() => {
    if (!data) return [] as ReporteStatusProyectoItem[]
    return data.departamentos.flatMap((d) => d.proyectos)
  }, [data])

  const proyectosVisibles = useMemo(() => {
    let list = todosProyectos
    if (filtroDepto) list = list.filter((p) => p.departamento_id === filtroDepto)
    if (filtroProyecto) list = list.filter((p) => p.proyecto_id === filtroProyecto)
    return list
  }, [todosProyectos, filtroDepto, filtroProyecto])

  const deptosEnVista = useMemo(() => {
    if (!data) return []
    if (filtroDepto) return data.departamentos.filter((d) => d.departamento_id === filtroDepto)
    return data.departamentos
  }, [data, filtroDepto])

  const opcionesProyecto = useMemo(() => {
    const base = filtroDepto
      ? todosProyectos.filter((p) => p.departamento_id === filtroDepto)
      : todosProyectos
    return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [todosProyectos, filtroDepto])

  const chartRiesgo = useMemo(() => {
    const counts: Record<string, number> = { Alto: 0, Medio: 0, Bajo: 0, 'Sin fecha': 0 }
    for (const p of proyectosVisibles) {
      const n = p.riesgo_auto.nivel
      counts[n] = (counts[n] ?? 0) + 1
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, fill: RIESGO_CHART_COLORS[name] ?? '#6B7280' }))
  }, [proyectosVisibles])

  const avanceVista = useMemo(() => {
    if (proyectosVisibles.length === 0) return 0
    return Math.round(
      proyectosVisibles.reduce((s, p) => s + p.porcentaje_avance, 0) / proyectosVisibles.length,
    )
  }, [proyectosVisibles])

  function limpiarFiltros() {
    setFiltroDepto(null)
    setFiltroProyecto('')
  }

  const tituloAlcance = useMemo(() => {
    if (filtroProyecto) {
      const p = todosProyectos.find((x) => x.proyecto_id === filtroProyecto)
      return p ? `Proyecto: ${p.nombre}` : 'Proyecto seleccionado'
    }
    if (filtroDepto) {
      const d = data?.departamentos_disponibles.find((x) => x._id === filtroDepto)
      return d ? `Departamento: ${d.nombre}` : 'Departamento seleccionado'
    }
    return 'Todos los departamentos'
  }, [filtroProyecto, filtroDepto, todosProyectos, data?.departamentos_disponibles])

  return (
    <div className={cn('reporte-status-page space-y-6', !embedded && 'mx-auto max-w-7xl')}>
      {/* Hero ejecutivo */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl shadow-xl print:hidden',
          embedded ? 'p-5' : 'p-6 sm:p-8',
        )}
        style={{
          background: 'linear-gradient(135deg, #002060 0%, #003080 45%, #1a4a8a 100%)',
        }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-[var(--lime)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-48 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            {!embedded && (
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--lime)]">
                <Sparkles className="size-3.5" />
                Reportería ejecutiva
              </p>
            )}
            <h1
              className={cn(
                'font-bold tracking-tight text-white',
                embedded ? 'text-xl' : 'text-2xl sm:text-3xl',
              )}
            >
              Project Status Dashboard
            </h1>
            <p className="mt-2 max-w-xl text-sm text-blue-100/90">
              Portafolio de proyectos por departamento — filtra, explora y documenta riesgos con
              evidencias para presentar a gerencia.
            </p>
            {data && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100">
                <TrendingUp className="size-3.5 text-[var(--lime)]" />
                Actualizado {formatDateDMY(data.generado_en)}
              </p>
            )}
          </div>
          {data ? (
            <ReportePdfButtons
              filename={`project-status-${data.generado_en.slice(0, 10)}.pdf`}
              renderPrintSheet={(onMounted) => (
                <ReporteStatusPrintSheet
                  data={data}
                  tituloAlcance={tituloAlcance}
                  onMounted={onMounted}
                />
              )}
            />
          ) : (
            <Button type="button" variant="secondary" disabled className="border-0 bg-white/60 text-[var(--navy)]">
              Descargar PDF
            </Button>
          )}
        </div>

        {/* Filtros integrados en hero */}
        <div className="relative mt-6 space-y-4 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-100/80">
              Departamentos
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltroDepto(null)
                  setFiltroProyecto('')
                }}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                  filtroDepto === null
                    ? 'bg-[var(--lime)] text-[var(--navy)] shadow-md'
                    : 'bg-white/15 text-white hover:bg-white/25',
                )}
              >
                Todos
              </button>
              {(data?.departamentos_disponibles ?? []).map((d) => (
                <button
                  key={d._id}
                  type="button"
                  onClick={() => {
                    setFiltroDepto(d._id)
                    setFiltroProyecto('')
                  }}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                    filtroDepto === d._id
                      ? 'bg-[var(--lime)] text-[var(--navy)] shadow-md'
                      : 'bg-white/15 text-white hover:bg-white/25',
                  )}
                >
                  {d.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-100/80" htmlFor="filtro-proyecto">
                Proyecto
              </label>
              <select
                id="filtro-proyecto"
                className={selectClass}
                value={filtroProyecto}
                onChange={(e) => setFiltroProyecto(e.target.value)}
              >
                <option value="">— Todos los proyectos —</option>
                {opcionesProyecto.map((p) => (
                  <option key={p.proyecto_id} value={p.proyecto_id}>
                    {p.nombre} ({p.proyecto_id})
                  </option>
                ))}
              </select>
            </div>
            {(filtroDepto || filtroProyecto) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-white hover:bg-white/15 hover:text-white"
                onClick={limpiarFiltros}
              >
                <X className="size-3.5" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-white py-16 shadow-sm">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--navy)] border-t-[var(--lime)]" />
          <p className="text-sm font-medium text-muted-foreground">Cargando portafolio…</p>
        </div>
      )}

      {err && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
          {err}
        </p>
      )}

      {data && !loading && (
        <>
          {/* Cabecera impresión */}
          <div className="reporte-status-header hidden rounded-lg border border-border bg-white p-4 shadow-sm print:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              RCJ Corporación — IT Manager
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">
              Project Status Dashboard
            </h2>
            <p className="text-sm text-muted-foreground">
              Generado: {formatDateDMY(data.generado_en)}
            </p>
          </div>

          {/* KPIs + gauge + gráfica */}
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
              <KpiCard
                label="Proyectos"
                value={data.resumen.total_proyectos}
                icon={FolderKanban}
                accent="#002060"
              />
              <KpiCard
                label="Departamentos"
                value={data.resumen.total_departamentos}
                icon={Building2}
                accent="#1F4E79"
              />
              <KpiCard
                label="Activos"
                value={data.resumen.activos}
                icon={Activity}
                accent="#70AD47"
              />
              <KpiCard
                label="Completados"
                value={data.resumen.completados}
                icon={CheckCircle2}
                accent="#0F6E56"
              />
              <KpiCard
                label="Avance prom."
                value={`${data.resumen.avance_promedio}%`}
                icon={TrendingUp}
                accent="#4527A0"
              />
              <KpiCard
                label="Riesgos doc."
                value={data.resumen.riesgos_registrados}
                sub={data.resumen.riesgos_alto > 0 ? `${data.resumen.riesgos_alto} nivel alto` : undefined}
                icon={AlertTriangle}
                accent="#C00000"
                alert={data.resumen.riesgos_alto > 0}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-white to-[var(--blue-lt)]/40 shadow-lg">
                <CardContent className="flex flex-col items-center pt-6 pb-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Avance del portafolio
                  </p>
                  <GaugeRing value={avanceVista} size={120} />
                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    {proyectosVisibles.length} proyecto{proyectosVisibles.length === 1 ? '' : 's'} en vista
                  </p>
                </CardContent>
              </Card>

              {chartRiesgo.length > 0 && (
                <Card className="overflow-hidden border-0 shadow-lg">
                  <CardHeader className="pb-1 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm text-[var(--navy)]">
                      <BarChart3 className="size-4 text-[var(--lime)]" />
                      Riesgo automático
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-36 pb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRiesgo} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={64}
                          tick={{ fontSize: 11, fill: '#6B7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(0,32,96,0.06)' }}
                          contentStyle={{ borderRadius: 8, fontSize: 12 }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
                          {chartRiesgo.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Departamentos */}
          {!filtroProyecto && deptosEnVista.length > 0 && (
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--navy)] print:hidden">
                <Layers className="size-4 text-[var(--lime)]" />
                Por departamento
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:hidden">
                {deptosEnVista.map((dept) => {
                  const selected = filtroDepto === dept.departamento_id
                  const riesgosDept = dept.proyectos.reduce((s, p) => s + p.riesgos_registrados, 0)
                  return (
                    <button
                      key={dept.departamento_id ?? 'sin-depto'}
                      type="button"
                      onClick={() => setFiltroDepto(dept.departamento_id)}
                      className={cn(
                        'group relative overflow-hidden rounded-xl border p-4 text-left shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl',
                        selected
                          ? 'border-[var(--lime)] bg-[var(--lime-lt)]/50 ring-2 ring-[var(--lime)]/40'
                          : 'border-border bg-white hover:border-[var(--navy)]/20',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--navy)]/10 text-[var(--navy)]">
                          <Building2 className="size-5" />
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-3 font-semibold text-[var(--navy)]">{dept.departamento_nombre}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dept.resumen.total_proyectos} proyectos · {dept.resumen.activos} activos
                      </p>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[10px]">
                          <span className="text-muted-foreground">Avance</span>
                          <span className="font-semibold text-[var(--navy)]">
                            {dept.resumen.avance_promedio}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--navy)] to-[var(--lime)]"
                            style={{ width: `${dept.resumen.avance_promedio}%` }}
                          />
                        </div>
                      </div>
                      {riesgosDept > 0 && (
                        <p className="mt-2 flex items-center gap-1 text-[10px] font-medium text-red-600">
                          <AlertTriangle className="size-3" />
                          {riesgosDept} riesgo{riesgosDept === 1 ? '' : 's'} documentado{riesgosDept === 1 ? '' : 's'}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Proyectos */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--navy)]">
              <FolderKanban className="size-4 text-[var(--lime)]" />
              Proyectos
              <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                {proyectosVisibles.length}
              </Badge>
            </h2>

            {proyectosVisibles.length === 0 ? (
              <Card className="border-dashed shadow-sm">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <FolderKanban className="mb-3 size-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No hay proyectos para los filtros seleccionados.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {proyectosVisibles.map((p) => {
                  const deptNombre =
                    data.departamentos.find((d) => d.departamento_id === p.departamento_id)
                      ?.departamento_nombre ?? '—'
                  return (
                    <ProjectStatusCard
                      key={p.proyecto_id}
                      proyecto={p}
                      deptNombre={deptNombre}
                      onClick={() => setProyectoSheet(p)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <ProyectoStatusSheet
        proyecto={proyectoSheet}
        open={proyectoSheet != null}
        onOpenChange={(o) => {
          if (!o) setProyectoSheet(null)
        }}
        onChanged={() => void cargar()}
      />
    </div>
  )
}

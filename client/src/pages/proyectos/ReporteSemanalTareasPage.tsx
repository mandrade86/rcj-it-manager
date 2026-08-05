import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  ListTodo,
  PauseCircle,
  PieChart as PieChartIcon,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { GaugeRing } from '@/components/kpis/GaugeRing'
import { ReportePdfButtons } from '@/components/reportes/ReportePdfButtons'
import { ReporteSemanalPrintSheet } from '@/components/reportes/ReporteSemanalPrintSheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TareaTagsList } from '@/components/proyectos/TareaTagsList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchProyectos } from '@/lib/api/proyectos'
import { fetchReporteSemanalTareas } from '@/lib/api/tareas'
import { formatDateDMY } from '@/lib/format'
import { estadoTareaColor } from '@/lib/tareaDependencias'
import { cn } from '@/lib/utils'
import type { DepartamentoDoc } from '@/types/departamento'
import type { Proyecto } from '@/types/proyecto'
import type { ReporteSemanalTareas, TareaEstado } from '@/types/tarea'

const selectClass =
  'flex h-10 w-full rounded-lg border border-white/20 bg-white/90 px-3 py-1 text-sm shadow-sm outline-none backdrop-blur-sm focus-visible:border-[var(--lime)] focus-visible:ring-2 focus-visible:ring-[var(--lime)]/40'

const ESTADO_COLORS: Record<string, string> = {
  Completadas: '#70AD47',
  'En progreso': '#002060',
  Pendientes: '#6B7280',
  Bloqueadas: '#C00000',
}

function isoWeekNow(): string {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day + 3)
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  const week =
    1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function estadoBadgeClass(estado: TareaEstado) {
  return cn('text-[10px] font-semibold', estadoTareaColor(estado))
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
  icon: typeof ListTodo
  accent: string
  alert?: boolean
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/60 bg-white/95 p-4 shadow-md backdrop-blur-sm',
        alert && 'ring-2 ring-red-400/50',
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn('mt-1 text-3xl font-bold tabular-nums', alert ? 'text-red-600' : 'text-[var(--navy)]')}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{sub}</p>}
        </div>
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  )
}

export function ReporteSemanalTareasPage({ embedded = false }: { embedded?: boolean }) {
  const [semana, setSemana] = useState(isoWeekNow)
  const [alcance, setAlcance] = useState<'todos' | 'proyecto' | 'departamento'>('todos')
  const [proyectoId, setProyectoId] = useState('')
  const [departamentoId, setDepartamentoId] = useState('')
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [departamentos, setDepartamentos] = useState<DepartamentoDoc[]>([])
  const [data, setData] = useState<ReporteSemanalTareas | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([fetchProyectos(), fetchDepartamentos()])
      .then(([ps, ds]) => {
        setProyectos(ps.filter((p) => p.estado !== 'Cancelado'))
        setDepartamentos(ds.filter((d) => d.activo !== false))
      })
      .catch(() => {
        setProyectos([])
        setDepartamentos([])
      })
  }, [])

  const cargar = useCallback(async () => {
    if (!semana) return
    if (alcance === 'proyecto' && !proyectoId) {
      setErr('Selecciona un proyecto para este reporte.')
      setData(null)
      return
    }
    if (alcance === 'departamento' && !departamentoId) {
      setErr('Selecciona un departamento para este reporte.')
      setData(null)
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const r = await fetchReporteSemanalTareas({
        semana,
        alcance,
        proyecto_id: alcance === 'proyecto' ? proyectoId : undefined,
        departamento_id: alcance === 'departamento' ? departamentoId : undefined,
      })
      setData(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar reporte')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [semana, alcance, proyectoId, departamentoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    const onBefore = () => document.body.classList.add('reporte-semanal-print-active')
    const onAfter = () => document.body.classList.remove('reporte-semanal-print-active')
    window.addEventListener('beforeprint', onBefore)
    window.addEventListener('afterprint', onAfter)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      window.removeEventListener('afterprint', onAfter)
      document.body.classList.remove('reporte-semanal-print-active')
    }
  }, [])

  const tituloAlcance = useMemo(() => {
    if (alcance === 'proyecto') {
      const p = proyectos.find((x) => x._id === proyectoId)
      return p ? `Proyecto: ${p.nombre}` : 'Proyecto seleccionado'
    }
    if (alcance === 'departamento') {
      const d = departamentos.find((x) => x._id === departamentoId)
      return d ? `Departamento: ${d.nombre}` : 'Departamento seleccionado'
    }
    return 'Todos los proyectos activos'
  }, [alcance, proyectoId, departamentoId, proyectos, departamentos])

  const chartEstados = useMemo(() => {
    if (!data) return []
    const items = [
      { name: 'Completadas', value: data.resumen.completadas },
      { name: 'En progreso', value: data.resumen.en_progreso },
      { name: 'Pendientes', value: data.resumen.pendientes },
      { name: 'Bloqueadas', value: data.resumen.bloqueadas },
    ]
    return items
      .filter((i) => i.value > 0)
      .map((i) => ({ ...i, fill: ESTADO_COLORS[i.name] ?? '#6B7280' }))
  }, [data])

  const chartProyectos = useMemo(() => {
    if (!data) return []
    return [...data.proyectos]
      .sort((a, b) => b.tareas.length - a.tareas.length)
      .slice(0, 8)
      .map((p) => ({
        name: p.proyecto_nombre.length > 22 ? `${p.proyecto_nombre.slice(0, 20)}…` : p.proyecto_nombre,
        tareas: p.tareas.length,
        avance: p.avance_proyecto,
      }))
  }, [data])

  const mensajeEjecutivo = useMemo(() => {
    if (!data || data.actividad_semana.total_tareas === 0) return null
    const r = data.actividad_semana
    const lineas: string[] = [
      `Durante ${data.semana.etiqueta.toLowerCase()} se reportan ${r.total_tareas} tareas con actividad en ${r.proyectos_con_tareas} proyecto${r.proyectos_con_tareas === 1 ? '' : 's'}.`,
      `En la semana se completaron ${r.completadas} tareas (${r.pct_completadas}% del total semanal) con avance promedio del ${r.avance_promedio}%.`,
    ]
    if (r.bloqueadas > 0) {
      lineas.push(`${r.bloqueadas} tarea${r.bloqueadas === 1 ? '' : 's'} bloqueada${r.bloqueadas === 1 ? '' : 's'} en la semana requiere${r.bloqueadas === 1 ? '' : 'n'} escalamiento.`)
    }
    if (r.vencidas > 0) {
      lineas.push(`${r.vencidas} tarea${r.vencidas === 1 ? '' : 's'} vencida${r.vencidas === 1 ? '' : 's'} dentro del alcance semanal.`)
    }
    if (r.bloqueadas === 0 && r.vencidas === 0) {
      lineas.push('Sin tareas bloqueadas ni vencidas en el alcance de la semana.')
    }
    return lineas
  }, [data])

  function limpiarFiltrosExtra() {
    setAlcance('todos')
    setProyectoId('')
    setDepartamentoId('')
  }

  return (
    <div className={cn('reporte-semanal-page space-y-6', !embedded && 'mx-auto max-w-7xl')}>
      {/* Hero */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl shadow-xl print:hidden',
          embedded ? 'p-5' : 'p-6 sm:p-8',
        )}
        style={{ background: 'linear-gradient(135deg, #002060 0%, #003080 50%, #1a4a8a 100%)' }}
      >
        <div className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full bg-[var(--lime)]/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            {!embedded && (
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[var(--lime)]">
                <Sparkles className="size-3.5" />
                Para gerencia
              </p>
            )}
            <h1 className={cn('font-bold tracking-tight text-white', embedded ? 'text-xl' : 'text-2xl sm:text-3xl')}>
              Resumen ejecutivo de tareas
            </h1>
            <p className="mt-2 text-sm text-blue-100/90">
              Avance semanal consolidado por proyecto — listo para imprimir o compartir con presidencia.
            </p>
            {data && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100">
                <CalendarRange className="size-3.5 text-[var(--lime)]" />
                {data.semana.etiqueta}
              </p>
            )}
          </div>
          {data ? (
            <ReportePdfButtons
              filename={`resumen-tareas-${data.semana.iso}.pdf`}
              renderPrintSheet={(onMounted) => (
                <ReporteSemanalPrintSheet
                  data={data}
                  tituloAlcance={tituloAlcance}
                  mensajeEjecutivo={mensajeEjecutivo}
                  onMounted={onMounted}
                />
              )}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled
              className="gap-2 border-0 bg-white/60 text-[var(--navy)]"
            >
              Descargar PDF
            </Button>
          )}
        </div>

        <div className="relative mt-6 grid gap-3 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-100/80" htmlFor="rep-semana">
              Semana
            </label>
            <input
              id="rep-semana"
              type="week"
              className={selectClass}
              value={semana}
              onChange={(e) => setSemana(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-100/80" htmlFor="rep-alcance">
              Alcance
            </label>
            <select
              id="rep-alcance"
              className={selectClass}
              value={alcance}
              onChange={(e) => setAlcance(e.target.value as typeof alcance)}
            >
              <option value="todos">Todos los proyectos</option>
              <option value="proyecto">Por proyecto</option>
              <option value="departamento">Por departamento</option>
            </select>
          </div>
          {alcance === 'proyecto' && (
            <div className="grid gap-1.5 sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-100/80" htmlFor="rep-proy">
                Proyecto
              </label>
              <select id="rep-proy" className={selectClass} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {proyectos.map((p) => (
                  <option key={p._id} value={p._id}>{p._id} — {p.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {alcance === 'departamento' && (
            <div className="grid gap-1.5 sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-blue-100/80" htmlFor="rep-depto">
                Departamento
              </label>
              <select id="rep-depto" className={selectClass} value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {departamentos.map((d) => (
                  <option key={d._id} value={d._id}>{d.nombre}</option>
                ))}
              </select>
            </div>
          )}
          {alcance !== 'todos' && (
            <div className="flex items-end sm:col-span-2 lg:col-span-4">
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-white hover:bg-white/15" onClick={limpiarFiltrosExtra}>
                <X className="size-3.5" />
                Ver todos los proyectos
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-white py-16 shadow-sm">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--navy)] border-t-[var(--lime)]" />
          <p className="text-sm font-medium text-muted-foreground">Generando resumen…</p>
        </div>
      )}

      {err && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</p>
      )}

      {data && !loading && (
        <>
          {/* Cabecera impresión */}
          <div className="reporte-semanal-header hidden rounded-lg border border-border bg-white p-4 shadow-sm print:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RCJ Corporación — IT Manager</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">Resumen ejecutivo de tareas</h2>
            <p className="text-sm text-muted-foreground">{data.semana.etiqueta} · {tituloAlcance}</p>
            <p className="text-sm text-muted-foreground">Generado: {formatDateDMY(new Date().toISOString())}</p>
          </div>

          {/* Mensaje ejecutivo */}
          {mensajeEjecutivo && (
            <div
              className="rounded-xl border border-[var(--lime)]/30 p-5 shadow-md"
              style={{ background: 'linear-gradient(135deg, var(--lime-lt) 0%, #fff 100%)' }}
            >
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--navy)]">
                <FileText className="size-4 text-[var(--lime)]" />
                Mensaje para gerencia
              </h2>
              <ul className="space-y-2">
                {mensajeEjecutivo.map((linea) => (
                  <li key={linea} className="flex gap-2 text-sm leading-relaxed text-[var(--navy)]/90">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--lime)]" />
                    {linea}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">{tituloAlcance}</p>
            </div>
          )}

          {/* KPIs + gráficas */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Portafolio actual — mismo alcance y criterios que el Dashboard (tareas vencidas: fecha fin anterior a hoy).
            </p>
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
              <KpiCard
                label="Proyectos activos"
                value={`${data.resumen.proyectos_activos} / ${data.resumen.total_proyectos}`}
                icon={FolderKanban}
                accent="#002060"
              />
              <KpiCard label="Tareas totales" value={data.resumen.total_tareas} icon={ListTodo} accent="#1F4E79" />
              <KpiCard
                label="Completadas"
                value={data.resumen.completadas}
                sub={`${data.resumen.pct_completadas}% del total`}
                icon={CheckCircle2}
                accent="#70AD47"
              />
              <KpiCard label="En progreso" value={data.resumen.en_progreso} icon={TrendingUp} accent="#4527A0" />
              <KpiCard
                label="Bloqueadas"
                value={data.resumen.bloqueadas}
                icon={PauseCircle}
                accent="#C00000"
                alert={data.resumen.bloqueadas > 0}
              />
              <KpiCard
                label="Vencidas"
                value={data.resumen.vencidas}
                icon={AlertTriangle}
                accent="#DC2626"
                alert={data.resumen.vencidas > 0}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-white to-[var(--blue-lt)]/40 shadow-lg">
                <CardContent className="flex flex-col items-center pt-6 pb-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Avance promedio
                  </p>
                  <GaugeRing value={data.resumen.avance_promedio} size={112} />
                </CardContent>
              </Card>

              {chartEstados.length > 0 && (
                <Card className="overflow-hidden border-0 shadow-lg">
                  <CardHeader className="pb-0 pt-4">
                    <CardTitle className="flex items-center gap-2 text-sm text-[var(--navy)]">
                      <PieChartIcon className="size-4 text-[var(--lime)]" />
                      Por estado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-40 pb-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartEstados}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={58}
                          paddingAngle={2}
                        >
                          {chartEstados.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          </div>

          {chartProyectos.length > 1 && (
            <Card className="overflow-hidden border-0 shadow-lg print:hidden">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm text-[var(--navy)]">Tareas por proyecto (top)</CardTitle>
              </CardHeader>
              <CardContent className="h-44 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartProyectos} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10 }} width={28} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="tareas" fill="#002060" radius={[4, 4, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Atención requerida */}
          {(data.destacados.bloqueadas.length > 0 || data.destacados.vencidas.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.destacados.bloqueadas.length > 0 && (
                <Card className="border-red-200 bg-red-50/50 shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-red-800">
                      <PauseCircle className="size-4" />
                      Tareas bloqueadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.destacados.bloqueadas.map((t) => (
                      <div key={t.tarea_id} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm">
                        <p className="font-medium text-[var(--navy)]">{t.tarea_nombre}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.proyecto_nombre} · {t.responsable ?? 'Sin responsable'}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {data.destacados.vencidas.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50 shadow-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-amber-900">
                      <Clock className="size-4" />
                      Tareas vencidas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {data.destacados.vencidas.map((t) => (
                      <div key={t.tarea_id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm">
                        <p className="font-medium text-[var(--navy)]">{t.tarea_nombre}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.proyecto_nombre} · Fin {formatDateDMY(t.fecha_fin)} · {t.responsable ?? '—'}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Detalle por proyecto */}
          {data.proyectos.length === 0 ? (
            <Card className="border-dashed shadow-sm">
              <CardContent className="flex flex-col items-center py-16 text-center">
                <ListTodo className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No hay tareas activas para la semana y filtros seleccionados.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--navy)]">
                <FolderKanban className="size-4 text-[var(--lime)]" />
                Detalle por proyecto
              </h2>
              {data.proyectos.map((proy) => (
                <Card key={proy.proyecto_id} className="overflow-hidden border-0 shadow-lg break-inside-avoid">
                  <CardHeader
                    className="border-b pb-3"
                    style={{ background: 'linear-gradient(90deg, var(--gray-lt) 0%, #fff 100%)' }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base text-[var(--navy)]">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-[var(--navy)]/10">
                          <FolderKanban className="size-4 text-[var(--navy)]" />
                        </div>
                        {proy.proyecto_nombre}
                        <span className="text-xs font-normal text-muted-foreground">({proy.proyecto_id})</span>
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                        {proy.eje && <Badge variant="outline" className="text-xs">{proy.eje}</Badge>}
                        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs shadow-sm">
                          <span className="text-muted-foreground">Avance</span>
                          <span className="font-bold text-[var(--navy)]">{proy.avance_proyecto}%</span>
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[var(--lime)]"
                              style={{ width: `${Math.min(100, proy.avance_proyecto)}%` }}
                            />
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">{proy.tareas.length} tareas</Badge>
                        <span className="text-xs text-muted-foreground">
                          Avance tareas: <strong className="text-[var(--navy)]">{proy.avance_tareas_promedio}%</strong>
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="divide-y divide-border/60 p-0">
                    {proy.tareas.map((t) => (
                      <div key={t._id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[var(--navy)]">{t.nombre}</p>
                          {t.descripcion && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.descripcion}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {t.responsable ?? 'Sin responsable'} · {formatDateDMY(t.fecha_inicio)} → {formatDateDMY(t.fecha_fin)}
                            {(t.comentarios_count ?? 0) > 0 && ` · ${t.comentarios_count} comentario(s)`}
                          </p>
                          {t.ultimo_comentario && (
                            <p className="mt-1 line-clamp-2 text-[11px] italic text-muted-foreground">
                              «{t.ultimo_comentario}»
                            </p>
                          )}
                          <TareaTagsList tags={t.tags} className="mt-1.5" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={estadoBadgeClass(t.estado)}>{t.estado}</Badge>
                          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--gray-lt)] px-2 py-1">
                            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-[var(--lime)]"
                                style={{ width: `${Math.min(100, t.porcentaje)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold tabular-nums text-[var(--navy)]">{t.porcentaje}%</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{formatDateDMY(t.fecha_fin)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

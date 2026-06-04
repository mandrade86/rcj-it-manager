import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  FolderKanban,
  Gauge,
  Printer,
  Target,
  Users,
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

import { GaugeRing } from '@/components/kpis/GaugeRing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchResumenDepartamento } from '@/lib/api/dashboard'
import { subscribeKpiDataChanged } from '@/lib/kpiSync'
import { formatDateDMY } from '@/lib/format'
import type { ResumenDepartamento } from '@/types/resumenDepartamento'
import { cn } from '@/lib/utils'

const FASE_COLORS = ['#1F4E79', '#70AD47', '#4527A0']

function estadoBadge(estado: string) {
  if (estado === 'Completado' || estado === 'En progreso')
    return estado === 'Completado'
      ? 'bg-[var(--lime-lt)] text-[var(--navy)]'
      : 'bg-amber-500/10 text-amber-900'
  if (estado === 'Bloqueado') return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

function prioridadClass(p: string) {
  if (p === 'Alta') return 'border-red-300 bg-red-50 text-red-800'
  if (p === 'Baja') return 'border-slate-300 bg-slate-50 text-slate-700'
  return 'border-blue-300 bg-blue-50 text-blue-800'
}

export function ResumenDepartamentoPage() {
  const [data, setData] = useState<ResumenDepartamento | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setData(await fetchResumenDepartamento())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => subscribeKpiDataChanged(() => void reload()), [reload])

  useEffect(() => {
    const onBefore = () => document.body.classList.add('resumen-depto-print-active')
    const onAfter = () => document.body.classList.remove('resumen-depto-print-active')
    window.addEventListener('beforeprint', onBefore)
    window.addEventListener('afterprint', onAfter)
    return () => {
      window.removeEventListener('beforeprint', onBefore)
      window.removeEventListener('afterprint', onAfter)
      document.body.classList.remove('resumen-depto-print-active')
    }
  }, [])

  const faseChart = useMemo(
    () =>
      (data?.plan_trabajo.avance_por_fase ?? []).map((f) => ({
        nombre: `Fase ${f.fase}`,
        proyectos: f.count,
        avance: f.pct,
      })),
    [data],
  )

  const topProyectos = useMemo(() => {
    if (!data) return []
    return [...data.plan_trabajo.proyectos].sort((a, b) => b.avance - a.avance).slice(0, 8)
  }, [data])

  const hoy = formatDateDMY(new Date().toISOString())

  return (
    <div className="resumen-depto-page space-y-8">
      <div className="resumen-depto-no-print flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--navy)]">
              Resumen departamento — Metas y plan de trabajo
            </h2>
            {data && (
              <Badge
                variant="outline"
                className="gap-1 border-[var(--navy)]/30 text-[var(--navy)]"
              >
                <Building2 className="size-3" />
                {data.departamento.nombre} ({data.departamento.codigo})
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Vista ejecutiva para comité y jefatura · {hoy}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            {loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!data}
            onClick={() => window.print()}
          >
            <Printer className="size-3.5" />
            Imprimir
          </Button>
        </div>
      </div>

      {err && (
        <p className="text-sm text-destructive">
          {err}{' '}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => void reload()}>
            Reintentar
          </Button>
        </p>
      )}

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Cargando resumen…</p>
      ) : data ? (
        <>
          <Card className="border-[var(--navy)]/20 bg-gradient-to-br from-[var(--blue-lt)]/50 to-background shadow-sm">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lectura rápida
              </p>
              <p className="mt-2 text-base leading-relaxed text-foreground">{data.lectura_rapida}</p>
            </CardContent>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Proyectos activos</CardTitle>
                <FolderKanban className="size-4 text-[var(--navy)]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">
                  {data.plan_trabajo.proyectos_activos}
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}
                    / {data.plan_trabajo.proyectos_total}
                  </span>
                </p>
                <Link to="/proyectos" className="mt-2 inline-block text-xs text-[var(--navy)] underline">
                  Ver portafolio
                </Link>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tareas vencidas</CardTitle>
                <AlertTriangle className="size-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    data.plan_trabajo.tareas_vencidas > 0 ? 'text-destructive' : 'text-[var(--navy)]',
                  )}
                >
                  {data.plan_trabajo.tareas_vencidas}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">KPI promedio</CardTitle>
                <Gauge className="size-4 text-[var(--navy)]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">
                  {data.kpi_promedio_pct}%
                </p>
                <Link to="/kpis" className="mt-2 inline-block text-xs text-[var(--navy)] underline">
                  Registrar KPIs
                </Link>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Equipo en sistema</CardTitle>
                <Users className="size-4 text-[var(--navy)]" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums text-[var(--navy)]">
                  {data.equipo.activos}
                  <span className="text-base font-normal text-muted-foreground"> / {data.equipo.total}</span>
                </p>
                <Link to="/equipo" className="mt-2 inline-block text-xs text-[var(--navy)] underline">
                  Ver equipo
                </Link>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--navy)]">
                <Target className="size-4" />
                Metas estratégicas del departamento
              </h3>
              <Link to="/maestros/metas" className="text-xs text-[var(--navy)] underline resumen-depto-no-print">
                Editar metas
              </Link>
            </div>
            {data.metas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Sin metas configuradas. Defínalas en Objetivos estratégicos.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {data.metas.map((m) => (
                  <Card key={m.id} className="overflow-hidden shadow-sm">
                    <CardHeader className="border-b bg-muted/20 pb-3">
                      <CardTitle className="text-sm leading-snug">{m.titulo}</CardTitle>
                      <p className="text-xs text-muted-foreground line-clamp-2">{m.objetivo}</p>
                      {m.valor_objetivo && (
                        <p className="text-xs font-medium text-[var(--navy)]">Meta: {m.valor_objetivo}</p>
                      )}
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-3 pt-4">
                      <GaugeRing value={m.avance_pct} size={96} />
                      <p className="text-center text-xs text-muted-foreground">
                        {m.kpi_count} KPI{m.kpi_count === 1 ? '' : 's'} vinculados
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="size-4" />
                  Avance por fase
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faseChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v) => [`${Number(v ?? 0)}%`, 'Avance prom.']} />
                    <Bar dataKey="avance" name="avance" radius={[4, 4, 0, 0]}>
                      {faseChart.map((_, i) => (
                        <Cell key={i} fill={FASE_COLORS[i % FASE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Proyectos con mayor avance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topProyectos.map((p) => (
                  <div key={p._id} className="space-y-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <Link
                        to={`/proyectos/${p._id}`}
                        className="font-medium text-[var(--navy)] hover:underline line-clamp-1"
                      >
                        {p.nombre}
                      </Link>
                      <span className="shrink-0 font-semibold tabular-nums">{p.avance}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--lime)] transition-all"
                        style={{ width: `${p.avance}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Plan de trabajo — portafolio completo</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto</TableHead>
                    <TableHead>Eje</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead className="text-right">Avance</TableHead>
                    <TableHead>Fin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.plan_trabajo.proyectos.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <Link
                          to={`/proyectos/${p._id}`}
                          className="font-medium text-[var(--navy)] hover:underline"
                        >
                          {p.nombre}
                        </Link>
                        {p.responsable && (
                          <p className="text-xs text-muted-foreground">{p.responsable}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{p.eje || '—'}</TableCell>
                      <TableCell>{p.fase ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={estadoBadge(p.estado)}>
                          {p.estado}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={prioridadClass(p.prioridad)}>
                          {p.prioridad}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{p.avance}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateDMY(p.fecha_fin)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {data.metas.some((m) => m.kpis.length > 0) && (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Detalle KPIs por meta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.metas.map((m) =>
                  m.kpis.length > 0 ? (
                    <div key={m.id}>
                      <p className="mb-2 text-sm font-semibold text-[var(--navy)]">{m.titulo}</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>KPI</TableHead>
                            <TableHead>Eje</TableHead>
                            <TableHead>Meta</TableHead>
                            <TableHead className="text-right">Avance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {m.kpis.map((k) => (
                            <TableRow key={k._id}>
                              <TableCell className="font-medium">{k.nombre}</TableCell>
                              <TableCell className="text-xs">{k.eje}</TableCell>
                              <TableCell className="text-xs">{k.meta ?? '—'}</TableCell>
                              <TableCell className="text-right">
                                {k.tiene_registro ? (
                                  <span className="font-semibold tabular-nums">{k.avance_pct}%</span>
                                ) : (
                                  <span className="text-xs text-amber-700">Sin registro</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null,
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}

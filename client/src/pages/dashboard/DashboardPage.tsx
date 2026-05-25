import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Building2, FolderKanban, Gauge, GraduationCap, Globe, User, UsersRound } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import { PaginationBar } from '@/components/ui/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
import { fetchDashboardResumen } from '@/lib/api/dashboard'
import { formatDateDMY } from '@/lib/format'
import {
  isMetaEstrategicaId,
  metaEstrategicaDeKpi,
  METAS_ESTRATEGICAS,
  type KpiDoc,
  type MetaEstrategicaId,
} from '@/types/kpi'
import { pctMetaEstrategica, ultimoRegistro } from '@/lib/kpiAvance'
import type { DashboardAlcanceTipo, DashboardResumen } from '@/types/dashboard'

import { DashboardPersonalTodos } from './DashboardPersonalTodos'
import { useAuthStore } from '@/store/authStore'

function fmtValor(v: number | null | undefined, unidad?: string | null): string {
  if (v == null || Number.isNaN(Number(v))) return '—'
  const u = (unidad ?? '').toLowerCase()
  if (u.includes('%')) return `${Number(v).toLocaleString('es-HN', { maximumFractionDigits: 2 })} %`
  if (u.includes('hora')) return `${Number(v).toLocaleString('es-HN', { maximumFractionDigits: 2 })} h`
  if (u.includes('persona')) return String(v)
  return Number(v).toLocaleString('es-HN', { maximumFractionDigits: 2 })
}

function alcanceIcon(tipo: DashboardAlcanceTipo) {
  switch (tipo) {
    case 'global':
      return Globe
    case 'departamentos':
      return Building2
    case 'equipo':
      return UsersRound
    default:
      return User
  }
}

function proyectosCardHint(alcance: DashboardResumen['alcance'] | undefined): string {
  switch (alcance?.tipo) {
    case 'global':
      return 'Todos los proyectos visibles en la organización'
    case 'departamentos':
      return 'Proyectos de tus departamentos, equipo y asignados a ti'
    case 'equipo':
      return 'Tus proyectos y los de tu equipo'
    default:
      return 'Proyectos donde eres propietario o responsable'
  }
}

function capsCardHint(alcance: DashboardResumen['alcance'] | undefined): string {
  switch (alcance?.tipo) {
    case 'global':
      return 'Cursos en progreso en toda la organización'
    case 'departamentos':
      return 'Capacitaciones de tus departamentos y equipo'
    case 'equipo':
      return 'Capacitaciones de tu equipo en curso'
    default:
      return 'Tus capacitaciones en progreso'
  }
}

function normalizeKpis(raw: DashboardResumen['kpis'] | undefined): KpiDoc[] {
  if (!raw?.length) return []
  return raw.map((k) => ({
    ...k,
    _id: typeof k._id === 'string' ? k._id : String((k as { _id: unknown })._id),
  }))
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardResumen | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)

  const reload = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      setData(await fetchDashboardResumen())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const kpis = useMemo(() => normalizeKpis(data?.kpis), [data?.kpis])

  const porMeta = useMemo(() => {
    const m = new Map<MetaEstrategicaId, KpiDoc[]>()
    for (const me of METAS_ESTRATEGICAS) m.set(me.id, [])
    for (const k of kpis) {
      const id = metaEstrategicaDeKpi(k)
      if (!isMetaEstrategicaId(id)) continue
      m.get(id)!.push(k)
    }
    return m
  }, [kpis])

  const faseChartData = useMemo(
    () =>
      (data?.avance_por_fase ?? []).map((a) => ({
        nombre: `Fase ${a.fase}`,
        pct: a.pct,
      })),
    [data?.avance_por_fase],
  )

  const hoy = useMemo(() => formatDateDMY(new Date().toISOString()), [])

  const tareasLista = data?.tareas_proximas ?? []
  const paginationTareas = usePagination(tareasLista.length, {
    resetKey: tareasLista.map((t) => t._id).join('|'),
  })
  const pageTareas = paginationTareas.slice(tareasLista)

  const alcance = data?.alcance
  const AlcanceIcon = alcance ? alcanceIcon(alcance.tipo) : Globe
  const tituloPanel =
    alcance?.tipo === 'global'
      ? 'Dashboard ejecutivo'
      : alcance?.tipo === 'personal'
        ? 'Mi panel de inicio'
        : 'Panel de gestión'

  const metasConDatos = useMemo(
    () => METAS_ESTRATEGICAS.filter((me) => (porMeta.get(me.id) ?? []).length > 0),
    [porMeta],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--navy)]">{tituloPanel}</h2>
            {alcance ? (
              <Badge variant="outline" className="gap-1 border-[var(--navy)]/30 text-[var(--navy)]">
                <AlcanceIcon className="size-3" aria-hidden />
                {alcance.etiqueta}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {alcance?.descripcion ??
              'Resumen según tu rol y departamentos asignados.'}{' '}
            Fecha de referencia: {hoy}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void reload()}
          disabled={loading}
        >
          {loading ? 'Actualizando…' : 'Actualizar'}
        </Button>
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
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Proyectos activos</CardTitle>
                <FolderKanban className="h-4 w-4 text-[var(--navy)]" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-[var(--navy)]">
                  {data.proyectos_activos}
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}
                    / {data.proyectos_total}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{proyectosCardHint(alcance)}</p>
                <Link to="/proyectos" className="mt-2 inline-block text-xs text-[var(--lime)] hover:underline">
                  Ver proyectos
                </Link>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tareas vencidas</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-destructive">{data.tareas_vencidas}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  En el alcance de tus proyectos, con fecha fin anterior a hoy
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">KPI promedio</CardTitle>
                <Gauge className="h-4 w-4 text-[var(--navy)]" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-[var(--navy)]">
                  {Math.round(data.kpi_promedio_pct)} %
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {alcance?.tipo === 'global'
                    ? 'Promedio de todos los KPIs'
                    : 'KPIs de tus departamentos asignados'}
                </p>
                <Link to="/kpis" className="mt-2 inline-block text-xs text-[var(--lime)] hover:underline">
                  Ver KPIs
                </Link>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Capacitaciones</CardTitle>
                <GraduationCap className="h-4 w-4 text-[var(--navy)]" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-[var(--navy)]">
                  {data.capacitaciones_en_progreso}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{capsCardHint(alcance)}</p>
                <Link
                  to={alcance?.tipo === 'personal' ? '/mis-capacitaciones' : '/capacitaciones'}
                  className="mt-2 inline-block text-xs text-[var(--lime)] hover:underline"
                >
                  {alcance?.tipo === 'personal' ? 'Mis capacitaciones' : 'Ver capacitaciones'}
                </Link>
              </CardContent>
            </Card>
          </section>

          {user?._id ? (
            <section>
              <DashboardPersonalTodos userId={user._id} />
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Avance por fase (% promedio en tu alcance)
            </h3>
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={faseChartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `${v} %`}
                      />
                      <Tooltip
                        formatter={(v) => [`${Number(v)} %`, 'Avance']}
                        labelFormatter={(l) => String(l)}
                      />
                      <Bar dataKey="pct" name="Avance %" fill="var(--lime)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tareas próximas a vencer (14 días)
            </h3>
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {data.tareas_proximas.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No hay tareas pendientes en esta ventana.</p>
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarea</TableHead>
                        <TableHead>Proyecto</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead className="w-[110px]">Fin</TableHead>
                        <TableHead className="w-[120px]">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageTareas.map((t) => (
                        <TableRow key={t._id}>
                          <TableCell className="max-w-[200px] font-medium">{t.nombre}</TableCell>
                          <TableCell>
                            <Link
                              to={`/proyectos/${encodeURIComponent(t.proyecto_id)}`}
                              className="text-[var(--lime)] hover:underline"
                            >
                              {t.proyecto_nombre}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{t.responsable || '—'}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatDateDMY(t.fecha_fin)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{t.estado}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <PaginationBar
                    page={paginationTareas.page}
                    totalPages={paginationTareas.totalPages}
                    pageSize={paginationTareas.pageSize}
                    totalItems={paginationTareas.totalItems}
                    fromItem={paginationTareas.fromItem}
                    toItem={paginationTareas.toItem}
                    onPageChange={paginationTareas.setPage}
                    onPageSizeChange={paginationTareas.setPageSize}
                  />
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          {metasConDatos.length > 0 ? (
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Metas estratégicas
                {alcance?.tipo !== 'global' && alcance?.departamentos.length
                  ? ` — ${alcance.departamentos.map((d) => d.codigo).join(', ')}`
                  : ''}
              </h3>
              <Link to="/kpis" className="text-xs text-[var(--lime)] hover:underline">
                Registrar valores en KPIs
              </Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {metasConDatos.map((me) => {
                const list = porMeta.get(me.id) ?? []
                const pct = pctMetaEstrategica(kpis, list.map((k) => k._id))
                return (
                  <Card key={me.id} className="shadow-sm">
                    <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                      <GaugeRing value={pct} size={88} className="shrink-0" />
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-sm leading-tight">{me.titulo}</CardTitle>
                        <p className="text-[11px] text-muted-foreground">{me.objetivo}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 border-t border-border pt-3 text-xs">
                      <p className="font-medium text-muted-foreground">KPIs y último registro</p>
                      <ul className="max-h-36 space-y-1 overflow-y-auto">
                        {list.map((k) => {
                          const ur = ultimoRegistro(k)
                          return (
                            <li key={k._id} className="flex justify-between gap-2 text-muted-foreground">
                              <span className="min-w-0 truncate text-foreground">{k.nombre}</span>
                              <span className="shrink-0 tabular-nums text-[11px]">
                                {ur ? fmtValor(ur.valor ?? null, k.unidad) : 'Sin dato'}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </section>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay KPIs registrados para tu alcance. Configure indicadores en el módulo KPIs.
            </p>
          )}
        </>
      ) : null}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  Building2,
  FolderKanban,
  Gauge,
  GraduationCap,
  Globe,
  RefreshCw,
  User,
  UsersRound,
  Wallet,
} from 'lucide-react'

import { GaugeRing } from '@/components/kpis/GaugeRing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchDashboardResumen } from '@/lib/api/dashboard'
import { formatDateDMY, formatLps } from '@/lib/format'
import { metaEstrategicaDeKpi, type KpiDoc } from '@/types/kpi'
import { pctMetaFromKpiList, pctCumplimientoKpi, ultimoRegistro } from '@/lib/kpiAvance'
import { subscribeKpiDataChanged } from '@/lib/kpiSync'
import { cn } from '@/lib/utils'
import type { MetaEstrategicaDepto } from '@/types/departamento'
import type { DashboardAlcanceTipo, DashboardPortfolio, DashboardResumen } from '@/types/dashboard'
import { useAuthStore } from '@/store/authStore'

import { DashboardCargaEquipo } from './DashboardCargaEquipo'
import { DashboardAdmin } from './DashboardAdmin'
import { DashboardPersonalTodos } from './DashboardPersonalTodos'
import { DashboardRrhh } from './DashboardRrhh'
import { DashboardTareasBoard } from './DashboardTareasBoard'
import {
  AtencionTable,
  BudgetChart,
  InsightsBanner,
  MiniGantt,
  PipelineChart,
  SaludDonut,
  ScheduleScatter,
  ThroughputChart,
  WorkMixChart,
} from './DashboardPmCharts'

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

function normalizeKpis(raw: DashboardResumen['kpis'] | undefined): KpiDoc[] {
  if (!raw?.length) return []
  return raw.map((k) => ({
    ...k,
    _id: typeof k._id === 'string' ? k._id : String((k as { _id: unknown })._id),
  }))
}

function deltaLabel(current: number, previous: number): { text: string; tone: 'up' | 'down' | 'flat' } {
  const d = current - previous
  if (d === 0) return { text: 'igual que la semana previa', tone: 'flat' }
  if (d > 0) return { text: `+${d} vs. semana previa`, tone: 'up' }
  return { text: `${d} vs. semana previa`, tone: 'down' }
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'navy',
  href,
  hrefLabel,
}: {
  label: string
  value: string
  hint: string
  icon: typeof FolderKanban
  tone?: 'navy' | 'ok' | 'warn' | 'danger'
  href?: string
  hrefLabel?: string
}) {
  const valueClass =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'ok'
          ? 'text-[var(--lime)]'
          : 'text-[var(--navy)]'
  return (
    <Card className="gap-3 py-4 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-0">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className={cn(
            'h-4 w-4',
            tone === 'danger' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600' : 'text-[var(--navy)]',
          )}
          aria-hidden
        />
      </CardHeader>
      <CardContent className="px-5">
        <p className={cn('text-2xl font-semibold tabular-nums leading-none', valueClass)}>{value}</p>
        <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>
        {href && hrefLabel ? (
          <Link to={href} className="mt-2 inline-block text-xs font-medium text-[var(--navy)] hover:underline">
            {hrefLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardResumen | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const paneles = useMemo(() => {
    const out: Array<'proyectos' | 'rrhh' | 'admin'> = []
    if (hasPermiso('proyectos:ver') || hasPermiso('kpis:ver')) out.push('proyectos')
    if (hasPermiso('equipo:ver') || hasPermiso('empleados:ver') || hasPermiso('capacitaciones:ver')) out.push('rrhh')
    if (hasPermiso('usuarios:ver') || hasPermiso('roles:ver')) out.push('admin')
    if (out.length === 0) out.push('proyectos')
    return out
  }, [hasPermiso])
  const [panel, setPanel] = useState<'proyectos' | 'rrhh' | 'admin'>(paneles[0] ?? 'proyectos')

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

  useEffect(() => subscribeKpiDataChanged(() => void reload()), [reload])

  const kpis = useMemo(() => normalizeKpis(data?.kpis), [data?.kpis])

  const metasDepartamento = useMemo((): MetaEstrategicaDepto[] => {
    return data?.metas_estrategicas?.filter((m) => m.activa !== false) ?? []
  }, [data?.metas_estrategicas])

  const porMeta = useMemo(() => {
    const m = new Map<string, KpiDoc[]>()
    for (const me of metasDepartamento) m.set(me.id, [])
    for (const k of kpis) {
      const id = metaEstrategicaDeKpi(k)
      if (id === 'sin_meta') continue
      if (!m.has(id)) m.set(id, [])
      m.get(id)!.push(k)
    }
    return m
  }, [kpis, metasDepartamento])

  const hoy = useMemo(() => formatDateDMY(new Date().toISOString()), [])

  const alcance = data?.alcance
  const AlcanceIcon = alcance ? alcanceIcon(alcance.tipo) : Globe
  const tituloPanel =
    alcance?.tipo === 'global'
      ? 'Dashboard ejecutivo'
      : alcance?.tipo === 'personal'
        ? 'Mi panel de inicio'
        : 'Panel de gestión'

  const metasConDatos = useMemo(() => {
    const conKpis = metasDepartamento.filter((me) => (porMeta.get(me.id) ?? []).length > 0)
    if (conKpis.length) return conKpis
    return metasDepartamento
  }, [metasDepartamento, porMeta])

  const pf: DashboardPortfolio | undefined = data?.portfolio
  const throughputDelta = pf ? deltaLabel(pf.tareas.esta_semana, pf.tareas.semana_anterior) : null
  const saludTone =
    !pf ? 'navy' : pf.salud.critico > 0 ? 'danger' : pf.salud.en_riesgo > 0 ? 'warn' : 'ok'
  const calGap =
    pf && pf.avance_esperado != null ? pf.avance_promedio - pf.avance_esperado : null

  const tabs = paneles.length > 1 ? (
    <div className="flex flex-wrap gap-1">
      {paneles.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => setPanel(id)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium',
            panel === id ? 'bg-[var(--navy)] text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          {id === 'proyectos' ? 'Proyectos' : id === 'rrhh' ? 'RRHH' : 'Admin'}
        </button>
      ))}
    </div>
  ) : null

  if (panel === 'rrhh') {
    return <div className="space-y-4">{tabs}<DashboardRrhh /></div>
  }
  if (panel === 'admin') {
    return <div className="space-y-4">{tabs}<DashboardAdmin /></div>
  }

  return (
    <div className="space-y-6">
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
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Portafolio, riesgo, calendario y presupuesto para decidir qué mover hoy.{' '}
            Corte: {hoy}.
          </p>
          {tabs ? <div className="mt-3">{tabs}</div> : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 size-3.5', loading && 'animate-spin')} />
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : data ? (
        <>
          {pf?.insights?.length ? <InsightsBanner insights={pf.insights} /> : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <KpiTile
              label="Salud del portafolio"
              value={pf ? `${pf.salud.pct_en_curso}%` : '—'}
              hint={
                pf
                  ? `${pf.salud.en_curso} en curso · ${pf.salud.en_riesgo + pf.salud.critico} en alerta`
                  : 'Sin datos de riesgo'
              }
              icon={Activity}
              tone={saludTone}
              href="/proyectos"
              hrefLabel="Ver proyectos"
            />
            <KpiTile
              label="Proyectos activos"
              value={`${data.proyectos_activos} / ${data.proyectos_total}`}
              hint={
                pf
                  ? `${pf.salud.atrasados} atrasados · ${pf.salud.bloqueados} bloqueados`
                  : 'En el alcance de tu rol'
              }
              icon={FolderKanban}
            />
            <KpiTile
              label="Avance vs. calendario"
              value={pf ? `${pf.avance_promedio}%` : '—'}
              hint={
                calGap == null
                  ? 'Faltan fechas para estimar el esperado'
                  : calGap >= 0
                    ? `${calGap} pts por delante del tiempo transcurrido`
                    : `${Math.abs(calGap)} pts detrás del tiempo transcurrido`
              }
              icon={Gauge}
              tone={calGap != null && calGap < -10 ? 'warn' : 'navy'}
            />
            <KpiTile
              label="Trabajo vencido"
              value={String(data.tareas_vencidas)}
              hint={
                pf
                  ? `${pf.tareas.bloqueadas} bloqueadas · ${pf.tareas.en_progreso} en progreso`
                  : 'Tareas con fecha fin anterior a hoy'
              }
              icon={AlertTriangle}
              tone={data.tareas_vencidas > 0 ? 'danger' : 'ok'}
            />
            <KpiTile
              label="Presupuesto ejecutado"
              value={
                pf?.presupuesto.burn_pct != null
                  ? `${pf.presupuesto.burn_pct}%`
                  : pf
                    ? formatLps(pf.presupuesto.ejecutado)
                    : '—'
              }
              hint={
                pf
                  ? `${formatLps(pf.presupuesto.ejecutado)} de ${formatLps(pf.presupuesto.planificado)} planificado`
                  : 'Sin montos cargados'
              }
              icon={Wallet}
              tone={
                pf &&
                pf.presupuesto.burn_pct != null &&
                pf.presupuesto.burn_pct - pf.avance_promedio >= 15
                  ? 'warn'
                  : 'navy'
              }
            />
            <KpiTile
              label="Throughput semanal"
              value={pf ? String(pf.tareas.esta_semana) : '—'}
              hint={
                [
                  throughputDelta ? `Completadas esta semana · ${throughputDelta.text}` : 'Tareas cerradas esta semana',
                  data.capacitaciones_en_progreso
                    ? `${data.capacitaciones_en_progreso} capacitación${data.capacitaciones_en_progreso === 1 ? '' : 'es'} en curso`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              }
              icon={GraduationCap}
              tone={throughputDelta?.tone === 'down' ? 'warn' : 'navy'}
            />
          </section>

          {pf ? (
            <>
              <section className="grid gap-4 xl:grid-cols-2">
                <SaludDonut portfolio={pf} />
                <PipelineChart portfolio={pf} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <ScheduleScatter portfolio={pf} />
                <BudgetChart portfolio={pf} />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <ThroughputChart portfolio={pf} />
                <WorkMixChart portfolio={pf} />
              </section>

              <DashboardCargaEquipo portfolio={pf} />

              <MiniGantt portfolio={pf} />

              <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <AtencionTable portfolio={pf} />
                <div className="space-y-3">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Hitos de los próximos 14 días
                  </h3>
                  <DashboardTareasBoard tareas={data.tareas_proximas} />
                </div>
              </section>
            </>
          ) : (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Tareas próximas a vencer (14 días)
              </h3>
              <DashboardTareasBoard tareas={data.tareas_proximas} />
            </section>
          )}

          {metasConDatos.length > 0 ? (
            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Metas estratégicas
                  {alcance?.tipo !== 'global' && alcance?.departamentos.length
                    ? ` — ${alcance.departamentos.map((d) => d.codigo).join(', ')}`
                    : ''}
                </h3>
                <Link to="/kpis" className="text-xs font-medium text-[var(--navy)] hover:underline">
                  Registrar valores
                </Link>
              </div>
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {metasConDatos.map((me) => {
                  const list = porMeta.get(me.id) ?? []
                  const pct = pctMetaFromKpiList(list, me)
                  return (
                    <Card key={me.id} className="gap-3 py-4 shadow-sm">
                      <CardHeader className="flex flex-row items-start gap-3 space-y-0 px-5 pb-0">
                        <GaugeRing value={pct} size={72} className="shrink-0" />
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="text-sm leading-tight">{me.titulo}</CardTitle>
                          <p className="text-[11px] text-muted-foreground">{me.objetivo}</p>
                          {me.valor_objetivo ? (
                            <p className="text-[11px] font-medium text-[var(--navy)]">Meta: {me.valor_objetivo}</p>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 border-t border-border px-5 pt-3 text-xs">
                        <p className="font-medium text-muted-foreground">
                          KPIs ({list.length}) · cumplimiento
                        </p>
                        <ul className="max-h-32 space-y-1 overflow-y-auto">
                          {list.length === 0 && (
                            <li className="text-muted-foreground">Sin KPIs vinculados a esta meta.</li>
                          )}
                          {list.map((k) => {
                            const ur = ultimoRegistro(k)
                            const kpiPct = pctCumplimientoKpi(k)
                            return (
                              <li key={k._id} className="flex justify-between gap-2 text-muted-foreground">
                                <span className="min-w-0 truncate text-foreground">{k.nombre}</span>
                                <span className="shrink-0 text-right text-[11px] tabular-nums">
                                  <span className="font-medium text-[var(--navy)]">{kpiPct}%</span>
                                  {ur ? (
                                    <span className="block text-muted-foreground">
                                      {fmtValor(ur.valor ?? null, k.unidad)}
                                    </span>
                                  ) : (
                                    <span className="block">Sin dato</span>
                                  )}
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
          ) : null}

          {user?._id ? (
            <section>
              <DashboardPersonalTodos userId={user._id} />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

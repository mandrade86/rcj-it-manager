import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateDMY, formatLps } from '@/lib/format'
import type { DashboardPortfolio } from '@/types/dashboard'

export const C = {
  navy: '#002060',
  lime: '#70AD47',
  red: '#C00000',
  amber: '#F59E0B',
  gray: '#6B7280',
  blue: '#3B82F6',
  violet: '#4527A0',
  slate: '#94A3B8',
} as const

const ESTADO_COLOR: Record<string, string> = {
  Idea: C.slate,
  Planificado: '#64748B',
  'En revisión': C.violet,
  Aprobado: C.blue,
  'En progreso': C.navy,
  Bloqueado: C.red,
  'En pausa': C.amber,
  Completado: C.lime,
  Cancelado: '#9CA3AF',
}

function ChartTip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>
  label?: string
  formatValue?: (value: number, name: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs shadow-lg">
      {label ? <p className="mb-1 font-semibold text-[var(--navy)]">{label}</p> : null}
      {payload.map((p) => {
        const name = String(p.name ?? '')
        const value = Number(p.value ?? 0)
        return (
          <p key={name} className="flex justify-between gap-6">
            <span style={{ color: p.color }}>{name}</span>
            <span className="tabular-nums font-medium">
              {formatValue ? formatValue(value, name) : value.toLocaleString('es-HN')}
            </span>
          </p>
        )
      })}
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-center text-xs text-muted-foreground">
      {text}
    </div>
  )
}

export function SaludDonut({ portfolio }: { portfolio: DashboardPortfolio }) {
  const { salud } = portfolio
  const data = [
    { name: 'En curso', value: salud.en_curso, color: C.lime },
    { name: 'En riesgo', value: salud.en_riesgo, color: C.amber },
    { name: 'Crítico', value: salud.critico, color: C.red },
    { name: 'Sin fecha', value: salud.sin_fecha, color: C.gray },
  ].filter((d) => d.value > 0)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Salud del portafolio</CardTitle>
        <p className="text-xs text-muted-foreground">
          Riesgo automático por calendario, avance y bloqueos — solo proyectos en marcha
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart text="No hay proyectos en marcha en tu alcance." />
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-[220px] min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={78} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="value" name="Proyectos" radius={[0, 4, 4, 0]} barSize={18}>
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-36 shrink-0 space-y-2 text-xs">
              {data.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="tabular-nums font-semibold text-[var(--navy)]">{d.value}</span>
                </li>
              ))}
              <li className="border-t pt-2 text-muted-foreground">
                Completados:{' '}
                <span className="font-medium text-foreground">{salud.completados}</span>
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PipelineChart({ portfolio }: { portfolio: DashboardPortfolio }) {
  const data = portfolio.por_estado
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Pipeline por estado</CardTitle>
        <p className="text-xs text-muted-foreground">Dónde está el trabajo en el flujo del proyecto</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart text="Sin proyectos para armar el pipeline." />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="estado" width={96} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Proyectos" radius={[0, 4, 4, 0]} barSize={16}>
                  {data.map((d) => (
                    <Cell key={d.estado} fill={ESTADO_COLOR[d.estado] ?? C.navy} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ScheduleScatter({ portfolio }: { portfolio: DashboardPortfolio }) {
  const data = portfolio.schedule
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Calendario vs. avance</CardTitle>
        <p className="text-xs text-muted-foreground">
          Por encima de la diagonal: adelantado. Por debajo: retraso de ejecución
        </p>
      </CardHeader>
      <CardContent>
        {data.length < 1 ? (
          <EmptyChart text="Faltan fechas de inicio/fin para comparar contra el calendario." />
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  dataKey="tiempo"
                  name="% tiempo"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  label={{ value: '% tiempo transcurrido', position: 'insideBottom', offset: -2, fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="avance"
                  name="% avance"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  label={{ value: '% avance', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                  ]}
                  stroke={C.slate}
                  strokeDasharray="4 4"
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const row = payload[0].payload as DashboardPortfolio['schedule'][number]
                    return (
                      <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-[var(--navy)]">{row.nombre}</p>
                        <p>Tiempo: {row.tiempo}%</p>
                        <p>Avance: {row.avance}%</p>
                        <p>Brecha: {row.avance - row.tiempo} pts</p>
                      </div>
                    )
                  }}
                />
                <Scatter data={data} name="Proyectos">
                  {data.map((d) => (
                    <Cell
                      key={d._id}
                      fill={d.nivel === 'Alto' ? C.red : d.nivel === 'Medio' ? C.amber : C.lime}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BudgetChart({ portfolio }: { portfolio: DashboardPortfolio }) {
  const b = portfolio.presupuesto
  const data = [
    { nombre: 'Planificado', valor: b.planificado, color: C.navy },
    { nombre: 'Asignado a tareas', valor: b.asignado, color: C.blue },
    { nombre: 'Ejecutado', valor: b.ejecutado, color: C.lime },
  ]
  const has = data.some((d) => d.valor > 0)
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Presupuesto del portafolio</CardTitle>
        <p className="text-xs text-muted-foreground">
          Plan vs. asignado en tareas vs. ejecutado
          {b.burn_pct != null ? ` · burn ${b.burn_pct}%` : ''}
        </p>
      </CardHeader>
      <CardContent>
        {!has ? (
          <EmptyChart text="Ningún proyecto tiene montos de presupuesto cargados." />
        ) : (
          <>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip content={<ChartTip formatValue={(v) => formatLps(v)} />} />
                  <Bar dataKey="valor" name="Monto" radius={[4, 4, 0, 0]} barSize={42}>
                    {data.map((d) => (
                      <Cell key={d.nombre} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                Proyectos con envelope:{' '}
                <strong className="text-foreground">{b.proyectos_con_presupuesto}</strong>
              </span>
              {b.sobrecosto > 0 ? (
                <span className="text-destructive">
                  Sobrecosto: <strong>{formatLps(b.sobrecosto)}</strong>
                </span>
              ) : (
                <span>Sin sobrecosto vs. planificado</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function ThroughputChart({ portfolio }: { portfolio: DashboardPortfolio }) {
  const data = portfolio.tareas.throughput
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Flujo de trabajo (8 semanas)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Entrada (tareas creadas) vs. salida (completadas). Si la entrada supera la salida, el backlog crece.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="thIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="thOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.lime} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.lime} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="creadas"
                name="Creadas"
                stroke={C.blue}
                fill="url(#thIn)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="completadas"
                name="Completadas"
                stroke={C.lime}
                fill="url(#thOut)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function WorkMixChart({ portfolio }: { portfolio: DashboardPortfolio }) {
  const t = portfolio.tareas
  const estados = [
    { name: 'Pendiente', value: t.pendientes, color: C.slate },
    { name: 'En progreso', value: t.en_progreso, color: C.amber },
    { name: 'Bloqueada', value: t.bloqueadas, color: C.red },
    { name: 'Completada', value: t.completadas, color: C.lime },
  ]
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Carga de trabajo</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t.total} tareas · {t.pct_completadas}% cerradas
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={estados} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="value" name="Tareas" radius={[4, 4, 0, 0]} barSize={28}>
                {estados.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function clipPct(n: number) {
  return Math.max(0, Math.min(100, n))
}

export function MiniGantt({ portfolio }: { portfolio: DashboardPortfolio }) {
  const winA = new Date(portfolio.ventana_gantt.inicio).getTime()
  const winB = new Date(portfolio.ventana_gantt.fin).getTime()
  const span = Math.max(1, winB - winA)
  const today = Date.now()
  const todayLeft = clipPct(((today - winA) / span) * 100)
  const rows = portfolio.timeline

  const ticks: { label: string; left: number }[] = []
  const step = 14 * 24 * 60 * 60 * 1000
  for (let t = winA; t <= winB; t += step) {
    ticks.push({
      label: formatDateDMY(new Date(t).toISOString()),
      left: clipPct(((t - winA) / span) * 100),
    })
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Línea de tiempo (4 semanas atrás · 8 adelante)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Color = riesgo. La línea vertical marca hoy. Clic abre el proyecto.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyChart text="No hay proyectos en marcha con fechas para el Gantt." />
        ) : (
          <div className="overflow-x-auto">
            <div className="relative min-w-[720px]">
              <div className="relative mb-2 h-5 border-b text-[10px] text-muted-foreground">
                {ticks.map((tk) => (
                  <span
                    key={tk.label}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${tk.left}%` }}
                  >
                    {tk.label}
                  </span>
                ))}
              </div>
              <div className="relative space-y-1.5">
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-[var(--navy)]"
                  style={{ left: `${todayLeft}%` }}
                  title="Hoy"
                />
                {rows.map((p) => {
                  const start = p.fecha_inicio ? new Date(p.fecha_inicio).getTime() : winA
                  const end = p.fecha_fin ? new Date(p.fecha_fin).getTime() : today
                  const left = clipPct(((Math.min(start, end) - winA) / span) * 100)
                  const right = clipPct(((Math.max(start, end) - winA) / span) * 100)
                  const width = Math.max(1.4, right - left)
                  return (
                    <div key={p._id} className="grid grid-cols-[200px_1fr] items-center gap-3">
                      <Link
                        to={`/proyectos/${encodeURIComponent(p._id)}`}
                        className="truncate text-xs font-medium text-[var(--navy)] hover:underline"
                        title={p.nombre}
                      >
                        {p.nombre}
                      </Link>
                      <div className="relative h-7 rounded-md bg-[#F1F3F5]">
                        <Link
                          to={`/proyectos/${encodeURIComponent(p._id)}`}
                          className="absolute top-1 bottom-1 rounded-sm opacity-90 hover:opacity-100"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: p.color,
                          }}
                          title={`${p.nombre} · ${p.porcentaje_avance}% · ${p.estado}`}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] tabular-nums text-muted-foreground">
                          {p.porcentaje_avance}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AtencionTable({ portfolio }: { portfolio: DashboardPortfolio }) {
  const rows = portfolio.atencion
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[var(--navy)]">Proyectos que requieren atención</CardTitle>
        <p className="text-xs text-muted-foreground">
          Prioriza estos primero: atraso, bloqueo o gap vs. el calendario
        </p>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Ningún proyecto activo está en riesgo medio o alto.
          </p>
        ) : (
          <div className="max-h-[360px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="px-6 py-2 font-medium">Proyecto</th>
                  <th className="px-3 py-2 font-medium">Riesgo</th>
                  <th className="px-3 py-2 font-medium">Avance</th>
                  <th className="px-3 py-2 font-medium">Fin</th>
                  <th className="px-3 py-2 font-medium">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-b last:border-0">
                    <td className="px-6 py-2.5">
                      <Link
                        to={`/proyectos/${encodeURIComponent(r._id)}`}
                        className="font-medium text-[var(--navy)] hover:underline"
                      >
                        {r.nombre}
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{r.motivo}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ borderColor: r.color, color: r.color }}
                      >
                        {r.nivel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${r.porcentaje_avance}%`, background: r.color }}
                          />
                        </span>
                        <span className="tabular-nums">{r.porcentaje_avance}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {formatDateDMY(r.fecha_fin)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.responsable || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function InsightsBanner({ insights }: { insights: string[] }) {
  if (!insights.length) return null
  return (
    <div className="rounded-xl border border-[var(--navy)]/15 bg-[var(--blue-lt)]/60 px-4 py-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--navy)]">
        Lectura para el product manager
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
  )
}

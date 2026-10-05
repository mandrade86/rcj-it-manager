import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, GraduationCap, Route, UsersRound } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateDMY } from '@/lib/format'
import { MESES, nombreMes } from '@/lib/meses'
import { planCarreraTipoLabel } from '@/lib/planCarreraLabels'
import { cn } from '@/lib/utils'

type PlanFila = {
  colaborador_id: string
  nombre: string
  puesto: string
  tipo: string
  mes_evaluacion: number | null
  items_total: number
  items_completados: number
  avance_pct: number
}

type EvalFila = {
  colaborador_id: string
  nombre: string
  puesto: string
  tipo: string
  tiene_evaluacion: boolean
  fecha: string | null
  resultado: string | null
}

type Rrhh = {
  mes: number
  anio: number
  empleados_activos: number
  empleados_inactivos: number
  capacitaciones_en_progreso: number
  evaluaciones_sin_firma: number
  planes_total: number
  planes_sin_mes: number
  evaluaciones_pendientes_mes: number
  planes: PlanFila[]
  evaluaciones_mes: EvalFila[]
}

export function DashboardRrhh() {
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [data, setData] = useState<Rrhh | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void fetch(`/api/dashboard/paneles?mes=${mes}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el panel de empleados')
        return res.json() as Promise<{ rrhh?: Rrhh }>
      })
      .then((j) => { if (!cancel) setData(j.rrhh ?? null) })
      .catch((e) => { if (!cancel) setErr(e instanceof Error ? e.message : 'Error') })
    return () => { cancel = true }
  }, [mes])

  if (err) return <p className="text-sm text-destructive">{err}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Cargando panel de empleados…</p>

  const planes = data.planes ?? []
  const evaluacionesMes = data.evaluaciones_mes ?? []

  const tiles = [
    { label: 'Empleados activos', value: data.empleados_activos, hint: `${data.empleados_inactivos} inactivos`, href: '/maestros/empleados', icon: UsersRound },
    { label: 'Planes de carrera', value: data.planes_total ?? planes.length, hint: data.planes_sin_mes ? `${data.planes_sin_mes} sin mes de evaluación` : 'Todos tienen mes de evaluación', href: '/equipo', icon: Route },
    { label: `Evaluaciones de ${nombreMes(data.mes ?? mes)}`, value: data.evaluaciones_pendientes_mes ?? evaluacionesMes.filter((e) => !e.tiene_evaluacion).length, hint: 'Pendientes según el mes del plan', href: '/equipo', icon: ClipboardCheck },
    { label: 'Capacitaciones en curso', value: data.capacitaciones_en_progreso, hint: 'Planes que siguen abiertos', href: '/capacitaciones', icon: GraduationCap },
    { label: 'Evaluaciones sin firma', value: data.evaluaciones_sin_firma, hint: 'Falta colaborador, jefe o RRHH', href: '/equipo', icon: ClipboardCheck },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Dashboard de empleados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Planes de carrera y evaluaciones del mes que tiene cada plan. {data.anio ?? new Date().getFullYear()}.
          </p>
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Mes
          <select
            className="h-9 rounded-md border bg-white px-2 text-sm text-[var(--navy)]"
            value={mes}
            onChange={(e) => setMes(Number(e.target.value))}
          >
            {MESES.map((nombre, i) => (
              <option key={nombre} value={i + 1}>{nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</CardTitle>
              <t.icon className="size-4 text-[var(--navy)]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-[var(--navy)]">{t.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
              <Link to={t.href} className="mt-2 inline-block text-xs font-medium text-[var(--navy)] hover:underline">Abrir</Link>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[var(--navy)]">
            Evaluaciones de {nombreMes(data.mes ?? mes)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Solo quienes tienen este mes en su plan de carrera. Cuenta la evaluación por rúbrica o por KPI registrada en {nombreMes(data.mes ?? mes)} {data.anio ?? new Date().getFullYear()}.
          </p>
        </CardHeader>
        <CardContent>
          {evaluacionesMes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ningún plan tiene la evaluación en {nombreMes(data.mes ?? mes)}.
            </p>
          ) : (
            <ul className="divide-y">
              {evaluacionesMes.map((row) => (
                <li key={row.colaborador_id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/equipo/${row.colaborador_id}`} className="text-sm font-medium text-[var(--navy)] hover:underline">
                      {row.nombre}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.puesto} · {planCarreraTipoLabel(row.tipo)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                      row.tiene_evaluacion
                        ? 'bg-[var(--lime-lt)] text-[var(--navy)]'
                        : 'bg-red-50 text-[#c00000]',
                    )}
                  >
                    {row.tiene_evaluacion ? 'Registrada' : 'Pendiente'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.tiene_evaluacion
                      ? `${row.resultado ?? 'Registrada'}${row.fecha ? ` · ${formatDateDMY(row.fecha)}` : ''}`
                      : 'Sin evaluación este mes'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[var(--navy)]">Planes de carrera</CardTitle>
          <p className="text-xs text-muted-foreground">Avance del checklist y mes en que corresponde evaluar.</p>
        </CardHeader>
        <CardContent>
          {planes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay planes de carrera asignados.</p>
          ) : (
            <ul className="divide-y">
              {planes.map((row) => (
                <li key={row.colaborador_id} className="grid gap-2 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_120px_minmax(0,1fr)] sm:items-center">
                  <div className="min-w-0">
                    <Link to={`/equipo/${row.colaborador_id}`} className="text-sm font-medium text-[var(--navy)] hover:underline">
                      {row.nombre}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.puesto} · {planCarreraTipoLabel(row.tipo)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{nombreMes(row.mes_evaluacion)}</span>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{row.items_completados}/{row.items_total}</span>
                      <span>{row.avance_pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[var(--lime)]" style={{ width: `${row.avance_pct}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

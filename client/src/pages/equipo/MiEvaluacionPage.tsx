import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, Target, User } from 'lucide-react'

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
import { fetchMiColaborador } from '@/lib/api/colaboradores'
import { fetchEvaluaciones } from '@/lib/api/evaluaciones'
import { fetchEvaluacionesKpiPorColaborador } from '@/lib/api/evaluacionesKpi'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Colaborador } from '@/types/colaborador'
import type { EvaluacionDoc } from '@/types/evaluacion'
import type { EvaluacionKpiDoc } from '@/types/evaluacionKpi'

function resultadoBadge(r?: string | null) {
  if (!r) return null
  const cls =
    r === 'Supera'
      ? 'bg-primary/10 text-primary border-primary/30'
      : r === 'Cumple'
        ? 'bg-[var(--lime-lt)] text-[var(--navy)] border-[var(--lime)]/50'
        : r === 'En desarrollo' || r === 'Parcial'
          ? 'bg-amber-500/10 text-amber-900 border-amber-500/40'
          : 'bg-destructive/15 text-destructive border-destructive/30'
  return (
    <Badge variant="outline" className={cn('border', cls)}>
      {r}
    </Badge>
  )
}

function tipoBadge(tipo: 'autoevaluacion' | 'jefe') {
  return tipo === 'autoevaluacion' ? (
    <Badge variant="secondary" className="gap-1 bg-[var(--blue-lt)] text-[var(--navy)]">
      <User className="size-3" />
      Autoevaluación
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-900">
      Evaluación del jefe
    </Badge>
  )
}

export function MiEvaluacionPage() {
  const [colab, setColab] = useState<Colaborador | null>(null)
  const [evalsRubrica, setEvalsRubrica] = useState<EvaluacionDoc[]>([])
  const [evalsKpi, setEvalsKpi] = useState<EvaluacionKpiDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const me = await fetchMiColaborador()
        if (cancel) return
        setColab(me)
        const [rubs, kpis] = await Promise.all([
          fetchEvaluaciones(me._id).catch(() => [] as EvaluacionDoc[]),
          fetchEvaluacionesKpiPorColaborador(me._id).catch(() => [] as EvaluacionKpiDoc[]),
        ])
        if (cancel) return
        setEvalsRubrica(rubs)
        setEvalsKpi(kpis)
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando tu información…</p>
  }

  if (err || !colab) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-5 text-[var(--navy)]" />
              Mi desempeño
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {err ?? 'No pudimos cargar tu información.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Si recién te dieron acceso, pide al administrador que vincule tu usuario a tu
              registro de empleado.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const ultimaAutoRub = evalsRubrica.find((e) => e.tipo === 'autoevaluacion')
  const ultimaJefeRub = evalsRubrica.find((e) => e.tipo === 'jefe')
  const ultimaAutoKpi = evalsKpi.find((e) => e.tipo === 'autoevaluacion')
  const ultimaJefeKpi = evalsKpi.find((e) => e.tipo === 'jefe')

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <User className="size-6 text-[var(--navy)]" />
            Mi desempeño
          </h1>
          <p className="text-sm text-muted-foreground">
            Hola <strong>{colab.nombre}</strong> — Aquí puedes ver tus evaluaciones y registrar
            tu autoevaluación. Las hace tu jefe y tú mismo de manera independiente.
          </p>
        </div>
      </header>

      {/* CTA principales */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-[var(--lime)]/40 bg-[var(--lime-lt)]/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-[var(--navy)]">
              <ClipboardList className="size-5" />
              Autoevaluación por rúbrica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Evalúa tu desempeño en cada criterio según tu perfil. Es fácil: responde con
              <span className="mx-1 font-semibold">No cumple / En desarrollo / Cumple / Supera</span>
              y comenta lo que consideres importante.
            </p>
            <Button
              asChild
              className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            >
              <Link to={`/equipo/${colab._id}/evaluaciones/nueva?modo=auto`}>
                {ultimaAutoRub ? 'Nueva autoevaluación' : 'Comenzar mi autoevaluación'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[var(--navy)]/30 bg-[var(--blue-lt)]/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-[var(--navy)]">
              <Target className="size-5" />
              Autoevaluación por KPIs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Indica tu cumplimiento por cada KPI definido para tu puesto. Te mostramos
              el último valor registrado para que tengas referencia.
            </p>
            <Button
              asChild
              variant="outline"
              className="gap-2 border-[var(--navy)]/40 text-[var(--navy)] hover:bg-[var(--navy)] hover:text-white"
            >
              <Link to={`/equipo/${colab._id}/evaluaciones-kpi/nueva?modo=auto`}>
                {ultimaAutoKpi ? 'Nueva autoevaluación KPI' : 'Comenzar mi autoevaluación KPI'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Comparativa rápida */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Última comparativa</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidad</TableHead>
                <TableHead>Mi autoevaluación</TableHead>
                <TableHead>Evaluación del jefe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Rúbrica</TableCell>
                <TableCell>
                  {ultimaAutoRub ? (
                    <div className="space-y-0.5">
                      {resultadoBadge(ultimaAutoRub.resultado_global)}
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateDMY(ultimaAutoRub.fecha)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pendiente</span>
                  )}
                </TableCell>
                <TableCell>
                  {ultimaJefeRub ? (
                    <div className="space-y-0.5">
                      {resultadoBadge(ultimaJefeRub.resultado_global)}
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateDMY(ultimaJefeRub.fecha)} ·{' '}
                        {ultimaJefeRub.decision ?? 'Sin decisión'}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Tu jefe no la ha hecho aún</span>
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">KPI</TableCell>
                <TableCell>
                  {ultimaAutoKpi ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        {resultadoBadge(ultimaAutoKpi.nivel_cumplimiento)}
                        <span className="text-sm tabular-nums">
                          {ultimaAutoKpi.score_global.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateDMY(ultimaAutoKpi.fecha)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Pendiente</span>
                  )}
                </TableCell>
                <TableCell>
                  {ultimaJefeKpi ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        {resultadoBadge(ultimaJefeKpi.nivel_cumplimiento)}
                        <span className="text-sm tabular-nums">
                          {ultimaJefeKpi.score_global.toFixed(1)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateDMY(ultimaJefeKpi.fecha)} · {ultimaJefeKpi.decision}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Tu jefe no la ha hecho aún</span>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Historial — rúbrica ({evalsRubrica.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evalsRubrica.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay evaluaciones por rúbrica. Empieza con tu autoevaluación arriba.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Decisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evalsRubrica.map((ev) => {
                  const esMia = ev.tipo === 'autoevaluacion'
                  return (
                    <TableRow key={ev._id}>
                      <TableCell>{formatDateDMY(ev.fecha)}</TableCell>
                      <TableCell>{tipoBadge(ev.tipo)}</TableCell>
                      <TableCell>{resultadoBadge(ev.resultado_global)}</TableCell>
                      <TableCell className="text-sm">{ev.decision ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        {esMia ? (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/equipo/${colab._id}/evaluaciones/${ev._id}?modo=auto`}>
                              Editar
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/equipo/${colab._id}/evaluaciones/${ev._id}`}>
                              Ver
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial — KPI ({evalsKpi.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {evalsKpi.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay evaluaciones por KPI. Empieza con tu autoevaluación arriba.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Decisión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evalsKpi.map((ev) => {
                  const esMia = ev.tipo === 'autoevaluacion'
                  return (
                    <TableRow key={ev._id}>
                      <TableCell>{formatDateDMY(ev.fecha)}</TableCell>
                      <TableCell>{tipoBadge(ev.tipo)}</TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {ev.score_global.toFixed(1)}
                      </TableCell>
                      <TableCell>{resultadoBadge(ev.nivel_cumplimiento)}</TableCell>
                      <TableCell className="text-sm">{ev.decision}</TableCell>
                      <TableCell className="text-right">
                        {esMia ? (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/equipo/${colab._id}/evaluaciones-kpi/${ev._id}?modo=auto`}>
                              Editar
                            </Link>
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/equipo/${colab._id}/evaluaciones-kpi/${ev._id}`}>
                              Ver
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

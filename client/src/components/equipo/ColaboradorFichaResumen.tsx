import { AlertCircle, CheckCircle2, ClipboardList, GraduationCap, Target } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlanCarreraDoc } from '@/lib/api/planCarrera'
import { formatDateDMY } from '@/lib/format'
import { planCarreraTipoLabel } from '@/lib/planCarreraLabels'
import type { Colaborador } from '@/types/colaborador'
import { perfilFromColaborador } from '@/types/colaborador'
import type { EvaluacionDoc } from '@/types/evaluacion'
import type { EvaluacionKpiDoc } from '@/types/evaluacionKpi'

type Props = {
  colaborador: Colaborador
  planDoc: PlanCarreraDoc | null
  planLoading: boolean
  evaluaciones: EvaluacionDoc[]
  evaluacionesKpi: EvaluacionKpiDoc[]
  evalLoading: boolean
  capTotal: number
  capDone: number
  capPct: number
  capLoading: boolean
}

function resultadoTone(r?: string | null): string {
  if (r === 'Supera' || r === 'Cumple') return 'bg-[var(--lime-lt)] text-[var(--navy)] border-[var(--lime)]/50'
  if (r === 'En desarrollo' || r === 'Parcial') return 'bg-amber-500/10 text-amber-900 border-amber-500/40'
  if (r === 'No cumple') return 'bg-destructive/15 text-destructive border-destructive/30'
  return ''
}

function buildResumenEjecutivo(input: {
  planDoc: PlanCarreraDoc | null
  planPct: number
  indPendientes: number
  lastEval: EvaluacionDoc | undefined
  lastEvalKpi: EvaluacionKpiDoc | undefined
  tienePerfil: boolean
}): { texto: string; tono: 'ok' | 'warn' | 'neutral' } {
  const { planDoc, planPct, indPendientes, lastEval, lastEvalKpi, tienePerfil } = input

  if (!tienePerfil) {
    return {
      texto: 'Asigna un perfil de puesto (descriptor RH) para habilitar evaluaciones por rúbrica y KPI.',
      tono: 'warn',
    }
  }
  if (!planDoc) {
    return {
      texto: 'Sin plan de carrera asignado. Define la ruta de desarrollo desde una plantilla en la pestaña Plan de carrera.',
      tono: 'warn',
    }
  }
  if (!lastEval && !lastEvalKpi) {
    return {
      texto: 'Tiene perfil y plan, pero aún no hay evaluaciones registradas. Conviene una evaluación inicial de línea base.',
      tono: 'warn',
    }
  }

  const evalOk =
    lastEval?.resultado_global === 'Cumple' ||
    lastEval?.resultado_global === 'Supera' ||
    lastEvalKpi?.nivel_cumplimiento === 'Cumple' ||
    lastEvalKpi?.nivel_cumplimiento === 'Supera'

  if (planDoc && planPct >= 80 && indPendientes === 0 && evalOk) {
    return {
      texto: 'Avance sólido en el plan (≥80 %, indispensables cerrados) y evaluaciones favorables. Revisar promoción con jefatura y RRHH.',
      tono: 'ok',
    }
  }

  if (planDoc && planPct < 25 && indPendientes > 0) {
    return {
      texto: `En desarrollo hacia ${planCarreraTipoLabel(planDoc.tipo)}: priorizar ${indPendientes} requisito(s) indispensable(s) pendiente(s).`,
      tono: 'neutral',
    }
  }

  return {
    texto: 'Seguimiento activo: continuar cerrando ítems del plan y actualizar evaluaciones periódicamente.',
    tono: 'neutral',
  }
}

export function ColaboradorFichaResumen({
  colaborador,
  planDoc,
  planLoading,
  evaluaciones,
  evaluacionesKpi,
  evalLoading,
  capTotal,
  capDone,
  capPct,
  capLoading,
}: Props) {
  const perfil = perfilFromColaborador(colaborador)
  const planTotal = planDoc?.items.length ?? 0
  const planDone = planDoc?.items.filter((i) => i.estado === 'Completado').length ?? 0
  const planEnProgreso = planDoc?.items.filter((i) => i.estado === 'En progreso').length ?? 0
  const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0

  const indPendientes =
    planDoc?.items.filter(
      (i) => i.tipo_requisito === 'Indispensable' && i.estado !== 'Completado',
    ) ?? []

  const lastEval = evaluaciones[0]
  const lastEvalKpi = evaluacionesKpi[0]

  const ejecutivo = buildResumenEjecutivo({
    planDoc,
    planPct,
    indPendientes: indPendientes.length,
    lastEval,
    lastEvalKpi,
    tienePerfil: !!perfil,
  })

  const proximosInd = indPendientes.slice(0, 3)

  const loading = planLoading || evalLoading || capLoading

  return (
    <Card className="border-[var(--navy)]/15 bg-[var(--blue-lt)]/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base text-[var(--navy)]">
          <ClipboardList className="size-4" />
          Resumen de talento
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Consolidado al final de la ficha · datos en RCJ IT Manager
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Actualizando resumen…</p>
        ) : (
          <>
            <div
              className={`rounded-lg border px-3 py-2.5 ${
                ejecutivo.tono === 'ok'
                  ? 'border-[var(--lime)]/40 bg-[var(--lime-lt)]/60'
                  : ejecutivo.tono === 'warn'
                    ? 'border-amber-500/40 bg-amber-500/10'
                    : 'border-border bg-background/80'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lectura rápida
              </p>
              <p className="mt-1 leading-snug text-foreground">{ejecutivo.texto}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border bg-background p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <Target className="size-3.5" /> Perfil
                </p>
                {perfil ? (
                  <>
                    <p className="mt-1 font-mono text-xs font-semibold text-[var(--navy)]">
                      {perfil.codigo}
                    </p>
                    <p className="text-sm font-medium">{perfil.titulo}</p>
                  </>
                ) : (
                  <p className="mt-1 text-muted-foreground">Sin perfil asignado</p>
                )}
              </div>

              <div className="rounded-md border bg-background p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <CheckCircle2 className="size-3.5" /> Plan de carrera
                </p>
                {planDoc ? (
                  <>
                    <p className="mt-1 text-lg font-bold text-[var(--navy)]">{planPct}%</p>
                    <p className="text-xs text-muted-foreground">
                      {planCarreraTipoLabel(planDoc.tipo)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {planDone}/{planTotal} completados
                      {planEnProgreso > 0 ? ` · ${planEnProgreso} en progreso` : ''}
                    </p>
                    {indPendientes.length > 0 && (
                      <p className="mt-1 text-xs text-amber-900">
                        {indPendientes.length} indispensable(s) pendiente(s)
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-muted-foreground">Sin plan</p>
                )}
              </div>

              <div className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Evaluaciones
                </p>
                <div className="mt-1 space-y-1.5">
                  {lastEval ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Rúbrica:</span>
                      <Badge variant="outline" className={resultadoTone(lastEval.resultado_global)}>
                        {lastEval.resultado_global ?? '—'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateDMY(lastEval.fecha)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Rúbrica: sin registros</p>
                  )}
                  {lastEvalKpi ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">KPI:</span>
                      <Badge
                        variant="outline"
                        className={resultadoTone(lastEvalKpi.nivel_cumplimiento)}
                      >
                        {lastEvalKpi.nivel_cumplimiento} ({lastEvalKpi.score_global.toFixed(0)}%)
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">KPI: sin registros</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Total: {evaluaciones.length} rúbrica · {evaluacionesKpi.length} KPI
                  </p>
                </div>
              </div>

              <div className="rounded-md border bg-background p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <GraduationCap className="size-3.5" /> Capacitaciones
                </p>
                {capTotal > 0 ? (
                  <>
                    <p className="mt-1 text-lg font-bold text-[var(--navy)]">{capPct}%</p>
                    <p className="text-xs text-muted-foreground">
                      {capDone}/{capTotal} completadas
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-muted-foreground">Sin asignaciones</p>
                )}
              </div>
            </div>

            {proximosInd.length > 0 && (
              <div className="rounded-md border border-dashed border-[var(--navy)]/25 bg-background/90 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-[var(--navy)]">
                  <AlertCircle className="size-3.5" />
                  Próximos indispensables
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {proximosInd.map((it) => (
                    <li key={it._id ?? it.codigo} className="flex gap-2">
                      {it.codigo && (
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">
                          {it.codigo}
                        </span>
                      )}
                      <span className="leading-snug">{it.requisito}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              El detalle completo está en las pestañas superiores de esta ficha.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

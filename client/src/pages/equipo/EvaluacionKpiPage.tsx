import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, Target, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { fetchColaborador } from '@/lib/api/colaboradores'
import {
  createEvaluacionKpi,
  fetchEvaluacionKpi,
  fetchTemplateEvaluacionKpi,
  updateEvaluacionKpi,
} from '@/lib/api/evaluacionesKpi'
import { cn } from '@/lib/utils'
import { formatDateDMY } from '@/lib/format'
import type { Colaborador } from '@/types/colaborador'
import type {
  DecisionKpi,
  EvaluacionKpiDoc,
  EvaluacionKpiTemplate,
  NivelCumplimientoKpi,
} from '@/types/evaluacionKpi'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type Item = {
  kpi_id: string
  kpi_nombre: string
  kpi_eje: string
  kpi_meta: string
  kpi_unidad: string
  kpi_frecuencia?: string
  kpi_descripcion?: string
  descripcion?: string
  peso: number
  ultimo_valor: number | null
  ultimo_fecha: string | null
  valor_observado: number | null
  cumplimiento_pct: number
  comentario: string
}

function nivelDeScore(score: number): NivelCumplimientoKpi {
  if (score >= 110) return 'Supera'
  if (score >= 85) return 'Cumple'
  if (score >= 60) return 'Parcial'
  return 'No cumple'
}

function nivelBadge(n: NivelCumplimientoKpi): string {
  if (n === 'Supera') return 'border-primary/30 bg-primary/10 text-primary'
  if (n === 'Cumple') return 'border-[var(--lime)]/50 bg-[var(--lime-lt)] text-[var(--navy)]'
  if (n === 'Parcial') return 'border-amber-500/40 bg-amber-500/10 text-amber-900'
  return 'bg-destructive/15 text-destructive border-destructive/30'
}

export function EvaluacionKpiPage() {
  const { id, evaluacionId } = useParams<{ id: string; evaluacionId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNueva = !evaluacionId
  /** Modo `auto` = autoevaluación. Por defecto, modo `jefe`. */
  const modo: 'auto' | 'jefe' = searchParams.get('modo') === 'auto' ? 'auto' : 'jefe'
  const esAuto = modo === 'auto'
  const volverHref = esAuto ? '/mi-evaluacion' : `/equipo/${id}`

  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [template, setTemplate] = useState<EvaluacionKpiTemplate | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [periodo, setPeriodo] = useState('')
  const [evaluadoPor, setEvaluadoPor] = useState('')
  const [decision, setDecision] = useState<DecisionKpi>('Continuar')
  const [comentarios, setComentarios] = useState('')
  const [firmas, setFirmas] = useState({
    colaborador: false,
    coordinador: false,
    jefe: false,
    rrhh: false,
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancel = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const colab = await fetchColaborador(id)
        if (cancel) return
        setColaborador(colab)
        const tpl = await fetchTemplateEvaluacionKpi(id)
        if (cancel) return
        setTemplate(tpl)

        if (evaluacionId) {
          const ev = await fetchEvaluacionKpi(evaluacionId)
          if (cancel) return
          setFecha(ev.fecha.slice(0, 10))
          setPeriodo(ev.periodo ?? '')
          setEvaluadoPor(ev.evaluado_por ?? '')
          setDecision(ev.decision)
          setComentarios(ev.comentarios ?? '')
          setFirmas({
            colaborador: ev.firmas?.colaborador ?? false,
            coordinador: ev.firmas?.coordinador ?? false,
            jefe: ev.firmas?.jefe ?? false,
            rrhh: ev.firmas?.rrhh ?? false,
          })
          // Empareja items del template con la evaluación previa por kpi_id
          const byKpi = new Map(ev.items.map((it) => [String(it.kpi_id), it]))
          setItems(
            tpl.items.map((t) => {
              const prev = byKpi.get(t.kpi_id)
              return {
                kpi_id: t.kpi_id,
                kpi_nombre: t.kpi_nombre,
                kpi_eje: t.kpi_eje,
                kpi_meta: t.kpi_meta,
                kpi_unidad: t.kpi_unidad,
                kpi_frecuencia: t.kpi_frecuencia,
                kpi_descripcion: t.kpi_descripcion,
                descripcion: t.descripcion,
                peso: t.peso,
                ultimo_valor: t.ultimo_valor,
                ultimo_fecha: t.ultimo_fecha,
                valor_observado: prev?.valor_observado ?? t.valor_observado_sugerido,
                cumplimiento_pct: prev?.cumplimiento_pct ?? t.cumplimiento_sugerido,
                comentario: prev?.comentario ?? '',
              }
            }),
          )
        } else {
          setItems(
            tpl.items.map((t) => ({
              kpi_id: t.kpi_id,
              kpi_nombre: t.kpi_nombre,
              kpi_eje: t.kpi_eje,
              kpi_meta: t.kpi_meta,
              kpi_unidad: t.kpi_unidad,
              kpi_frecuencia: t.kpi_frecuencia,
              kpi_descripcion: t.kpi_descripcion,
              descripcion: t.descripcion,
              peso: t.peso,
              ultimo_valor: t.ultimo_valor,
              ultimo_fecha: t.ultimo_fecha,
              valor_observado: t.valor_observado_sugerido,
              cumplimiento_pct: t.cumplimiento_sugerido,
              comentario: '',
            })),
          )
        }
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Error')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [id, evaluacionId])

  const totalPeso = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.peso) || 0), 0),
    [items],
  )
  const scoreGlobal = useMemo(() => {
    if (totalPeso === 0) return 0
    const num = items.reduce((acc, it) => acc + it.cumplimiento_pct * it.peso, 0)
    return Math.round((num / totalPeso) * 100) / 100
  }, [items, totalPeso])
  const nivelActual = nivelDeScore(scoreGlobal)

  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) return
    setSaving(true)
    try {
      const payload = {
        colaborador_id: id,
        tipo: esAuto ? 'autoevaluacion' : 'jefe',
        fecha: `${fecha}T12:00:00.000Z`,
        periodo,
        evaluado_por: evaluadoPor,
        items: items.map((it) => ({
          kpi_id: it.kpi_id,
          kpi_nombre: it.kpi_nombre,
          kpi_eje: it.kpi_eje,
          kpi_meta: it.kpi_meta,
          kpi_unidad: it.kpi_unidad,
          peso: it.peso,
          valor_observado: it.valor_observado,
          cumplimiento_pct: it.cumplimiento_pct,
          comentario: it.comentario,
        })),
        decision: esAuto ? undefined : decision,
        comentarios,
        firmas: esAuto
          ? {
              colaborador: firmas.colaborador,
              coordinador: false,
              jefe: false,
              rrhh: false,
            }
          : firmas,
      }
      let saved: EvaluacionKpiDoc
      if (isNueva) saved = await createEvaluacionKpi(payload as never)
      else saved = await updateEvaluacionKpi(evaluacionId!, payload as never)
      navigate(volverHref)
      void saved
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando evaluación…</p>
  }
  if (err) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-12">
        <Button variant="outline" size="sm" asChild>
          <Link to={volverHref} className="gap-2">
            <ArrowLeft className="size-4" /> {esAuto ? 'Volver' : 'Volver al perfil'}
          </Link>
        </Button>
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-destructive">{err}</p>
            <p className="text-xs text-muted-foreground">
              Verifica que el colaborador tenga un perfil de puesto asignado y que el
              administrador haya configurado los KPIs de evaluación para ese perfil
              (Maestros → Perfiles de puesto → ícono 🎯).
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (!colaborador || !template) return null

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={volverHref} className="gap-2">
              <ArrowLeft className="size-4" />
              {esAuto ? 'Mi desempeño' : 'Perfil'}
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {esAuto ? (
                <>
                  <User className="mr-1 inline size-5 text-[var(--navy)]" />
                  Mi autoevaluación por KPI
                </>
              ) : (
                <>
                  <Target className="mr-1 inline size-5 text-[var(--navy)]" />
                  Evaluación por cumplimiento de KPI
                </>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {colaborador.nombre} · {template.perfil.codigo} — {template.perfil.titulo}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={cn('border', nivelBadge(nivelActual))}>
          {scoreGlobal.toFixed(2)} pts · {nivelActual}
        </Badge>
      </div>

      {esAuto && (
        <div className="rounded-lg border border-[var(--lime)]/40 bg-[var(--lime-lt)] px-3 py-2 text-sm text-[var(--navy)]">
          <strong>Esta es tu autoevaluación por KPI.</strong> Indica tu cumplimiento real
          (lo que tú observas) en cada KPI. Tu jefe registrará su propia evaluación de manera
          independiente y luego podrán compararlas.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Los KPIs y sus pesos son configurados por el rol{' '}
        <strong className="text-foreground">Administrador</strong> en
        <code className="mx-1 rounded bg-muted px-1">Maestros → Perfiles de puesto</code>.
        El cumplimiento sugerido se calcula con el último valor registrado de cada KPI; el
        evaluador puede ajustarlo manualmente.
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[220px]">Campo</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Fecha *</TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="max-w-[240px]"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Período</TableCell>
                  <TableCell>
                    <Input
                      value={periodo}
                      onChange={(e) => setPeriodo(e.target.value)}
                      placeholder="Q1 2026 / Anual 2026 / …"
                      className="max-w-md"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Evaluado por</TableCell>
                  <TableCell>
                    <Input
                      value={evaluadoPor}
                      onChange={(e) => setEvaluadoPor(e.target.value)}
                      placeholder="Nombre del evaluador"
                      className="max-w-md"
                    />
                  </TableCell>
                </TableRow>
                {!esAuto && (
                  <TableRow>
                    <TableCell className="font-medium">Decisión</TableCell>
                    <TableCell>
                      <select
                        className={selectClass + ' max-w-md'}
                        value={decision}
                        onChange={(e) => setDecision(e.target.value as DecisionKpi)}
                      >
                        <option value="Reconocer">Reconocer</option>
                        <option value="Promover">Promover</option>
                        <option value="Continuar">Continuar</option>
                        <option value="Plan de mejora">Plan de mejora</option>
                      </select>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="align-top font-medium">Comentarios</TableCell>
                  <TableCell>
                    <Textarea
                      rows={3}
                      value={comentarios}
                      onChange={(e) => setComentarios(e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">
              KPIs evaluados ({items.length})
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Suma de pesos: {totalPeso}
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead className="w-[110px]">Meta</TableHead>
                  <TableHead className="w-[120px]">Último valor</TableHead>
                  <TableHead className="w-[130px]">Valor observado</TableHead>
                  <TableHead className="w-[120px]">Cumplim. %</TableHead>
                  <TableHead className="w-[70px] text-center">Peso</TableHead>
                  <TableHead>Comentario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={it.kpi_id + idx} className="align-top">
                    <TableCell>
                      <p className="text-xs uppercase text-muted-foreground">{it.kpi_eje}</p>
                      <p className="text-sm font-medium leading-snug">{it.kpi_nombre}</p>
                      {it.kpi_descripcion && (
                        <p className="text-xs text-muted-foreground">{it.kpi_descripcion}</p>
                      )}
                      {it.descripcion && (
                        <p className="mt-1 text-xs italic text-muted-foreground">{it.descripcion}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {it.kpi_meta}{' '}
                      {it.kpi_unidad && (
                        <span className="text-xs text-muted-foreground">({it.kpi_unidad})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {it.ultimo_valor != null ? (
                        <>
                          <span className="font-medium tabular-nums">{it.ultimo_valor}</span>
                          {it.ultimo_fecha && (
                            <div className="text-[11px] text-muted-foreground">
                              {formatDateDMY(it.ultimo_fecha)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin dato</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="any"
                        value={it.valor_observado ?? ''}
                        onChange={(e) =>
                          setItem(idx, {
                            valor_observado: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={it.cumplimiento_pct}
                          onChange={(e) =>
                            setItem(idx, { cumplimiento_pct: Number(e.target.value) || 0 })
                          }
                          className="text-center"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{it.peso}</TableCell>
                    <TableCell>
                      <Textarea
                        rows={2}
                        value={it.comentario}
                        onChange={(e) => setItem(idx, { comentario: e.target.value })}
                        className="min-w-[180px]"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Firmas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead className="w-[140px] text-center">Firmado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  esAuto
                    ? ([['colaborador', 'Colaborador']] as const)
                    : ([
                        ['colaborador', 'Colaborador'],
                        ['coordinador', 'Coordinador'],
                        ['jefe', 'Jefe'],
                        ['rrhh', 'RRHH'],
                      ] as const)
                ).map(([key, label]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-center">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--lime)]"
                          checked={firmas[key]}
                          onChange={(e) =>
                            setFirmas((f) => ({ ...f, [key]: e.target.checked }))
                          }
                        />
                        {firmas[key] ? (
                          <Badge variant="secondary" className="bg-[var(--lime-lt)] text-[var(--navy)]">
                            Firmado
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pendiente</span>
                        )}
                      </label>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Score global:</span>
              <Badge variant="outline" className={cn('border', nivelBadge(nivelActual))}>
                {scoreGlobal.toFixed(2)} · {nivelActual}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to={volverHref}>Cancelar</Link>
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                <Save className="size-4" />
                {saving
                  ? 'Guardando…'
                  : isNueva
                    ? esAuto
                      ? 'Guardar mi autoevaluación'
                      : 'Guardar evaluación'
                    : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

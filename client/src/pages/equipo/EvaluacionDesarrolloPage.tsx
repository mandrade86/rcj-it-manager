import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, Settings2, PlusCircle, Trash2, Save, User, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  createEvaluacion,
  fetchEvaluacion,
  fetchRubricaColaborador,
  updateEvaluacion,
  updateRubricaPorPuesto,
} from '@/lib/api/evaluaciones'
import { fetchColaborador } from '@/lib/api/colaboradores'
import type { RubricaResolver } from '@/types/perfilPuesto'
import { calcularResultadoGlobal } from '@/lib/evaluacionResultado'
import { cn } from '@/lib/utils'
import type { Colaborador } from '@/types/colaborador'
import type {
  CalificacionRubrica,
  CriterioEvaluacion,
  DecisionEvaluacion,
  FirmasEvaluacion,
  NivelEvaluacion,
  RubricaTemplateItem,
} from '@/types/evaluacion'

const CALIFS: CalificacionRubrica[] = ['No cumple', 'En desarrollo', 'Cumple', 'Supera']

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function initCriterios(
  rubrica: RubricaTemplateItem[],
  existentes?: CriterioEvaluacion[],
): CriterioEvaluacion[] {
  return rubrica.map((r, i) => {
    // Empareja por nombre de criterio si está disponible para no perder respuestas
    // cuando la rúbrica cambió de orden o número de criterios.
    const e =
      existentes?.find((x) => x.criterio === r.criterio && x.categoria === r.categoria) ??
      existentes?.[i]
    return {
      categoria: r.categoria,
      criterio: r.criterio,
      calificacion: e?.calificacion ?? undefined,
      comentario: e?.comentario ?? '',
      accion_mejora: e?.accion_mejora ?? '',
    }
  })
}

function resultadoBadgeClass(r: string): string {
  if (r === 'No cumple') return 'bg-destructive/15 text-destructive border-destructive/30'
  if (r === 'En desarrollo') return 'border-amber-500/40 bg-amber-500/10 text-amber-900'
  if (r === 'Cumple') return 'border-[var(--lime)]/50 bg-[var(--lime-lt)] text-[var(--navy)]'
  return 'border-primary/30 bg-primary/10 text-primary'
}

// ─── Rubric editor modal ──────────────────────────────────────────────────────

function RubricaEditorModal({
  open,
  onClose,
  codigo_puesto,
  rubrica,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  codigo_puesto: string
  rubrica: RubricaTemplateItem[]
  onSaved: (updated: RubricaTemplateItem[]) => void
}) {
  const [items, setItems] = useState<RubricaTemplateItem[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (open) setItems(rubrica.map((r) => ({ ...r })))
  }, [open, rubrica])

  function setItem(i: number, patch: Partial<RubricaTemplateItem>) {
    setItems((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function addItem() {
    setItems((prev) => [...prev, { categoria: '', criterio: '' }])
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, j) => j !== i))
  }

  async function handleSave() {
    const valid = items.filter((r) => r.criterio.trim())
    if (valid.length === 0) {
      setErr('Agrega al menos un criterio')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const result = await updateRubricaPorPuesto(codigo_puesto, valid)
      onSaved(result.criterios)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const categories = [...new Set(items.map((r) => r.categoria).filter(Boolean))]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar rúbrica — {codigo_puesto}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Define los criterios de evaluación para este puesto. Los cambios se aplican a
            todas las evaluaciones futuras.
          </p>
        </DialogHeader>

        {err && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_2fr_auto] gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Categoría</span>
            <span>Criterio</span>
            <span />
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-center gap-2">
              <Input
                value={item.categoria}
                onChange={(e) => setItem(i, { categoria: e.target.value })}
                placeholder="Categoría"
                list="cats-list"
                className="text-sm"
              />
              <Input
                value={item.criterio}
                onChange={(e) => setItem(i, { criterio: e.target.value })}
                placeholder="Descripción del criterio"
                className="text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <datalist id="cats-list">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 gap-2"
          onClick={addItem}
        >
          <PlusCircle className="size-4" />
          Agregar criterio
        </Button>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            <X className="mr-1.5 size-4" />
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="gap-2 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
          >
            <Save className="size-4" />
            {saving ? 'Guardando…' : 'Guardar rúbrica'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export function EvaluacionDesarrolloPage() {
  const { id, evaluacionId } = useParams<{ id: string; evaluacionId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNueva = !evaluacionId
  /** Modo `auto` = autoevaluación. Por defecto, modo `jefe`. */
  const modo: 'auto' | 'jefe' = searchParams.get('modo') === 'auto' ? 'auto' : 'jefe'
  const esAuto = modo === 'auto'
  const volverHref = esAuto ? '/mi-evaluacion' : `/equipo/${id}`

  const [colaborador, setColaborador] = useState<Colaborador | null>(null)
  const [rubrica, setRubrica] = useState<RubricaTemplateItem[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rubricaEditorOpen, setRubricaEditorOpen] = useState(false)
  const [rubricaFuente, setRubricaFuente] = useState<RubricaResolver | null>(null)

  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [evaluadoPor, setEvaluadoPor] = useState('')
  const [nivelActual, setNivelActual] = useState<NivelEvaluacion | ''>('')
  const [decision, setDecision] = useState<DecisionEvaluacion | ''>('')
  const [comentarios, setComentarios] = useState('')
  const [firmas, setFirmas] = useState<FirmasEvaluacion>({
    colaborador: false,
    coordinador: false,
    jefe: false,
    rrhh: false,
  })
  const [criterios, setCriterios] = useState<CriterioEvaluacion[]>([])

  const resultadoPreview = useMemo(() => calcularResultadoGlobal(criterios), [criterios])

  useEffect(() => {
    if (!id) return
    let cancel = false
    void (async () => {
      try {
        const col = await fetchColaborador(id)
        if (cancel) return
        setColaborador(col)

        const rubData = await fetchRubricaColaborador(id)
        if (cancel) return
        setRubricaFuente(rubData)
        setRubrica(rubData.criterios)
        setLoadErr(null)

        if (isNueva) {
          setCriterios(initCriterios(rubData.criterios))
        } else if (evaluacionId) {
          const ev = await fetchEvaluacion(evaluacionId)
          if (cancel) return
          setFecha(ev.fecha ? ev.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10))
          setEvaluadoPor(ev.evaluado_por ?? '')
          setNivelActual((ev.nivel_actual as NivelEvaluacion) ?? '')
          setDecision((ev.decision as DecisionEvaluacion) ?? '')
          setComentarios(ev.comentarios ?? '')
          setFirmas(
            ev.firmas ?? { colaborador: false, coordinador: false, jefe: false, rrhh: false },
          )
          setCriterios(initCriterios(rubData.criterios, ev.criterios))
        }
      } catch (e) {
        if (!cancel) {
          setLoadErr(e instanceof Error ? e.message : 'Error')
          setColaborador(null)
          setRubrica(null)
        }
      }
    })()
    return () => { cancel = true }
  }, [id, evaluacionId, isNueva])

  function setCriterio(i: number, patch: Partial<CriterioEvaluacion>) {
    setCriterios((rows) => rows.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  }

  function handleRubricaSaved(updated: RubricaTemplateItem[]) {
    setRubrica(updated)
    setCriterios(initCriterios(updated))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !rubrica) return
    const missing = criterios.some((c) => !c.calificacion)
    if (missing) {
      window.alert(`Debes calificar los ${criterios.length} criterios antes de guardar.`)
      return
    }
    // En autoevaluación la decisión es opcional (la define el jefe).
    if (!esAuto && !decision) {
      window.alert('Selecciona la decisión de evaluación.')
      return
    }
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        colaborador_id: id,
        tipo: esAuto ? 'autoevaluacion' : 'jefe',
        fecha: new Date(`${fecha}T12:00:00`),
        evaluado_por: evaluadoPor.trim() || undefined,
        nivel_actual: nivelActual || undefined,
        decision: decision || undefined,
        comentarios: comentarios.trim() || undefined,
        firmas: esAuto
          ? {
              colaborador: firmas.colaborador,
              coordinador: false,
              jefe: false,
              rrhh: false,
            }
          : firmas,
        criterios: criterios.map((c) => ({
          categoria: c.categoria,
          criterio: c.criterio,
          calificacion: c.calificacion,
          comentario: c.comentario?.trim() || '',
          accion_mejora: c.accion_mejora?.trim() || '',
        })),
      }
      if (isNueva) {
        await createEvaluacion(body)
      } else if (evaluacionId) {
        await updateEvaluacion(evaluacionId, body)
      }
      navigate(volverHref)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loadErr || !colaborador || !rubrica) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <Button variant="outline" size="sm" asChild>
          <Link to={id ? `/equipo/${id}` : '/equipo'} className="gap-2">
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <p className="text-sm text-destructive">{loadErr ?? 'Cargando…'}</p>
      </div>
    )
  }

  // Agrupar criterios por categoría para renderizar una tabla por bloque
  const gruposCriterios: { categoria: string; items: { row: typeof criterios[number]; i: number }[] }[] = []
  for (let i = 0; i < criterios.length; i++) {
    const row = criterios[i]
    const last = gruposCriterios[gruposCriterios.length - 1]
    if (last && last.categoria === row.categoria) {
      last.items.push({ row, i })
    } else {
      gruposCriterios.push({ categoria: row.categoria, items: [{ row, i }] })
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to={volverHref} className="gap-2">
              <ArrowLeft className="size-4" />
              {esAuto ? 'Mi desempeño' : 'Perfil'}
            </Link>
          </Button>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-foreground">
              {esAuto ? (
                <>
                  <User className="size-5 text-[var(--navy)]" />
                  Autoevaluación de desempeño
                </>
              ) : (
                <>Evaluación de desempeño — {colaborador.codigo_puesto}</>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {colaborador.nombre} · {colaborador.puesto} · {isNueva ? 'Nueva evaluación' : 'Editar evaluación'}
            </p>
          </div>
        </div>
        {!esAuto && (
          rubricaFuente?.fuente === 'perfil' && rubricaFuente.perfil_id ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              asChild
              title="Editar rúbrica en el maestro de perfiles"
            >
              <Link to="/maestros/perfiles-puesto">
                <ClipboardList className="size-4" />
                Editar rúbrica del perfil
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRubricaEditorOpen(true)}
              title="Modificar los criterios de la rúbrica para este puesto"
            >
              <Settings2 className="size-4" />
              Editar rúbrica del puesto
            </Button>
          )
        )}
      </div>

      {esAuto && (
        <div className="rounded-lg border border-[var(--lime)]/40 bg-[var(--lime-lt)] px-3 py-2 text-sm text-[var(--navy)]">
          <strong>Esta es tu autoevaluación.</strong> Califica honestamente cada criterio,
          deja tus comentarios y firma cuando termines. Tu jefe completará su propia
          evaluación de manera independiente.
        </div>
      )}

      {rubricaFuente && (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {rubricaFuente.fuente === 'perfil' ? (
            <>
              <Badge variant="secondary" className="mr-2 bg-[var(--lime-lt)] text-[var(--navy)]">
                Rúbrica del perfil
              </Badge>
              Usando rúbrica del perfil
              <strong className="ml-1 text-foreground">
                {rubricaFuente.perfil_codigo} · {rubricaFuente.perfil_titulo}
              </strong>
              {' '}— {rubricaFuente.criterios.length} criterios.
            </>
          ) : (
            <>
              <Badge variant="outline" className="mr-2">Rúbrica por código de puesto</Badge>
              Usando rúbrica legacy del puesto
              <strong className="ml-1 text-foreground">{rubricaFuente.codigo_puesto}</strong>
              {' '}({rubricaFuente.criterios.length} criterios). Vincula este colaborador a un perfil para
              usar la rúbrica del maestro de perfiles.
            </>
          )}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
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
                  <TableCell className="font-medium">Fecha de evaluación</TableCell>
                  <TableCell>
                    <Input
                      id="ev-fecha"
                      type="date"
                      required
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      className="max-w-[240px]"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Evaluado por</TableCell>
                  <TableCell>
                    <Input
                      id="ev-eval"
                      value={evaluadoPor}
                      onChange={(e) => setEvaluadoPor(e.target.value)}
                      placeholder="Nombre del evaluador"
                      className="max-w-md"
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Nivel actual</TableCell>
                  <TableCell>
                    <select
                      id="ev-nivel"
                      className={selectClass + ' max-w-[240px]'}
                      value={nivelActual}
                      onChange={(e) => setNivelActual(e.target.value as NivelEvaluacion | '')}
                    >
                      <option value="">—</option>
                      <option value="Junior">Junior</option>
                      <option value="Mid-Senior">Mid-Senior</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Resultado global</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn('border', resultadoBadgeClass(resultadoPreview))}
                      >
                        {resultadoPreview}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Promedio de los {criterios.length} criterios; el servidor recalcula al guardar.
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {!esAuto && (
                  <TableRow>
                    <TableCell className="font-medium">
                      Decisión <span className="text-destructive">*</span>
                    </TableCell>
                    <TableCell>
                      <select
                        id="ev-dec"
                        required
                        className={selectClass + ' max-w-md'}
                        value={decision}
                        onChange={(e) => setDecision(e.target.value as DecisionEvaluacion | '')}
                      >
                        <option value="">Seleccione…</option>
                        <option value="Promover">Promover</option>
                        <option value="Continuar">Continuar</option>
                        <option value="Plan de mejora">Plan de mejora</option>
                      </select>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="align-top font-medium">Comentarios generales</TableCell>
                  <TableCell>
                    <Textarea
                      id="ev-com"
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
              Rúbrica de evaluación
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {gruposCriterios.length} categoría(s) · {criterios.length} criterio(s)
            </span>
          </CardHeader>
          <CardContent className="space-y-6 p-4 sm:p-6">
            {gruposCriterios.map((g) => (
              <div key={g.categoria} className="overflow-hidden rounded-lg border border-border">
                <div className="bg-[var(--blue-lt)]/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
                  {g.categoria}
                  <span className="ml-1 font-normal text-muted-foreground">· {g.items.length}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[32%]">Criterio</TableHead>
                      <TableHead className="w-[160px]">Calificación</TableHead>
                      <TableHead>Comentario</TableHead>
                      <TableHead>Acción de mejora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map(({ row, i }) => {
                      const descripcion = rubrica?.[i]?.descripcion
                      return (
                        <TableRow key={`${row.categoria}-${i}`} className="align-top">
                          <TableCell className="align-top">
                            <p className="text-sm font-medium leading-snug">{row.criterio}</p>
                            {descripcion && (
                              <p className="mt-1 text-xs italic text-muted-foreground">{descripcion}</p>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <select
                              className={selectClass}
                              required
                              value={row.calificacion ?? ''}
                              onChange={(e) =>
                                setCriterio(i, { calificacion: e.target.value as CalificacionRubrica })
                              }
                            >
                              <option value="">—</option>
                              {CALIFS.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell className="align-top">
                            <Textarea
                              rows={2}
                              value={row.comentario ?? ''}
                              onChange={(e) => setCriterio(i, { comentario: e.target.value })}
                              className="min-w-[180px]"
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Textarea
                              rows={2}
                              value={row.accion_mejora ?? ''}
                              onChange={(e) => setCriterio(i, { accion_mejora: e.target.value })}
                              className="min-w-[180px]"
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ))}
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
                        ['jefe', 'Jefe IT'],
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
                          onChange={(e) => setFirmas((f) => ({ ...f, [key]: e.target.checked }))}
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
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Resultado global:</span>
              <Badge
                variant="outline"
                className={cn('border', resultadoBadgeClass(resultadoPreview))}
              >
                {resultadoPreview}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link to={volverHref}>Cancelar</Link>
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                {saving ? 'Guardando…' : esAuto ? 'Guardar mi autoevaluación' : 'Guardar evaluación'}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {rubrica && colaborador && (
        <RubricaEditorModal
          open={rubricaEditorOpen}
          onClose={() => setRubricaEditorOpen(false)}
          codigo_puesto={colaborador.codigo_puesto}
          rubrica={rubrica}
          onSaved={handleRubricaSaved}
        />
      )}
    </div>
  )
}

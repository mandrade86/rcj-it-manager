import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Crown, ExternalLink, FileText, Printer, Route, Upload, UserCog,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchColaborador, updateColaborador } from '@/lib/api/colaboradores'
import { fetchCapacitaciones, uploadCertificadoColaborador } from '@/lib/api/capacitaciones'
import { fetchEvaluaciones } from '@/lib/api/evaluaciones'
import { fetchEvaluacionesKpiPorColaborador } from '@/lib/api/evaluacionesKpi'
import { fetchPlanCarrera, type PlanCarreraDoc } from '@/lib/api/planCarrera'
import { fetchPerfilesPuesto } from '@/lib/api/perfilesPuesto'
import { fetchPlantillasCarrera, asignarPlantillaAColaborador } from '@/lib/api/plantillasCarrera'
import type { PlantillaCarreraDoc } from '@/types/plantillaCarrera'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateDMY, formatLps } from '@/lib/format'
import { PlanCarreraChecklist } from '@/pages/equipo/PlanCarreraChecklist'
import type { Colaborador } from '@/types/colaborador'
import { perfilFromColaborador, perfilIdFromColaborador } from '@/types/colaborador'
import type { EvaluacionDoc } from '@/types/evaluacion'
import type { EvaluacionKpiDoc } from '@/types/evaluacionKpi'
import type { CapacitacionDoc } from '@/types/capacitacion'
import { certificadoPublicUrl, colaboradorIdFromAsignado } from '@/types/capacitacion'
import type { PerfilPuestoDoc } from '@/types/perfilPuesto'
import { deptFromPerfil } from '@/types/perfilPuesto'
import { printDescriptorPuesto } from '@/lib/printDescriptorPuesto'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

// ─── helpers ─────────────────────────────────────────────────────────────────

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
    <Badge variant="outline" className={`border ${cls}`}>
      {r}
    </Badge>
  )
}

// ─── Descriptor de puesto = perfil asignado ─────────────────────────────────

function PerfilAsignadoTab({
  colaborador,
  perfilesDisponibles,
  cambiandoPerfil,
  onCambiarPerfil,
}: {
  colaborador: Colaborador
  perfilesDisponibles: PerfilPuestoDoc[]
  cambiandoPerfil: boolean
  onCambiarPerfil: (perfilId: string | null) => Promise<void>
}) {
  const perfil = perfilFromColaborador(colaborador)

  function handleImprimir() {
    if (!perfil) return
    printDescriptorPuesto({
      perfil,
      colaboradorNombre: colaborador.nombre,
      colaboradorCodigo: colaborador.codigo,
    })
  }
  const perfilId = perfilIdFromColaborador(colaborador) ?? ''
  const sectionLabel = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5'

  // Sugiere perfiles del mismo departamento primero
  const perfilesOrdenados = useMemo(() => {
    const deptColab =
      colaborador.departamento_id && typeof colaborador.departamento_id === 'object'
        ? colaborador.departamento_id._id
        : (colaborador.departamento_id as string | null)
    return [...perfilesDisponibles].sort((a, b) => {
      const dA = deptFromPerfil(a)?._id ?? ''
      const dB = deptFromPerfil(b)?._id ?? ''
      const matchA = dA === deptColab ? 0 : 1
      const matchB = dB === deptColab ? 0 : 1
      if (matchA !== matchB) return matchA - matchB
      return a.codigo.localeCompare(b.codigo)
    })
  }, [perfilesDisponibles, colaborador.departamento_id])

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-2">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {perfil ? (
              <>
                <span className="font-mono text-sm font-semibold text-[var(--navy)]">
                  {perfil.codigo}
                </span>
                <span>·</span>
                <span>{perfil.titulo}</span>
                {perfil.tiene_personal_a_cargo && (
                  <Badge variant="secondary" className="gap-1 bg-[var(--navy)] py-0 text-[10px] text-white">
                    <Crown className="size-2.5" /> Con personal a cargo
                  </Badge>
                )}
              </>
            ) : (
              <span>Sin perfil asignado</span>
            )}
          </CardTitle>
          {perfil?.reporta_a && (
            <p className="mt-0.5 text-sm text-muted-foreground">Reporta a: {perfil.reporta_a}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            El descriptor de puesto es el <strong>mismo perfil</strong> asignado al colaborador.
            Para modificar su contenido edita el perfil en el maestro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {perfil && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleImprimir}
              >
                <Printer className="size-3.5" />
                Imprimir RH-F-04
              </Button>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <Link to="/maestros/perfiles-puesto">
                  <ExternalLink className="size-3.5" />
                  Editar en maestro
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {/* Selector inline para cambiar el perfil asignado */}
        <div className="grid gap-2 rounded-md border border-dashed border-[var(--navy)]/20 bg-[var(--blue-lt)]/20 p-3">
          <Label className="flex items-center gap-1.5 text-xs">
            <UserCog className="size-3.5 text-[var(--navy)]" />
            Cambiar perfil asignado
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={selectClass + ' max-w-md'}
              value={perfilId}
              disabled={cambiandoPerfil}
              onChange={(e) => void onCambiarPerfil(e.target.value || null)}
            >
              <option value="">— Sin perfil —</option>
              {perfilesOrdenados.map((p) => {
                const dept = deptFromPerfil(p)
                return (
                  <option key={p._id} value={p._id}>
                    {p.codigo} · {p.titulo}{dept ? ` (${dept.codigo})` : ''}
                  </option>
                )
              })}
            </select>
            {cambiandoPerfil && (
              <span className="text-xs text-muted-foreground">Guardando…</span>
            )}
          </div>
        </div>

        {!perfil ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Este colaborador todavía no tiene perfil de puesto asignado. Elige uno arriba o crea el
            perfil correspondiente en
            {' '}
            <Link to="/maestros/perfiles-puesto" className="underline">
              Maestros → Perfiles de Puesto
            </Link>.
          </div>
        ) : (
          <>
            {perfil.objetivo && (
              <div>
                <p className={sectionLabel}>Objetivo del puesto</p>
                <p className="whitespace-pre-wrap leading-relaxed">{perfil.objetivo}</p>
              </div>
            )}
            {(perfil.requisitos?.length ?? 0) > 0 && (
              <div>
                <p className={sectionLabel}>Requisitos</p>
                <ul className="list-inside list-disc space-y-1">
                  {perfil.requisitos!.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            {(perfil.responsabilidades?.length ?? 0) > 0 && (
              <div>
                <p className={sectionLabel}>Responsabilidades</p>
                <ul className="list-inside list-disc space-y-1">
                  {perfil.responsabilidades!.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            {(perfil.autoridad?.length ?? 0) > 0 && (
              <div>
                <p className={sectionLabel}>Autoridad y toma de decisiones</p>
                <ul className="list-inside list-disc space-y-1">
                  {perfil.autoridad!.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {perfil.educacion && (
                <div>
                  <p className={sectionLabel}>Educación requerida</p>
                  <p>{perfil.educacion}</p>
                </div>
              )}
              {perfil.experiencia && (
                <div>
                  <p className={sectionLabel}>Experiencia requerida</p>
                  <p>{perfil.experiencia}</p>
                </div>
              )}
              {perfil.nivel && (
                <div>
                  <p className={sectionLabel}>Nivel</p>
                  <p>{perfil.nivel}</p>
                </div>
              )}
              {(() => {
                const dept = deptFromPerfil(perfil)
                return dept ? (
                  <div>
                    <p className={sectionLabel}>Departamento</p>
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: dept.color ?? '#002060' }}
                      />
                      <p>{dept.nombre}</p>
                    </div>
                  </div>
                ) : null
              })()}
            </div>
            {(perfil.competencias?.length ?? 0) > 0 && (
              <div>
                <p className={sectionLabel}>Competencias clave</p>
                <div className="flex flex-wrap gap-2">
                  {perfil.competencias!.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {(perfil.rubrica_criterios?.length ?? 0) > 0 && (
              <div>
                <p className={sectionLabel}>Rúbrica de evaluación</p>
                <p className="text-xs text-muted-foreground">
                  Este perfil tiene <strong>{perfil.rubrica_criterios!.length}</strong> criterio(s)
                  configurados para las evaluaciones de desempeño.
                </p>
              </div>
            )}
            {perfil.notas && (
              <div>
                <p className={sectionLabel}>Notas adicionales</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{perfil.notas}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ─── certificate cell ─────────────────────────────────────────────────────────

function CertificadoCell({
  capacitacionId,
  colaboradorId,
  certificado,
  onUploaded,
}: {
  capacitacionId: string
  colaboradorId: string
  certificado?: string | null
  onUploaded: (updated: CapacitacionDoc) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setErr(null)
    try {
      const updated = await uploadCertificadoColaborador(capacitacionId, colaboradorId, file)
      onUploaded(updated)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Error al subir')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const certUrl = certificadoPublicUrl(certificado)

  return (
    <div className="flex items-center gap-2">
      {certUrl ? (
        <a
          href={certUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[var(--navy)] underline hover:text-[var(--lime)]"
        >
          <FileText className="size-3.5" />
          Ver
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => void handleFile(e)}
      />
      <button
        type="button"
        title="Subir certificado"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:border-[var(--lime)] hover:text-[var(--navy)] disabled:opacity-50"
      >
        <Upload className="size-3" />
        {uploading ? 'Subiendo…' : 'Subir'}
      </button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function ColaboradorPerfilPage() {
  const { id } = useParams<{ id: string }>()
  const [c, setC] = useState<Colaborador | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [planLoading, setPlanLoading] = useState(true)
  const [planErr, setPlanErr] = useState(false)
  const [planDoc, setPlanDoc] = useState<PlanCarreraDoc | null>(null)

  const [evaluaciones, setEvaluaciones] = useState<EvaluacionDoc[]>([])
  const [evalLoading, setEvalLoading] = useState(true)
  const [evalErr, setEvalErr] = useState<string | null>(null)

  const [evaluacionesKpi, setEvaluacionesKpi] = useState<EvaluacionKpiDoc[]>([])

  const [misCaps, setMisCaps] = useState<CapacitacionDoc[]>([])
  const [capLoading, setCapLoading] = useState(true)
  const [capErr, setCapErr] = useState<string | null>(null)

  const [perfilesDisponibles, setPerfilesDisponibles] = useState<PerfilPuestoDoc[]>([])
  const [cambiandoPerfil, setCambiandoPerfil] = useState(false)

  const [asignarOpen, setAsignarOpen] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaCarreraDoc[]>([])
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('')
  const [asignando, setAsignando] = useState(false)
  const [asignarErr, setAsignarErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancel = false
    void (async () => {
      setErr(null)
      try {
        const doc = await fetchColaborador(id)
        if (!cancel) setC(doc)
      } catch (e) {
        if (!cancel) { setErr(e instanceof Error ? e.message : 'Error'); setC(null) }
      }
    })()
    return () => { cancel = true }
  }, [id])

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        const list = await fetchPerfilesPuesto()
        if (!cancel) setPerfilesDisponibles(list)
      } catch {
        if (!cancel) setPerfilesDisponibles([])
      }
    })()
    return () => { cancel = true }
  }, [])

  async function handleCambiarPerfil(perfilId: string | null) {
    if (!c) return
    setCambiandoPerfil(true)
    try {
      const updated = await updateColaborador(c._id, {
        perfil_puesto_id: perfilId,
      })
      setC(updated)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al cambiar perfil')
    } finally {
      setCambiandoPerfil(false)
    }
  }

  useEffect(() => {
    if (!id) return
    let cancel = false
    void (async () => {
      setPlanLoading(true); setPlanErr(false); setPlanDoc(null)
      try {
        const p = await fetchPlanCarrera(id)
        if (!cancel) { setPlanDoc(p); setPlanLoading(false) }
      } catch {
        if (!cancel) { setPlanErr(true); setPlanLoading(false) }
      }
    })()
    return () => { cancel = true }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancel = false
    void (async () => {
      setEvalLoading(true); setEvalErr(null)
      try {
        const [rubricaRows, kpiRows] = await Promise.all([
          fetchEvaluaciones(id),
          fetchEvaluacionesKpiPorColaborador(id).catch(() => [] as EvaluacionKpiDoc[]),
        ])
        if (!cancel) {
          setEvaluaciones(rubricaRows)
          setEvaluacionesKpi(kpiRows)
          setEvalLoading(false)
        }
      } catch (e) {
        if (!cancel) {
          setEvalErr(e instanceof Error ? e.message : 'Error')
          setEvaluaciones([])
          setEvaluacionesKpi([])
          setEvalLoading(false)
        }
      }
    })()
    return () => { cancel = true }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancel = false
    void (async () => {
      setCapLoading(true); setCapErr(null)
      try {
        const list = await fetchCapacitaciones({ colaborador_id: id })
        if (!cancel) { setMisCaps(list); setCapLoading(false) }
      } catch (e) {
        if (!cancel) { setCapErr(e instanceof Error ? e.message : 'Error'); setMisCaps([]); setCapLoading(false) }
      }
    })()
    return () => { cancel = true }
  }, [id])

  if (err || !c) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/equipo" className="gap-2"><ArrowLeft className="size-4" />Volver al equipo</Link>
        </Button>
        <p className="text-sm text-destructive">{err ?? 'Colaborador no encontrado.'}</p>
      </div>
    )
  }

  // ─── progress calculations ──────────────────────────────────────────────────
  const planTotal = planDoc?.items.length ?? 0
  const planDone = planDoc?.items.filter((i) => i.estado === 'Completado').length ?? 0
  const planPct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0

  const capTotal = misCaps.length
  const capDone = misCaps.filter((cap) => {
    const asg = cap.asignados.find((a) => colaboradorIdFromAsignado(a) === id)
    return asg?.estado === 'Completado'
  }).length
  const capPct = capTotal > 0 ? Math.round((capDone / capTotal) * 100) : 0

  const lastEval = evaluaciones[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/equipo" className="gap-2"><ArrowLeft className="size-4" />Equipo</Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{c.nombre}</h2>
          <p className="text-sm text-muted-foreground">{c.puesto} · {c.codigo}</p>
        </div>
        <Badge
          variant="secondary"
          className={c.estado === 'Activo' ? 'bg-[var(--lime-lt)] text-[var(--navy)]' : undefined}
        >
          {c.estado}
        </Badge>
      </div>

      <Tabs defaultValue="info">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="info">Info general</TabsTrigger>
          <TabsTrigger value="descriptor">Descriptor de puesto</TabsTrigger>
          <TabsTrigger value="eval">Evaluaciones</TabsTrigger>
          <TabsTrigger value="plan">Plan de carrera</TabsTrigger>
          <TabsTrigger value="cap">Capacitaciones</TabsTrigger>
        </TabsList>

        {/* ── TAB: Info general ── */}
        <TabsContent value="info" className="mt-4 space-y-4">
          {/* Resumen de avance */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Plan de carrera */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Plan de carrera
                </p>
                {planLoading ? (
                  <p className="mt-1 text-sm text-muted-foreground">Cargando…</p>
                ) : planDoc ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-[var(--navy)]">
                      {planPct}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {planDone} / {planTotal} ítems completados
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--lime)] transition-all"
                        style={{ width: `${planPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Sin plan asignado</p>
                )}
              </CardContent>
            </Card>

            {/* Capacitaciones */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Capacitaciones
                </p>
                {capLoading ? (
                  <p className="mt-1 text-sm text-muted-foreground">Cargando…</p>
                ) : capTotal > 0 ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-[var(--navy)]">
                      {capPct}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {capDone} / {capTotal} completadas
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[var(--lime)] transition-all"
                        style={{ width: `${capPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Sin capacitaciones asignadas</p>
                )}
              </CardContent>
            </Card>

            {/* Última evaluación */}
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Última evaluación
                </p>
                {evalLoading ? (
                  <p className="mt-1 text-sm text-muted-foreground">Cargando…</p>
                ) : lastEval ? (
                  <>
                    <div className="mt-1">{resultadoBadge(lastEval.resultado_global)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateDMY(lastEval.fecha)}
                    </p>
                    {lastEval.decision && (
                      <p className="text-xs text-muted-foreground">
                        Decisión: <span className="font-medium">{lastEval.decision}</span>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Sin evaluaciones</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Datos personales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos personales y laborales</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-medium">{c.codigo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Código de puesto</p>
                <p className="font-medium">{c.codigo_puesto}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Frente</p>
                <p className="font-medium">{c.frente}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nivel</p>
                <p className="font-medium">{c.nivel ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha de ingreso</p>
                <p className="font-medium">{formatDateDMY(c.fecha_ingreso)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Salario mensual</p>
                <p className="font-medium">{formatLps(c.salario_mensual ?? null)}</p>
              </div>
              {c.notas && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Notas</p>
                  <p className="whitespace-pre-wrap">{c.notas}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB: Descriptor de puesto ── */}
        <TabsContent value="descriptor" className="mt-4">
          {!c ? (
            <p className="text-sm text-muted-foreground">Cargando descriptor…</p>
          ) : (
            <PerfilAsignadoTab
              colaborador={c}
              perfilesDisponibles={perfilesDisponibles}
              cambiandoPerfil={cambiandoPerfil}
              onCambiarPerfil={handleCambiarPerfil}
            />
          )}
        </TabsContent>

        {/* ── TAB: Evaluaciones ── */}
        <TabsContent value="eval" className="mt-4 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Dos modalidades disponibles: <strong>rúbrica de desempeño</strong> (criterios
              cualitativos) y <strong>cumplimiento de KPI</strong> (ponderado, configurado por
              el administrador en el perfil del puesto).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                asChild
              >
                <Link to={`/equipo/${id}/evaluaciones/nueva`}>Nueva evaluación (rúbrica)</Link>
              </Button>
              <Button
                type="button"
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                asChild
              >
                <Link to={`/equipo/${id}/evaluaciones-kpi/nueva`}>Nueva evaluación por KPI</Link>
              </Button>
            </div>
          </div>

          {evalLoading && <p className="text-sm text-muted-foreground">Cargando evaluaciones…</p>}
          {!evalLoading && evalErr && <p className="text-sm text-destructive">{evalErr}</p>}

          {/* Rúbrica */}
          {!evalLoading && !evalErr && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Historial por rúbrica ({evaluaciones.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evaluaciones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin evaluaciones por rúbrica todavía.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Resultado global</TableHead>
                        <TableHead>Decisión</TableHead>
                        <TableHead>Evaluado por</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluaciones.map((ev) => (
                        <TableRow key={ev._id}>
                          <TableCell>{formatDateDMY(ev.fecha)}</TableCell>
                          <TableCell>
                            {ev.tipo === 'autoevaluacion' ? (
                              <Badge variant="secondary" className="bg-[var(--blue-lt)] text-[var(--navy)]">
                                Autoevaluación
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                                Jefe
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{resultadoBadge(ev.resultado_global)}</TableCell>
                          <TableCell>{ev.decision ?? '—'}</TableCell>
                          <TableCell>{ev.evaluado_por ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/equipo/${id}/evaluaciones/${ev._id}`}>Ver</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* KPI */}
          {!evalLoading && !evalErr && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Historial por cumplimiento de KPI ({evaluacionesKpi.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {evaluacionesKpi.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sin evaluaciones por KPI todavía. El administrador debe configurar los KPIs
                    del perfil de puesto del colaborador (ícono 🎯 en Maestros → Perfiles de
                    puesto) antes de realizar la primera evaluación.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Nivel</TableHead>
                        <TableHead>Decisión</TableHead>
                        <TableHead>Evaluado por</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {evaluacionesKpi.map((ev) => (
                        <TableRow key={ev._id}>
                          <TableCell>{formatDateDMY(ev.fecha)}</TableCell>
                          <TableCell>
                            {ev.tipo === 'autoevaluacion' ? (
                              <Badge variant="secondary" className="bg-[var(--blue-lt)] text-[var(--navy)]">
                                Autoevaluación
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                                Jefe
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ev.periodo || '—'}
                          </TableCell>
                          <TableCell className="font-medium tabular-nums">
                            {ev.score_global.toFixed(2)}
                          </TableCell>
                          <TableCell>{resultadoBadge(ev.nivel_cumplimiento)}</TableCell>
                          <TableCell>{ev.decision}</TableCell>
                          <TableCell>{ev.evaluado_por ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link to={`/equipo/${id}/evaluaciones-kpi/${ev._id}`}>
                                Ver
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── TAB: Plan de carrera ── */}
        <TabsContent value="plan" className="mt-4">
          {planLoading && <p className="text-sm text-muted-foreground">Cargando plan de carrera…</p>}
          {!planLoading && planErr && <p className="text-sm text-destructive">No se pudo cargar el plan de carrera.</p>}
          {!planLoading && !planErr && planDoc === null && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-14 text-center">
              <div className="rounded-full bg-muted p-4">
                <Route className="size-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Sin plan de carrera asignado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Asigna una plantilla de carrera para comenzar el seguimiento de desarrollo.
                </p>
              </div>
              <Button
                onClick={() => {
                  void fetchPlantillasCarrera().then((list) => { setPlantillas(list); setAsignarOpen(true) })
                }}
                className="gap-2 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
              >
                <Route className="size-4" /> Asignar plan desde plantilla
              </Button>
            </div>
          )}
          {!planLoading && !planErr && planDoc !== null && (
            <PlanCarreraChecklist plan={planDoc} onUpdated={setPlanDoc} colaboradorId={id} />
          )}
        </TabsContent>

        {/* Modal asignar plantilla */}
        <Dialog open={asignarOpen} onOpenChange={setAsignarOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar plan de carrera</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {asignarErr && (
                <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{asignarErr}</p>
              )}
              <div className="grid gap-2">
                <Label>Plantilla de carrera</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring"
                  value={plantillaSeleccionada}
                  onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                >
                  <option value="">— Selecciona una plantilla —</option>
                  {plantillas.map((pl) => (
                    <option key={pl._id} value={pl._id}>{pl.nombre}</option>
                  ))}
                </select>
                {plantillaSeleccionada && (() => {
                  const pl = plantillas.find((p) => p._id === plantillaSeleccionada)
                  if (!pl) return null
                  return (
                    <p className="text-xs text-muted-foreground">
                      {pl.items.length} ítems · {pl.descripcion}
                    </p>
                  )
                })()}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setAsignarOpen(false)}>Cancelar</Button>
              <Button
                disabled={!plantillaSeleccionada || asignando}
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                onClick={async () => {
                  if (!id || !plantillaSeleccionada) return
                  setAsignando(true); setAsignarErr(null)
                  try {
                    await asignarPlantillaAColaborador({ colaborador_id: id, plantilla_id: plantillaSeleccionada })
                    setAsignarOpen(false)
                    const updated = await fetchPlanCarrera(id)
                    setPlanDoc(updated)
                  } catch (ex) {
                    setAsignarErr(ex instanceof Error ? ex.message : 'Error al asignar')
                  } finally { setAsignando(false) }
                }}
              >
                {asignando ? 'Asignando…' : 'Asignar plan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── TAB: Capacitaciones ── */}
        <TabsContent value="cap" className="mt-4 space-y-4">
          {capLoading && <p className="text-sm text-muted-foreground">Cargando capacitaciones…</p>}
          {!capLoading && capErr && <p className="text-sm text-destructive">{capErr}</p>}
          {!capLoading && !capErr && misCaps.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Sin capacitaciones asignadas. Asigna cursos desde el módulo{' '}
                <Link className="font-medium text-[var(--navy)] underline" to="/capacitaciones">
                  Capacitaciones
                </Link>
                .
              </CardContent>
            </Card>
          )}
          {!capLoading && !capErr && misCaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Asignaciones — {capDone}/{capTotal} completadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-[var(--lime)] transition-all"
                    style={{ width: `${capPct}%` }}
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Capacitación</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fin del curso</TableHead>
                      <TableHead>Certificado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {misCaps.map((cap) => {
                      const asg = cap.asignados.find((a) => colaboradorIdFromAsignado(a) === id)
                      return (
                        <TableRow key={cap._id}>
                          <TableCell className="font-medium">{cap.nombre}</TableCell>
                          <TableCell>{cap.proveedor ?? '—'}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                asg?.estado === 'Completado'
                                  ? 'bg-[var(--lime-lt)] text-[var(--navy)]'
                                  : asg?.estado === 'En progreso'
                                    ? 'bg-amber-500/10 text-amber-900'
                                    : undefined
                              }
                            >
                              {asg?.estado ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDateDMY(cap.fecha_fin)}</TableCell>
                          <TableCell>
                            {id && (
                              <CertificadoCell
                                capacitacionId={cap._id}
                                colaboradorId={id}
                                certificado={asg?.certificado}
                                onUploaded={(updated) => {
                                  setMisCaps((prev) =>
                                    prev.map((p) => (p._id === updated._id ? updated : p)),
                                  )
                                }}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

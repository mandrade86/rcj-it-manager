import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, Building2, ChevronDown, Factory, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchEmpresas } from '@/lib/api/empresas'
import { fetchKpis } from '@/lib/api/kpis'
import { updateProyectoParticipantes } from '@/lib/api/proyectos'
import { fetchUsuarios } from '@/lib/api/usuarios'
import { cn } from '@/lib/utils'
import { ProyectoParticipantesEditor, type ParticipanteDraft } from '@/pages/proyectos/ProyectoParticipantesEditor'
import { useAuthStore } from '@/store/authStore'
import type { DepartamentoDoc } from '@/types/departamento'
import type { EmpresaDoc } from '@/types/empresa'
import type { KpiDoc } from '@/types/kpi'
import type { UsuarioDoc } from '@/types/usuario'
import { empleadoIdFromUsuario } from '@/types/usuario'
import type {
  Proyecto, ProyectoEstado, ProyectoFase, ProyectoPrioridad, ProyectoTipo,
} from '@/types/proyecto'
import {
  PROYECTO_ESTADOS, participanteUsuarioId, proyectoDeptId, proyectoEmpresaIdList,
  proyectoKpiId, proyectoOwnerId, proyectoPuedeGestionarParticipantes,
} from '@/types/proyecto'

const EJE_GENERAL = 'General'

const PASOS_NUEVO = [
  { id: 'datos', label: 'Proyecto' },
  { id: 'equipo', label: 'Equipo' },
  { id: 'org', label: 'Organización' },
  { id: 'meta', label: 'Meta' },
] as const

function suggestProjectId() {
  const d = new Date()
  const y = String(d.getFullYear()).slice(2)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const r = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `P-${y}${m}-${r}`
}

function FormSection({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  hint?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--navy)]">{title}</p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? <div className="space-y-4 border-t border-border px-4 py-4">{children}</div> : null}
    </div>
  )
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type FormState = {
  _id: string
  nombre: string
  descripcion: string
  eje: string
  fase: string
  tipo: ProyectoTipo
  usuario_id: string
  departamento_id: string
  responsable: string
  fecha_inicio: string
  fecha_fin: string
  prioridad: ProyectoPrioridad
  estado: ProyectoEstado
  kpi_id: string
  meta_kpi: string
  presupuesto_planificado: string
  presupuesto_ejecutado: string
  moneda_presupuesto: 'HNL' | 'USD'
  presupuesto_notas: string
  notas: string
  empresa_ids: string[]
}

function emptyForm(defaults: {
  usuario_id?: string | null
  departamento_id?: string | null
  eje?: string
}): FormState {
  return {
    _id: suggestProjectId(),
    nombre: '',
    descripcion: '',
    eje: defaults.eje ?? EJE_GENERAL,
    fase: '',
    tipo: 'individual',
    usuario_id: defaults.usuario_id ?? '',
    departamento_id: defaults.departamento_id ?? '',
    responsable: '',
    fecha_inicio: '',
    fecha_fin: '',
    prioridad: 'Media',
    estado: 'Planificado',
    kpi_id: '',
    meta_kpi: '',
    presupuesto_planificado: '',
    presupuesto_ejecutado: '',
    moneda_presupuesto: 'HNL',
    presupuesto_notas: '',
    notas: '',
    empresa_ids: [],
  }
}

function fromProyecto(p: Proyecto): FormState {
  return {
    _id: p._id,
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    eje: p.eje ?? '',
    fase: p.fase != null ? String(p.fase) : '',
    tipo: (p.tipo ?? 'individual') as ProyectoTipo,
    usuario_id: proyectoOwnerId(p) ?? '',
    departamento_id: proyectoDeptId(p) ?? '',
    responsable: p.responsable ?? '',
    fecha_inicio: p.fecha_inicio ? p.fecha_inicio.slice(0, 10) : '',
    fecha_fin: p.fecha_fin ? p.fecha_fin.slice(0, 10) : '',
    prioridad: p.prioridad,
    estado: p.estado,
    kpi_id: proyectoKpiId(p) ?? '',
    meta_kpi: p.meta_kpi ?? '',
    presupuesto_planificado:
      p.presupuesto_planificado != null && Number.isFinite(p.presupuesto_planificado)
        ? String(p.presupuesto_planificado)
        : '',
    presupuesto_ejecutado:
      p.presupuesto_ejecutado != null && Number.isFinite(p.presupuesto_ejecutado)
        ? String(p.presupuesto_ejecutado)
        : '',
    moneda_presupuesto: p.moneda_presupuesto === 'USD' ? 'USD' : 'HNL',
    presupuesto_notas: p.presupuesto_notas ?? '',
    notas: p.notas ?? '',
    empresa_ids: proyectoEmpresaIdList(p),
  }
}

function parseMoneyInput(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function toPayload(f: FormState, isEdit: boolean): Record<string, unknown> {
  const o: Record<string, unknown> = {
    _id: f._id.trim(),
    nombre: f.nombre.trim(),
    descripcion: f.descripcion.trim() || undefined,
    eje: f.eje.trim() || undefined,
    tipo: f.tipo,
    usuario_id: f.usuario_id || null,
    departamento_id: f.departamento_id || null,
    responsable: f.responsable.trim() || undefined,
    prioridad: f.prioridad,
    kpi_id: f.kpi_id || null,
    meta_kpi: f.meta_kpi.trim() || undefined,
    presupuesto_planificado: parseMoneyInput(f.presupuesto_planificado),
    moneda_presupuesto: f.moneda_presupuesto,
    presupuesto_notas: f.presupuesto_notas.trim() || '',
    notas: f.notas.trim() || undefined,
    empresa_ids: f.empresa_ids,
  }
  if (f.fase) {
    const n = Number(f.fase)
    if ([1, 2, 3].includes(n)) o.fase = n as ProyectoFase
  } else {
    o.fase = null
  }
  o.fecha_inicio = f.fecha_inicio.trim() ? new Date(`${f.fecha_inicio.trim()}T12:00:00`) : null
  o.fecha_fin = f.fecha_fin.trim() ? new Date(`${f.fecha_fin.trim()}T12:00:00`) : null
  if (!isEdit) {
    o.estado = f.estado
    o.porcentaje_avance = 0
  }
  return o
}

type Props = {
  /** `page` = pantalla completa (sin modal). */
  variant?: 'dialog' | 'page'
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tras guardar en modo página: navegar al detalle del proyecto. */
  onPageSaved?: (proyectoId: string) => void
  editing: Proyecto | null
  avanceActual?: number
  onSave: (payload: Record<string, unknown>) => Promise<void>
}

export function ProyectoFormDialog({
  variant = 'dialog',
  open,
  onOpenChange,
  onPageSaved,
  editing,
  avanceActual,
  onSave,
}: Props) {
  const user = useAuthStore((s) => s.user)
  const [departamentos, setDepartamentos] = useState<DepartamentoDoc[]>([])
  const [empresas, setEmpresas] = useState<EmpresaDoc[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioDoc[]>([])
  const [kpisDept, setKpisDept] = useState<KpiDoc[]>([])
  const [puedeAsignarOtro, setPuedeAsignarOtro] = useState(false)
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? fromProyecto(editing)
      : emptyForm({
        usuario_id: user?._id,
        departamento_id: user?.departamento_id ?? null,
        eje: EJE_GENERAL,
      }),
  )
  const [participantesDraft, setParticipantesDraft] = useState<ParticipanteDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [openOrg, setOpenOrg] = useState(!editing)
  const [openMeta, setOpenMeta] = useState(false)
  const [openEquipo, setOpenEquipo] = useState(false)
  const [openNotas, setOpenNotas] = useState(false)
  const [paso, setPaso] = useState(0)
  const [pasoError, setPasoError] = useState<string | null>(null)
  const isEdit = Boolean(editing)
  const wizard = !isEdit

  const active = variant === 'page' || open

  useEffect(() => {
    if (!active) return
    let cancel = false
    void (async () => {
      try {
        const [deps, emps, usrs] = await Promise.all([
          fetchDepartamentos().catch(() => [] as DepartamentoDoc[]),
          fetchEmpresas({ activo: true }).catch(() => [] as EmpresaDoc[]),
          fetchUsuarios().catch(() => [] as UsuarioDoc[]),
        ])
        if (cancel) return
        setDepartamentos(deps)
        setEmpresas(emps)
        setUsuarios(usrs)
        // Si pudo leer >1 usuario o uno distinto a sí mismo, asumimos permiso
        setPuedeAsignarOtro(usrs.length > 1 || (usrs.length === 1 && usrs[0]._id !== user?._id))
      } catch {
        /* ya manejado por catch interno */
      }
    })()
    return () => { cancel = true }
  }, [active, user?._id])

  const deptParaKpis = form.departamento_id || user?.departamento_id || ''

  useEffect(() => {
    if (!active) return
    if (!deptParaKpis) {
      setKpisDept([])
      return
    }
    let cancel = false
    void (async () => {
      try {
        const list = await fetchKpis({ departamento_id: deptParaKpis })
        if (!cancel) setKpisDept(list)
      } catch {
        if (!cancel) setKpisDept([])
      }
    })()
    return () => { cancel = true }
  }, [active, deptParaKpis])

  useEffect(() => {
    if (!active) return
    if (editing) {
      const next = fromProyecto(editing)
      setForm(next)
      const parts = (editing.participantes ?? []).map((p, i) => ({
        key: p._id ?? `p-${i}`,
        usuario_id: participanteUsuarioId(p) ?? '',
        rol: p.rol ?? 'lectura',
      })).filter((p) => p.usuario_id)
      setParticipantesDraft(parts)
      setOpenOrg(Boolean(next.empresa_ids.length || next.fase || (next.eje && next.eje !== EJE_GENERAL)))
      setOpenMeta(Boolean(next.kpi_id || next.presupuesto_planificado || next.presupuesto_notas))
      setOpenEquipo(Boolean(parts.length || next.responsable))
      setOpenNotas(Boolean(next.notas))
      setPaso(0)
      setPasoError(null)
    } else {
      setForm(emptyForm({
        usuario_id: user?._id,
        departamento_id: user?.departamento_id ?? null,
        eje: EJE_GENERAL,
      }))
      setParticipantesDraft([])
      setOpenOrg(false)
      setOpenMeta(false)
      setOpenEquipo(false)
      setOpenNotas(false)
      setPaso(0)
      setPasoError(null)
    }
  }, [active, editing, user?._id, user?.departamento_id])

  const kpisPorTipo = kpisDept
  const kpiIdsEnLista = useMemo(() => new Set(kpisPorTipo.map((k) => k._id)), [kpisPorTipo])
  const kpiHuerfano = Boolean(form.kpi_id && !kpiIdsEnLista.has(form.kpi_id))

  const puedeGestionarParticipantes = editing
    ? proyectoPuedeGestionarParticipantes(editing)
    : true

  const equipoSinFicha = useMemo(() => {
    const ids = [form.usuario_id, ...participantesDraft.map((p) => p.usuario_id)].filter(Boolean)
    return ids
      .map((id) => usuarios.find((u) => u._id === id))
      .filter((u): u is UsuarioDoc => Boolean(u && !empleadoIdFromUsuario(u)))
  }, [form.usuario_id, participantesDraft, usuarios])

  function mensajePaso(n: number): string | null {
    if (n === 0 && !form._id.trim()) return 'Indica el código del proyecto.'
    if (n === 0 && !form.nombre.trim()) return 'Escribe el nombre del proyecto.'
    if (n === 1 && !form.usuario_id) return 'Elige quién lleva el proyecto. Esa persona forma parte del equipo.'
    return null
  }

  function irAPaso(n: number) {
    setPasoError(null)
    setPaso(n)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (wizard && paso < PASOS_NUEVO.length - 1) {
      const msg = mensajePaso(paso)
      setPasoError(msg)
      if (!msg) setPaso((p) => p + 1)
      return
    }
    const msg = wizard ? mensajePaso(paso) : null
    if (msg) {
      setPasoError(msg)
      return
    }
    if (!form._id.trim() || !form.nombre.trim()) return
    setSaving(true)
    try {
      const payload = toPayload(form, isEdit)
      if (isEdit) {
        delete payload.porcentaje_avance
        delete payload.estado
      }
      await onSave(payload)
      const pid = isEdit ? editing!._id : form._id.trim()
      const participantesPayload = participantesDraft.map((p) => ({
        usuario_id: p.usuario_id,
        rol: p.rol,
      }))
      if (isEdit || participantesPayload.length > 0) {
        await updateProyectoParticipantes(pid, participantesPayload)
      }
      if (variant === 'page') {
        onPageSaved?.(pid)
      } else {
        onOpenChange(false)
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const title = isEdit ? 'Actualizar proyecto' : 'Nuevo proyecto'

  const formInner = (
    <>
      {variant === 'page' && (
        <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-border pb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="size-4" />
            Volver
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--navy)]">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {isEdit
                ? 'Cambia lo esencial y guarda. Lo demás está en las secciones de abajo.'
                : `Paso ${paso + 1} de ${PASOS_NUEVO.length}. ${PASOS_NUEVO[paso]?.label}.`}
            </p>
          </div>
          {isEdit ? (
            <span className="ml-auto rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {form._id}
            </span>
          ) : null}
        </div>
      )}
      {variant === 'dialog' && (
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {isEdit
              ? 'Cambia lo que necesites. Empresas, KPI y presupuesto están plegados.'
              : `Paso ${paso + 1} de ${PASOS_NUEVO.length}: ${PASOS_NUEVO[paso]?.label}.`}
          </p>
        </DialogHeader>
      )}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {wizard && (
            <ol className="flex flex-wrap gap-2">
              {PASOS_NUEVO.map((p, i) => {
                const activo = i === paso
                const listo = i < paso
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium',
                        activo && 'bg-[var(--navy)] text-white',
                        listo && 'bg-[var(--lime-lt)] text-[var(--navy)]',
                        !activo && !listo && 'bg-muted text-muted-foreground',
                      )}
                      onClick={() => {
                        if (i <= paso) irAPaso(i)
                      }}
                    >
                      {i + 1}. {p.label}
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
          {pasoError && <p className="text-xs text-destructive">{pasoError}</p>}
          {(!wizard || paso === 0) && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-[var(--navy)]">Datos principales</p>
            {!isEdit && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="p-id">Código</Label>
                  <Input
                    id="p-id"
                    required
                    value={form._id}
                    onChange={(e) => setForm((s) => ({ ...s, _id: e.target.value }))}
                    placeholder="Se genera solo"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="p-tipo">Tipo</Label>
                  <select
                    id="p-tipo"
                    className={selectClass}
                    value={form.tipo}
                    onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value as ProyectoTipo }))}
                  >
                    <option value="individual">Individual</option>
                    <option value="departamental">Del área</option>
                  </select>
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="p-nombre">Nombre <span className="text-destructive">*</span></Label>
              <Input
                id="p-nombre" required
                value={form.nombre}
                onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
                placeholder="Ej. Renovar VPN corporativa"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-desc">Para qué es (opcional)</Label>
              <Textarea
                id="p-desc" rows={2}
                value={form.descripcion}
                onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
                placeholder="Una o dos líneas para el equipo"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="p-fi">Inicio</Label>
                <Input
                  id="p-fi" type="date"
                  value={form.fecha_inicio}
                  onChange={(e) => setForm((s) => ({ ...s, fecha_inicio: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-ff">Fin</Label>
                <Input
                  id="p-ff" type="date"
                  value={form.fecha_fin}
                  onChange={(e) => setForm((s) => ({ ...s, fecha_fin: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="p-prio">Prioridad</Label>
                <select
                  id="p-prio"
                  className={selectClass}
                  value={form.prioridad}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, prioridad: e.target.value as ProyectoPrioridad }))
                  }
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
              {!isEdit ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="p-est">Estado inicial</Label>
                  <select
                    id="p-est"
                    className={selectClass}
                    value={form.estado}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, estado: e.target.value as ProyectoEstado }))
                    }
                  >
                    {PROYECTO_ESTADOS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="self-end text-xs text-muted-foreground">
                  Avance {avanceActual ?? editing?.porcentaje_avance ?? 0}%. El estado se cambia en el tablero.
                </p>
              )}
            </div>
            {!wizard && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1"><User className="size-3.5" /> Quién lo lleva</Label>
                <select
                  className={selectClass}
                  value={form.usuario_id}
                  onChange={(e) => setForm((s) => ({ ...s, usuario_id: e.target.value }))}
                  disabled={!puedeAsignarOtro && !isEdit && form.usuario_id === user?._id}
                >
                  <option value="">— Sin propietario —</option>
                  {usuarios.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.nombre}{u._id === user?._id ? ' (tú)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1"><Building2 className="size-3.5" /> Área</Label>
                <select
                  className={selectClass}
                  value={form.departamento_id}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((s) => ({ ...s, departamento_id: v, kpi_id: '', meta_kpi: '' }))
                  }}
                >
                  <option value="">— Sin departamento —</option>
                  {departamentos.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.codigo} · {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            )}
          </div>
          )}

          {wizard && paso === 1 && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="text-sm font-semibold text-[var(--navy)]">Equipo</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Quien lleva el proyecto y las personas que invites. Al asignar una tarea solo aparece este equipo.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1"><User className="size-3.5" /> Quién lo lleva</Label>
                <select
                  className={selectClass}
                  value={form.usuario_id}
                  onChange={(e) => setForm((s) => ({ ...s, usuario_id: e.target.value }))}
                  disabled={!puedeAsignarOtro && form.usuario_id === user?._id}
                >
                  <option value="">— Elige a alguien —</option>
                  {usuarios.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.nombre}{u._id === user?._id ? ' (tú)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <ProyectoParticipantesEditor
                ownerId={form.usuario_id || null}
                draft={participantesDraft}
                onChange={setParticipantesDraft}
                usuarios={usuarios}
                puedeGestionar={puedeGestionarParticipantes}
              />
              {equipoSinFicha.length > 0 && (
                <p className="text-xs text-amber-800">
                  Sin ficha de empleado, no se pueden asignar tareas a:{' '}
                  {equipoSinFicha.map((u) => u.nombre).join(', ')}.
                </p>
              )}
            </div>
          )}

          {(!wizard || paso === 2) && (
          <FormSection
            title="Organización"
            hint="Área, fase y empresas del grupo"
            open={wizard || openOrg}
            onToggle={() => { if (!wizard) setOpenOrg((v) => !v) }}
          >
            {wizard && (
              <div className="grid gap-1.5">
                <Label className="flex items-center gap-1"><Building2 className="size-3.5" /> Área</Label>
                <select
                  className={selectClass}
                  value={form.departamento_id}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((s) => ({ ...s, departamento_id: v, kpi_id: '', meta_kpi: '' }))
                  }}
                >
                  <option value="">— Sin departamento —</option>
                  {departamentos.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.codigo} · {d.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isEdit && (
              <div className="grid gap-1.5">
                <Label htmlFor="p-tipo">Tipo</Label>
                <select
                  id="p-tipo"
                  className={selectClass}
                  value={form.tipo}
                  onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value as ProyectoTipo }))}
                >
                  <option value="individual">Individual</option>
                  <option value="departamental">Del área</option>
                </select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="p-fase">Fase</Label>
                <select
                  id="p-fase"
                  className={selectClass}
                  value={form.fase}
                  onChange={(e) => setForm((s) => ({ ...s, fase: e.target.value }))}
                >
                  <option value="">— Sin fase —</option>
                  <option value="1">Fase 1</option>
                  <option value="2">Fase 2</option>
                  <option value="3">Fase 3</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5">
                <Factory className="size-3.5 text-muted-foreground" />
                Empresas
              </Label>
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border border-border bg-background p-2">
                {empresas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay empresas en el catálogo.</p>
                ) : (
                  empresas.map((e) => (
                    <label
                      key={e._id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--lime)]"
                        checked={form.empresa_ids.includes(e._id)}
                        onChange={() => {
                          setForm((s) => ({
                            ...s,
                            empresa_ids: s.empresa_ids.includes(e._id)
                              ? s.empresa_ids.filter((id) => id !== e._id)
                              : [...s.empresa_ids, e._id],
                          }))
                        }}
                      />
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: e.color ?? '#002060' }}
                      />
                      <span>{e.nombre}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </FormSection>
          )}

          {(!wizard || paso === 3) && (
          <FormSection
            title="KPI y presupuesto"
            hint="Opcional. El gasto ejecutado se suma desde las tareas."
            open={wizard || openMeta}
            onToggle={() => { if (!wizard) setOpenMeta((v) => !v) }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="p-kpi-dep">KPI del área</Label>
              <select
                id="p-kpi-dep"
                className={selectClass}
                disabled={!deptParaKpis || kpisPorTipo.length === 0}
                value={form.kpi_id}
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) {
                    setForm((s) => ({ ...s, kpi_id: '', meta_kpi: '' }))
                    return
                  }
                  const k = kpisPorTipo.find((x) => x._id === id) ?? kpisDept.find((x) => x._id === id)
                  const meta = (k?.meta?.trim() || k?.nombre?.trim() || '').trim()
                  setForm((s) => ({ ...s, kpi_id: id, meta_kpi: meta }))
                }}
              >
                <option value="">— Sin KPI —</option>
                {kpiHuerfano && (
                  <option value={form.kpi_id}>(KPI guardado, no está en esta lista)</option>
                )}
                {kpisPorTipo.map((k) => (
                  <option key={k._id} value={k._id}>
                    {k.nombre}
                    {k.meta ? ` — ${k.meta}` : ''}
                  </option>
                ))}
              </select>
              {!deptParaKpis ? (
                <p className="text-xs text-muted-foreground">Elige un área para ver sus KPIs.</p>
              ) : kpisPorTipo.length === 0 ? (
                <p className="text-xs text-muted-foreground">Este área aún no tiene KPIs.</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="p-moneda">Moneda</Label>
                <select
                  id="p-moneda"
                  className={selectClass}
                  value={form.moneda_presupuesto}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      moneda_presupuesto: e.target.value === 'USD' ? 'USD' : 'HNL',
                    }))
                  }
                >
                  <option value="HNL">HNL (Lempiras)</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-pres-plan">Presupuesto planificado</Label>
                <Input
                  id="p-pres-plan"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.presupuesto_planificado}
                  onChange={(e) => setForm((s) => ({ ...s, presupuesto_planificado: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-pres-notas">Nota de presupuesto</Label>
              <Input
                id="p-pres-notas"
                placeholder="PO, contrato, cuenta SAP…"
                value={form.presupuesto_notas}
                onChange={(e) => setForm((s) => ({ ...s, presupuesto_notas: e.target.value }))}
              />
            </div>
          </FormSection>
          )}

          {!wizard && (
          <FormSection
            title="Más personas"
            hint="Invitados y un responsable en texto, si hace falta"
            open={openEquipo}
            onToggle={() => setOpenEquipo((v) => !v)}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="p-resp">Responsable (texto)</Label>
              <Input
                id="p-resp"
                value={form.responsable}
                onChange={(e) => setForm((s) => ({ ...s, responsable: e.target.value }))}
                placeholder="Solo si no es el propietario"
              />
            </div>
            <ProyectoParticipantesEditor
              ownerId={form.usuario_id || null}
              draft={participantesDraft}
              onChange={setParticipantesDraft}
              usuarios={usuarios}
              puedeGestionar={puedeGestionarParticipantes}
            />
          </FormSection>
          )}

          {(!wizard || paso === 3) && (
          <FormSection
            title="Notas"
            hint="Recordatorios internos"
            open={wizard || openNotas}
            onToggle={() => { if (!wizard) setOpenNotas((v) => !v) }}
          >
            <Textarea
              id="p-notas"
              rows={3}
              value={form.notas}
              onChange={(e) => setForm((s) => ({ ...s, notas: e.target.value }))}
              placeholder="Algo que el equipo deba tener presente"
            />
          </FormSection>
          )}

          <div
            className={
              variant === 'page'
                ? 'sticky bottom-0 z-10 mt-8 flex flex-wrap justify-end gap-2 border-t border-border bg-[var(--gray-bg)] pt-4 pb-2'
                : 'contents'
            }
          >
            {variant === 'dialog' ? (
              <DialogFooter className="gap-2 sm:gap-0">
                {wizard && paso > 0 ? (
                  <Button type="button" variant="outline" onClick={() => irAPaso(paso - 1)}>
                    Atrás
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                >
                  {saving
                    ? 'Guardando…'
                    : wizard && paso < PASOS_NUEVO.length - 1
                      ? 'Siguiente'
                      : isEdit
                        ? 'Guardar cambios'
                        : 'Crear proyecto'}
                </Button>
              </DialogFooter>
            ) : (
              <>
                {wizard && paso > 0 ? (
                  <Button type="button" variant="outline" onClick={() => irAPaso(paso - 1)}>
                    Atrás
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                >
                  {saving
                    ? 'Guardando…'
                    : wizard && paso < PASOS_NUEVO.length - 1
                      ? 'Siguiente'
                      : isEdit
                        ? 'Guardar cambios'
                        : 'Crear proyecto'}
                </Button>
              </>
            )}
          </div>
        </form>
    </>
  )

  if (variant === 'page') {
    return (
      <div className="w-full pb-10">
        {formInner}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {formInner}
      </DialogContent>
    </Dialog>
  )
}

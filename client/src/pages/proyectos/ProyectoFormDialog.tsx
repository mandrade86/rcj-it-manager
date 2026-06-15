import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Building2, Factory, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchEjesProyecto } from '@/lib/api/ejesProyecto'
import { fetchEmpresas } from '@/lib/api/empresas'
import { fetchKpis } from '@/lib/api/kpis'
import { updateProyectoParticipantes } from '@/lib/api/proyectos'
import { kpiMatchesProyectoEje } from '@/lib/kpiProyectoVinculo'
import { fetchUsuarios } from '@/lib/api/usuarios'
import { ProyectoParticipantesEditor, type ParticipanteDraft } from '@/pages/proyectos/ProyectoParticipantesEditor'
import { useAuthStore } from '@/store/authStore'
import type { DepartamentoDoc } from '@/types/departamento'
import type { EjeProyectoDoc } from '@/types/ejeProyecto'
import type { EmpresaDoc } from '@/types/empresa'
import type { KpiDoc } from '@/types/kpi'
import type { UsuarioDoc } from '@/types/usuario'
import type {
  Proyecto, ProyectoEstado, ProyectoFase, ProyectoPrioridad, ProyectoTipo,
} from '@/types/proyecto'
import {
  PROYECTO_ESTADOS, participanteUsuarioId, proyectoDeptId, proyectoEmpresaIdList,
  proyectoKpiId, proyectoOwnerId, proyectoPuedeGestionarParticipantes,
} from '@/types/proyecto'

const EJE_GENERAL = 'General'

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
  notas: string
  empresa_ids: string[]
}

function emptyForm(defaults: {
  usuario_id?: string | null
  departamento_id?: string | null
  eje?: string
}): FormState {
  return {
    _id: '',
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
    notas: p.notas ?? '',
    empresa_ids: proyectoEmpresaIdList(p),
  }
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
  const [ejesMaestro, setEjesMaestro] = useState<EjeProyectoDoc[]>([])
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
  const isEdit = Boolean(editing)

  const active = variant === 'page' || open

  useEffect(() => {
    if (!active) return
    let cancel = false
    void (async () => {
      try {
        const [deps, emps, usrs, ejes] = await Promise.all([
          fetchDepartamentos().catch(() => [] as DepartamentoDoc[]),
          fetchEmpresas({ activo: true }).catch(() => [] as EmpresaDoc[]),
          fetchUsuarios().catch(() => [] as UsuarioDoc[]),
          fetchEjesProyecto({ activo: true }).catch(() => [] as EjeProyectoDoc[]),
        ])
        if (cancel) return
        setDepartamentos(deps)
        setEjesMaestro(ejes)
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
      setForm(fromProyecto(editing))
      setParticipantesDraft(
        (editing.participantes ?? []).map((p, i) => ({
          key: p._id ?? `p-${i}`,
          usuario_id: participanteUsuarioId(p) ?? '',
          rol: p.rol === 'editor' ? 'editor' : 'lectura',
        })).filter((p) => p.usuario_id),
      )
    } else {
      setForm(emptyForm({
        usuario_id: user?._id,
        departamento_id: user?.departamento_id ?? null,
        eje: EJE_GENERAL,
      }))
      setParticipantesDraft([])
    }
  }, [active, editing, user?._id, user?.departamento_id])

  const propietarioDefault = useMemo(() => {
    if (editing) return null
    return user
  }, [editing, user])

  const ejesDisponibles = useMemo(() => {
    const nombresMaestro = [...ejesMaestro]
      .filter((e) => e.activo !== false)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre))
      .map((e) => e.nombre)

    const dept = departamentos.find((d) => d._id === form.departamento_id)
    const deptEjes = (dept?.ejes_proyecto ?? []).map((x) => x.trim()).filter(Boolean)

    const legacyPool = (): string[] => {
      const base: string[] = dept?.ejes_proyecto?.length
        ? dept.ejes_proyecto
        : departamentos.flatMap((d) => d.ejes_proyecto ?? [])
      return [...new Set(base.map((x) => x.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      )
    }

    if (nombresMaestro.length > 0) {
      let pool =
        deptEjes.length > 0
          ? nombresMaestro.filter((n) => deptEjes.includes(n))
          : [...nombresMaestro]
      for (const d of deptEjes) {
        if (!pool.includes(d)) pool.push(d)
      }
      if (nombresMaestro.includes(EJE_GENERAL) && !pool.includes(EJE_GENERAL)) {
        pool.unshift(EJE_GENERAL)
      }
      pool.sort((a, b) => {
        if (a === EJE_GENERAL) return -1
        if (b === EJE_GENERAL) return 1
        return a.localeCompare(b)
      })
      if (form.eje && !pool.includes(form.eje)) pool = [form.eje, ...pool]
      return pool
    }

    const unique = legacyPool()
    if (form.eje && !unique.includes(form.eje)) unique.unshift(form.eje)
    return unique
  }, [departamentos, ejesMaestro, form.departamento_id, form.eje])

  const kpisPorTipo = useMemo(() => {
    if (!form.eje.trim()) return kpisDept
    return kpisDept.filter((k) => kpiMatchesProyectoEje(k, form.eje))
  }, [kpisDept, form.eje])

  const kpiIdsEnLista = useMemo(() => new Set(kpisPorTipo.map((k) => k._id)), [kpisPorTipo])
  const kpiHuerfano = Boolean(form.kpi_id && !kpiIdsEnLista.has(form.kpi_id))

  const puedeGestionarParticipantes = editing
    ? proyectoPuedeGestionarParticipantes(editing)
    : true

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

  const title = isEdit ? 'Editar proyecto' : 'Nuevo proyecto'

  const formInner = (
    <>
      {variant === 'page' && (
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
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
          <h1 className="text-xl font-semibold text-[var(--navy)]">{title}</h1>
        </div>
      )}
      {variant === 'dialog' && (
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {!isEdit && propietarioDefault && (
            <p className="text-xs text-muted-foreground">
              Por defecto, el propietario serás tú (<strong>{propietarioDefault.nombre}</strong>).
              Puedes cambiarlo abajo si tienes permisos.
            </p>
          )}
        </DialogHeader>
      )}
      {variant === 'page' && !isEdit && propietarioDefault && (
        <p className="-mt-2 mb-2 text-xs text-muted-foreground">
          Por defecto, el propietario serás tú (<strong>{propietarioDefault.nombre}</strong>).
          Puedes cambiarlo abajo si tienes permisos.
        </p>
      )}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="p-id">ID del proyecto <span className="text-destructive">*</span></Label>
              <Input
                id="p-id" required
                disabled={isEdit}
                value={form._id}
                onChange={(e) => setForm((s) => ({ ...s, _id: e.target.value }))}
                placeholder="P-001, MKT-2026-01…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-tipo">Tipo</Label>
              <select
                id="p-tipo"
                className={selectClass}
                value={form.tipo}
                onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value as ProyectoTipo }))}
              >
                <option value="individual">Individual (de un usuario)</option>
                <option value="departamental">Departamental (del área)</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-nombre">Nombre <span className="text-destructive">*</span></Label>
            <Input
              id="p-nombre" required
              value={form.nombre}
              onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="p-desc">Descripción</Label>
            <Textarea
              id="p-desc" rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="flex items-center gap-1"><User className="size-3.5" /> Propietario</Label>
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
            <div className="grid gap-2">
              <Label className="flex items-center gap-1"><Building2 className="size-3.5" /> Departamento</Label>
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

          <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3">
            <Label className="flex items-center gap-1.5 text-sm">
              <Factory className="size-3.5 text-muted-foreground" />
              Empresas del grupo involucradas
            </Label>
            <p className="text-xs text-muted-foreground">
              Marca una o varias empresas RCJ a las que aplica este proyecto (opcional).
            </p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
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
                    <span className="font-mono text-[10px] text-muted-foreground">{e.codigo}</span>
                    <span>{e.nombre}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="p-eje">Eje / Categoría</Label>
              <select
                id="p-eje"
                className={selectClass}
                value={form.eje}
                onChange={(e) => setForm((s) => ({ ...s, eje: e.target.value }))}
              >
                <option value="">— Sin eje —</option>
                {ejesDisponibles.map((eje) => (
                  <option key={eje} value={eje}>{eje}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Catálogo en Maestro · Ejes de proyecto; por departamento se eligen los aplicables en
                Maestro · Departamentos.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-fase">Fase (opcional)</Label>
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

          <div className="grid gap-2">
            <Label htmlFor="p-resp">Responsable (texto libre, opcional)</Label>
            <Input
              id="p-resp"
              value={form.responsable}
              onChange={(e) => setForm((s) => ({ ...s, responsable: e.target.value }))}
              placeholder="Si difiere del propietario o lo importas desde Excel"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="p-fi">Fecha inicio</Label>
              <Input
                id="p-fi" type="date"
                value={form.fecha_inicio}
                onChange={(e) => setForm((s) => ({ ...s, fecha_inicio: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-ff">Fecha fin</Label>
              <Input
                id="p-ff" type="date"
                value={form.fecha_fin}
                onChange={(e) => setForm((s) => ({ ...s, fecha_fin: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
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
            {!isEdit && (
              <div className="grid gap-2">
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
            )}
          </div>

          {isEdit && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              El estado del proyecto se cambia desde el panel de detalle (botones de flujo).
              Avance actual: <strong>{avanceActual ?? editing?.porcentaje_avance ?? 0}%</strong>.
            </p>
          )}

          <div className="grid gap-2 rounded-md border border-border bg-muted/20 p-3">
            <Label htmlFor="p-kpi-dep">KPI / meta (catálogo del departamento)</Label>
            <p className="text-xs text-muted-foreground">
              KPIs del departamento con el mismo tipo (eje) que el proyecto. Si cambias el eje del
              proyecto, la lista se actualiza.
            </p>
            {!deptParaKpis ? (
              <p className="text-xs text-amber-900">
                Indica un departamento en el proyecto o en tu perfil para cargar el catálogo de KPIs.
              </p>
            ) : kpisPorTipo.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {form.eje.trim()
                  ? `No hay KPIs para el eje «${form.eje}» en este departamento. Créalos en KPIs / Metas.`
                  : 'Indica el eje del proyecto o crea KPIs en KPIs / Metas.'}
              </p>
            ) : null}
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
              <option value="">— Sin KPI vinculado —</option>
              {kpiHuerfano && (
                <option value={form.kpi_id}>
                  (KPI guardado no está en la lista del departamento mostrado)
                </option>
              )}
              {kpisPorTipo.map((k) => (
                <option key={k._id} value={k._id}>
                  {k.nombre}
                  {k.meta ? ` — meta: ${k.meta}` : ''}
                </option>
              ))}
            </select>
            {form.meta_kpi.trim() !== '' && (
              <p className="text-xs text-muted-foreground">
                Meta objetivo: <strong>{form.meta_kpi}</strong>
              </p>
            )}
            {kpiHuerfano && (
              <p className="text-xs text-amber-900">
                Ajusta el departamento del proyecto o elige un KPI de la lista para alinear la meta
                con el departamento.
              </p>
            )}
          </div>

          <ProyectoParticipantesEditor
            ownerId={form.usuario_id || null}
            draft={participantesDraft}
            onChange={setParticipantesDraft}
            usuarios={usuarios}
            puedeGestionar={puedeGestionarParticipantes}
          />

          <div className="grid gap-2">
            <Label htmlFor="p-notas">Notas</Label>
            <Textarea
              id="p-notas" rows={3}
              value={form.notas}
              onChange={(e) => setForm((s) => ({ ...s, notas: e.target.value }))}
            />
          </div>

          <div
            className={
              variant === 'page'
                ? 'sticky bottom-0 z-10 mt-8 flex flex-wrap justify-end gap-2 border-t border-border bg-[var(--gray-bg)] pt-4 pb-2'
                : 'contents'
            }
          >
            {variant === 'dialog' ? (
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </DialogFooter>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            )}
          </div>
        </form>
    </>
  )

  if (variant === 'page') {
    return (
      <div className="mx-auto w-full max-w-5xl pb-10">
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

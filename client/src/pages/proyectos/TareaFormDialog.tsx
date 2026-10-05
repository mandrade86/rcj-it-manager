import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmpleadoSearchSelect } from '@/components/empleados/EmpleadoSearchSelect'
import { TareaTagsInput } from '@/components/proyectos/TareaTagsInput'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fetchEmpleados } from '@/lib/api/empleados'
import { diasEntre, finDesdeDuracion, hoyIso, isoDia } from '@/lib/fechasTarea'
import { collectTagsFromTareas } from '@/lib/tareaTags'
import { ESTADOS_BASE, fetchTareaEstados, type TareaEstadoDef } from '@/lib/tareaBoardPrefs'
import type { EmpleadoDoc } from '@/types/empleado'
import type { Tarea, TareaPrioridad } from '@/types/tarea'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type FormState = {
  nombre: string
  descripcion: string
  responsable: string
  responsable_id: string
  fecha_inicio: string
  fecha_fin: string
  duracion_dias: string
  estado: string
  prioridad: TareaPrioridad | ''
  monto_asignado: string
  monto_ejecutado: string
  porcentaje: string
  depende_de_ids: string[]
  tags: string[]
}

function emptyForm(inicioProyecto?: string | null): FormState {
  const fecha_inicio = isoDia(inicioProyecto) || hoyIso()
  const duracion_dias = '5'
  return {
    nombre: '',
    descripcion: '',
    responsable: '',
    responsable_id: '',
    fecha_inicio,
    fecha_fin: finDesdeDuracion(fecha_inicio, 5),
    duracion_dias,
    estado: 'Pendiente',
    prioridad: '',
    monto_asignado: '',
    monto_ejecutado: '',
    porcentaje: '0',
    depende_de_ids: [],
    tags: [],
  }
}

function duracionDeTarea(t: Tarea): string {
  const inicio = t.fecha_inicio ? t.fecha_inicio.slice(0, 10) : ''
  const fin = t.fecha_fin ? t.fecha_fin.slice(0, 10) : ''
  if (inicio && fin) {
    const dias = diasEntre(inicio, fin)
    if (dias >= 1) return String(dias)
  }
  if (t.duracion_dias != null && t.duracion_dias >= 1) return String(t.duracion_dias)
  return ''
}

function fromTarea(t: Tarea): FormState {
  return {
    nombre: t.nombre,
    descripcion: t.descripcion ?? '',
    responsable: t.responsable ?? '',
    responsable_id: t.responsable_id ?? '',
    fecha_inicio: t.fecha_inicio ? t.fecha_inicio.slice(0, 10) : '',
    fecha_fin: t.fecha_fin ? t.fecha_fin.slice(0, 10) : '',
    duracion_dias: duracionDeTarea(t),
    estado: t.estado,
    prioridad: t.prioridad ?? '',
    monto_asignado:
      t.monto_asignado != null && Number.isFinite(t.monto_asignado) ? String(t.monto_asignado) : '',
    monto_ejecutado:
      t.monto_ejecutado != null && Number.isFinite(t.monto_ejecutado) ? String(t.monto_ejecutado) : '',
    porcentaje: String(t.porcentaje ?? 0),
    depende_de_ids: [...(t.depende_de_ids ?? [])],
    tags: [...(t.tags ?? [])],
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proyectoId: string
  proyectoEje: string
  /** Fecha de arranque del proyecto. Las tareas nuevas inician aquí. */
  proyectoInicio?: string | null
  editing: Tarea | null
  tareasProyecto: Tarea[]
  /** Empleados del equipo del proyecto. La asignación solo ofrece esta lista. */
  equipoEmpleadoIds: string[]
  onSave: (payload: Record<string, unknown>) => Promise<void>
}

export function TareaFormDialog({
  open,
  onOpenChange,
  proyectoId,
  proyectoEje,
  proyectoInicio,
  editing,
  tareasProyecto,
  equipoEmpleadoIds,
  onSave,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    editing ? fromTarea(editing) : emptyForm(proyectoInicio),
  )
  const [saving, setSaving] = useState(false)
  const [empleados, setEmpleados] = useState<EmpleadoDoc[]>([])
  const [estados, setEstados] = useState<TareaEstadoDef[]>(ESTADOS_BASE)
  const isEdit = Boolean(editing)

  useEffect(() => {
    if (!open) return
    void fetchTareaEstados().then(setEstados).catch(() => setEstados(ESTADOS_BASE))
  }, [open])

  const candidatasDependencia = useMemo(
    () => tareasProyecto
      .filter((t) => t._id !== editing?._id)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [tareasProyecto, editing?._id],
  )

  const tagSugerencias = useMemo(
    () => collectTagsFromTareas(tareasProyecto),
    [tareasProyecto],
  )

  function toggleDependencia(id: string) {
    setForm((s) => {
      const set = new Set(s.depende_de_ids)
      if (set.has(id)) set.delete(id)
      else set.add(id)
      return { ...s, depende_de_ids: [...set] }
    })
  }

  useEffect(() => {
    if (!open) return
    setForm(editing ? fromTarea(editing) : emptyForm(proyectoInicio))
  }, [open, editing, proyectoInicio])

  useEffect(() => {
    let alive = true
    fetchEmpleados({ activo: true })
      .then((list) => { if (alive) setEmpleados(list) })
      .catch(() => { if (alive) setEmpleados([]) })
    return () => { alive = false }
  }, [])

  /** Si el empleado actual (por nombre) no está en la lista activa, lo agregamos
   * como opción para no perderlo al buscar. */
  const empleadosConLegacy = useMemo(() => {
    const ids = new Set(equipoEmpleadoIds)
    const list = empleados.filter((e) => ids.has(String(e._id)))
    if (form.responsable_id && !list.some((e) => String(e._id) === form.responsable_id)) {
      const actual = empleados.find((e) => String(e._id) === form.responsable_id)
      if (actual) list.unshift(actual)
    }
    if (form.responsable && !list.some((e) =>
      String(e._id) === form.responsable_id || e.nombre === form.responsable,
    )) {
      list.unshift({
        _id: `__legacy__:${form.responsable}`,
        codigo: '',
        nombre: form.responsable,
        activo: false,
      } as EmpleadoDoc)
    }
    return list
  }, [empleados, equipoEmpleadoIds, form.responsable, form.responsable_id])

  function handleResponsableChange(next: { responsable: string; responsable_id: string }) {
    setForm((s) => ({
      ...s,
      responsable: next.responsable,
      responsable_id: next.responsable_id,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    if (!isEdit) {
      if (!form.responsable_id && !form.responsable.trim()) {
        window.alert('Indica el asignado.')
        return
      }
      if (!form.estado || !form.prioridad || !form.fecha_fin.trim()) {
        window.alert('Indica estado, prioridad y fecha.')
        return
      }
    }
    setSaving(true)
    try {
      const o: Record<string, unknown> = {
        proyecto_id: proyectoId,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        responsable: form.responsable.trim() || undefined,
        responsable_id: form.responsable_id || null,
        estado: form.estado,
        prioridad: form.prioridad || null,
        porcentaje: Number(form.porcentaje) || 0,
        monto_asignado: (() => {
          const t = form.monto_asignado.trim().replace(/,/g, '')
          if (!t) return null
          const n = Number(t)
          return Number.isFinite(n) ? n : null
        })(),
        monto_ejecutado: (() => {
          const t = form.monto_ejecutado.trim().replace(/,/g, '')
          if (!t) return null
          const n = Number(t)
          return Number.isFinite(n) ? n : null
        })(),
        eje: proyectoEje,
        depende_de_ids: form.depende_de_ids,
        tags: form.tags,
        duracion_dias: (() => {
          const n = Math.floor(Number(form.duracion_dias))
          return Number.isFinite(n) && n >= 1 ? n : null
        })(),
      }
      if (form.fecha_inicio.trim()) {
        o.fecha_inicio = new Date(`${form.fecha_inicio.trim()}T12:00:00`)
      } else {
        o.fecha_inicio = null
      }
      if (form.fecha_fin.trim()) {
        o.fecha_fin = new Date(`${form.fecha_fin.trim()}T12:00:00`)
      } else {
        o.fecha_fin = null
      }
      await onSave(o)
      onOpenChange(false)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Error al guardar tarea')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="t-nom">Nombre</Label>
            <Input
              id="t-nom"
              required
              value={form.nombre}
              onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-desc">Descripción</Label>
            <Textarea
              id="t-desc"
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm((s) => ({ ...s, descripcion: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-resp">Responsable</Label>
            <EmpleadoSearchSelect
              id="t-resp"
              soloCatalogo
              empleados={empleadosConLegacy.filter((e) => !String(e._id).startsWith('__legacy__:'))}
              value={{ responsable: form.responsable, responsable_id: form.responsable_id }}
              onChange={handleResponsableChange}
              placeholder="Buscar en el equipo…"
            />
            <p className="text-xs text-muted-foreground">
              Solo aparecen las personas del equipo del proyecto.
            </p>
          </div>
          <TareaTagsInput
            id="t-tags"
            value={form.tags}
            onChange={(tags) => setForm((s) => ({ ...s, tags }))}
            suggestions={tagSugerencias}
          />
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-fi">Inicio</Label>
              <Input
                id="t-fi"
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => {
                  const fecha_inicio = e.target.value
                  setForm((s) => {
                    const n = Math.floor(Number(s.duracion_dias))
                    if (fecha_inicio && Number.isFinite(n) && n >= 1) {
                      return { ...s, fecha_inicio, fecha_fin: finDesdeDuracion(fecha_inicio, n) }
                    }
                    return { ...s, fecha_inicio }
                  })
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-dur">Duración (días)</Label>
              <Input
                id="t-dur"
                type="number"
                min={1}
                step={1}
                value={form.duracion_dias}
                onChange={(e) => {
                  const duracion_dias = e.target.value
                  setForm((s) => {
                    const n = Math.floor(Number(duracion_dias))
                    if (s.fecha_inicio && Number.isFinite(n) && n >= 1) {
                      return { ...s, duracion_dias, fecha_fin: finDesdeDuracion(s.fecha_inicio, n) }
                    }
                    return { ...s, duracion_dias }
                  })
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-ff">Fin</Label>
              <Input
                id="t-ff"
                type="date"
                value={form.fecha_fin}
                onChange={(e) => {
                  const fecha_fin = e.target.value
                  setForm((s) => {
                    if (s.fecha_inicio && fecha_fin) {
                      const dias = diasEntre(s.fecha_inicio, fecha_fin)
                      if (dias >= 1) return { ...s, fecha_fin, duracion_dias: String(dias) }
                    }
                    return { ...s, fecha_fin }
                  })
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            El inicio toma la fecha de arranque del proyecto. La duración calcula el fin
            (el mismo día cuenta como 1).
          </p>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-est">Estado</Label>
              <select
                id="t-est"
                className={selectClass}
                value={form.estado}
                onChange={(e) =>
                  setForm((s) => ({ ...s, estado: e.target.value }))
                }
              >
                {!estados.some((x) => x.clave === form.estado) && (
                  <option value={form.estado}>{form.estado}</option>
                )}
                {estados.map((e) => (
                  <option key={e.clave} value={e.clave}>{e.etiqueta}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-pri">Prioridad</Label>
              <select
                id="t-pri"
                className={selectClass}
                value={form.prioridad}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    prioridad: e.target.value as TareaPrioridad | '',
                  }))
                }
              >
                <option value="">— Sin prioridad —</option>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>
          <div className="grid gap-2">
              <Label htmlFor="t-pct">% avance</Label>
              <Input
                id="t-pct"
                type="number"
                min={0}
                max={100}
                value={form.porcentaje}
                onChange={(e) => setForm((s) => ({ ...s, porcentaje: e.target.value }))}
              />
          </div>
          <div className="grid gap-3 rounded-md border border-[var(--navy)]/15 bg-[var(--blue-lt)]/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
              Presupuesto de la tarea
            </p>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="t-monto-asig">Monto asignado</Label>
                <Input
                  id="t-monto-asig"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.monto_asignado}
                  onChange={(e) => setForm((s) => ({ ...s, monto_asignado: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-monto-ejec">Monto ejecutado (opcional)</Label>
                <Input
                  id="t-monto-ejec"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Auto por % avance"
                  value={form.monto_ejecutado}
                  onChange={(e) => setForm((s) => ({ ...s, monto_ejecutado: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Si no indicas ejecutado, el sistema estima: asignado × % avance (o 100% si está Completado).
              Los montos se suman al presupuesto del proyecto.
            </p>
          </div>
          {candidatasDependencia.length > 0 && (
            <div className="grid gap-2">
              <Label>Depende de (predecesoras)</Label>
              <p className="text-xs text-muted-foreground">
                Estas tareas deben completarse antes. No se permiten dependencias circulares.
              </p>
              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
                {candidatasDependencia.map((t) => (
                  <label
                    key={t._id}
                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 accent-[var(--navy)]"
                      checked={form.depende_de_ids.includes(t._id)}
                      onChange={() => toggleDependencia(t._id)}
                    />
                    <span className="min-w-0 flex-1 leading-snug">
                      {t.nombre}
                      <span className="ml-1 text-xs text-muted-foreground">({t.estado})</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            El KPI / meta se gestiona a nivel del proyecto, no de cada tarea.
            Para adjuntar archivos a esta tarea, guarda primero y usa el botón
            <span className="font-medium"> &laquo;Adjuntos&raquo;</span> en el detalle.
          </p>
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
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { EmpleadoSearchSelect } from '@/components/empleados/EmpleadoSearchSelect'
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
import type { EmpleadoDoc } from '@/types/empleado'
import type { Tarea, TareaEstado } from '@/types/tarea'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type FormState = {
  nombre: string
  descripcion: string
  responsable: string
  responsable_id: string
  fecha_inicio: string
  fecha_fin: string
  estado: TareaEstado
  porcentaje: string
  depende_de_ids: string[]
}

function emptyForm(): FormState {
  return {
    nombre: '',
    descripcion: '',
    responsable: '',
    responsable_id: '',
    fecha_inicio: '',
    fecha_fin: '',
    estado: 'Pendiente',
    porcentaje: '0',
    depende_de_ids: [],
  }
}

function fromTarea(t: Tarea): FormState {
  return {
    nombre: t.nombre,
    descripcion: t.descripcion ?? '',
    responsable: t.responsable ?? '',
    responsable_id: t.responsable_id ?? '',
    fecha_inicio: t.fecha_inicio ? t.fecha_inicio.slice(0, 10) : '',
    fecha_fin: t.fecha_fin ? t.fecha_fin.slice(0, 10) : '',
    estado: t.estado,
    porcentaje: String(t.porcentaje ?? 0),
    depende_de_ids: [...(t.depende_de_ids ?? [])],
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  proyectoId: string
  proyectoEje: string
  editing: Tarea | null
  tareasProyecto: Tarea[]
  onSave: (payload: Record<string, unknown>) => Promise<void>
}

export function TareaFormDialog({
  open,
  onOpenChange,
  proyectoId,
  proyectoEje,
  editing,
  tareasProyecto,
  onSave,
}: Props) {
  const [form, setForm] = useState<FormState>(() =>
    editing ? fromTarea(editing) : emptyForm(),
  )
  const [saving, setSaving] = useState(false)
  const [empleados, setEmpleados] = useState<EmpleadoDoc[]>([])
  const isEdit = Boolean(editing)

  const candidatasDependencia = useMemo(
    () => tareasProyecto
      .filter((t) => t._id !== editing?._id)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [tareasProyecto, editing?._id],
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
    setForm(editing ? fromTarea(editing) : emptyForm())
  }, [open, editing])

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
    const list = [...empleados]
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
  }, [empleados, form.responsable, form.responsable_id])

  function handleResponsableChange(next: { responsable: string; responsable_id: string }) {
    setForm((s) => ({
      ...s,
      responsable: next.responsable,
      responsable_id: next.responsable_id,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const o: Record<string, unknown> = {
        proyecto_id: proyectoId,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
        responsable: form.responsable.trim() || undefined,
        responsable_id: form.responsable_id || null,
        estado: form.estado,
        porcentaje: Number(form.porcentaje) || 0,
        eje: proyectoEje,
        depende_de_ids: form.depende_de_ids,
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
              empleados={empleadosConLegacy.filter((e) => !String(e._id).startsWith('__legacy__:'))}
              value={{ responsable: form.responsable, responsable_id: form.responsable_id }}
              onChange={handleResponsableChange}
            />
            <p className="text-xs text-muted-foreground">
              Escribe para buscar en el directorio de empleados o deja un nombre manual.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-fi">Inicio</Label>
              <Input
                id="t-fi"
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => setForm((s) => ({ ...s, fecha_inicio: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-ff">Fin</Label>
              <Input
                id="t-ff"
                type="date"
                value={form.fecha_fin}
                onChange={(e) => setForm((s) => ({ ...s, fecha_fin: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-est">Estado</Label>
              <select
                id="t-est"
                className={selectClass}
                value={form.estado}
                onChange={(e) =>
                  setForm((s) => ({ ...s, estado: e.target.value as TareaEstado }))
                }
              >
                <option value="Pendiente">Pendiente</option>
                <option value="En progreso">En progreso</option>
                <option value="Completado">Completado</option>
                <option value="Bloqueado">Bloqueado</option>
              </select>
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

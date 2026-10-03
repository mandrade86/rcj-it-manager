import { useEffect, useState, type FormEvent } from 'react'

import { EmpleadoSearchSelect } from '@/components/empleados/EmpleadoSearchSelect'
import { Button } from '@/components/ui/button'
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
import { createTarea, updateTarea, type TareaMia } from '@/lib/api/tareas'
import { useAuthStore } from '@/store/authStore'
import type { EmpleadoDoc } from '@/types/empleado'
import type { TareaPrioridad } from '@/types/tarea'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: TareaMia | null
  onSaved: () => void
  onDeleted?: () => void
}

export function TareaRapidaDialog({ open, onOpenChange, editing, onSaved, onDeleted }: Props) {
  const user = useAuthStore((s) => s.user)
  const [empleados, setEmpleados] = useState<EmpleadoDoc[]>([])
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [responsable, setResponsable] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [prioridad, setPrioridad] = useState<TareaPrioridad | ''>('Media')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchEmpleados({ activo: true })
      .then((list) => setEmpleados(list))
      .catch(() => setEmpleados([]))
  }, [open])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setNombre(editing.nombre)
      setDescripcion(editing.descripcion ?? '')
      setResponsable(editing.responsable)
      setResponsableId(editing.responsable_id)
      setFechaFin(editing.fecha_fin ? editing.fecha_fin.slice(0, 10) : '')
      setPrioridad((editing.prioridad as TareaPrioridad) || 'Media')
      return
    }
    setNombre('')
    setDescripcion('')
    setFechaFin('')
    setPrioridad('Media')
    const self = user?.empleado_id
      ? { id: user.empleado_id, nombre: user.empleado_nombre || user.nombre }
      : { id: '', nombre: user?.nombre ?? '' }
    setResponsableId(self.id)
    setResponsable(self.nombre)
  }, [open, editing, user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        responsable: responsable.trim() || undefined,
        responsable_id: responsableId || null,
        fecha_fin: fechaFin || null,
        prioridad: prioridad || null,
        estado: editing?.estado ?? 'Pendiente',
      }
      if (editing) await updateTarea(editing._id, body)
      else await createTarea(body)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo guardar la tarea')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            No hace falta un proyecto. Asígnala a una persona y listo.
          </p>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tr-nombre">Qué hay que hacer</Label>
            <Input
              id="tr-nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Revisar accesos de LASA"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Asignar a</Label>
            <EmpleadoSearchSelect
              empleados={empleados}
              value={{ responsable, responsable_id: responsableId }}
              onChange={(v) => {
                setResponsable(v.responsable)
                setResponsableId(v.responsable_id)
              }}
              placeholder="Buscar colaborador…"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tr-fin">Vence</Label>
              <Input id="tr-fin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tr-prio">Prioridad</Label>
              <select
                id="tr-prio"
                className={selectClass}
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as TareaPrioridad | '')}
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
                <option value="">Sin prioridad</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tr-desc">Detalle (opcional)</Label>
            <Textarea
              id="tr-desc"
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing && onDeleted ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={onDeleted}
              >
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                {saving ? 'Guardando…' : editing ? 'Guardar' : 'Asignar tarea'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

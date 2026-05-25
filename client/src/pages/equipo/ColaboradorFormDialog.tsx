import { useEffect, useState } from 'react'

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
import { fetchDepartamentos } from '@/lib/api/departamentos'
import { fetchPerfilesPuesto } from '@/lib/api/perfilesPuesto'
import type { DepartamentoDoc } from '@/types/departamento'
import type { PerfilPuestoDoc } from '@/types/perfilPuesto'
import type { Colaborador, ColaboradorEstado } from '@/types/colaborador'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

type FormState = {
  codigo: string
  nombre: string
  puesto: string
  codigo_puesto: string
  frente: string
  nivel: '' | 'Junior' | 'Mid-Senior' | 'Senior'
  estado: ColaboradorEstado
  salario_mensual: string
  fecha_ingreso: string
  notas: string
  departamento_id: string
  perfil_puesto_id: string
}

function emptyForm(): FormState {
  return {
    codigo: '',
    nombre: '',
    puesto: '',
    codigo_puesto: '',
    frente: '',
    nivel: '',
    estado: 'Activo',
    salario_mensual: '',
    fecha_ingreso: '',
    notas: '',
    departamento_id: '',
    perfil_puesto_id: '',
  }
}

function fromColaborador(c: Colaborador): FormState {
  return {
    codigo: c.codigo,
    nombre: c.nombre,
    puesto: c.puesto,
    codigo_puesto: c.codigo_puesto,
    frente: c.frente,
    nivel: (c.nivel ?? '') as FormState['nivel'],
    estado: c.estado,
    salario_mensual:
      c.salario_mensual != null && !Number.isNaN(c.salario_mensual)
        ? String(c.salario_mensual)
        : '',
    fecha_ingreso: c.fecha_ingreso ? c.fecha_ingreso.slice(0, 10) : '',
    notas: c.notas ?? '',
    departamento_id: typeof c.departamento_id === 'string' ? c.departamento_id : '',
    perfil_puesto_id: typeof c.perfil_puesto_id === 'string' ? c.perfil_puesto_id : '',
  }
}

function toPayload(f: FormState): Record<string, unknown> {
  const o: Record<string, unknown> = {
    codigo: f.codigo.trim(),
    nombre: f.nombre.trim(),
    puesto: f.puesto.trim(),
    codigo_puesto: f.codigo_puesto.trim(),
    frente: f.frente.trim() || 'General',
    estado: f.estado,
    departamento_id: f.departamento_id || null,
    perfil_puesto_id: f.perfil_puesto_id || null,
  }
  o.nivel = f.nivel === '' ? null : f.nivel
  const sal = f.salario_mensual.trim()
  if (sal === '') o.salario_mensual = undefined
  else o.salario_mensual = Number(sal)
  if (f.fecha_ingreso.trim()) {
    o.fecha_ingreso = new Date(`${f.fecha_ingreso.trim()}T12:00:00`)
  } else {
    o.fecha_ingreso = null
  }
  const notas = f.notas.trim()
  o.notas = notas === '' ? null : notas
  return o
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Colaborador | null
  onSave: (payload: Record<string, unknown>) => Promise<void>
}

export function ColaboradorFormDialog({ open, onOpenChange, editing, onSave }: Props) {
  const [form, setForm] = useState<FormState>(() =>
    editing ? fromColaborador(editing) : emptyForm(),
  )
  const [saving, setSaving] = useState(false)
  const [depts, setDepts] = useState<DepartamentoDoc[]>([])
  const [perfiles, setPerfiles] = useState<PerfilPuestoDoc[]>([])

  useEffect(() => {
    if (!open) return
    setForm(editing ? fromColaborador(editing) : emptyForm())
    Promise.all([fetchDepartamentos(), fetchPerfilesPuesto()])
      .then(([d, p]) => { setDepts(d); setPerfiles(p) })
      .catch(() => {/* non-critical */})
  }, [open, editing])

  const filteredPerfiles = form.departamento_id
    ? perfiles.filter((p) => {
        const d = p.departamento_id
        if (!d) return false
        return typeof d === 'string' ? d === form.departamento_id : (d as DepartamentoDoc)._id === form.departamento_id
      })
    : perfiles

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(toPayload(form))
      onOpenChange(false)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const isEdit = Boolean(editing)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar colaborador' : 'Agregar colaborador'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="codigo">Código (ej. IT-04A)</Label>
            <Input
              id="codigo"
              required
              disabled={isEdit}
              value={form.codigo}
              onChange={(e) => set('codigo', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" required value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="puesto">Puesto</Label>
            <Input id="puesto" required value={form.puesto} onChange={(e) => set('puesto', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="codigo_puesto">Código de puesto</Label>
            <Input id="codigo_puesto" required value={form.codigo_puesto} onChange={(e) => set('codigo_puesto', e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="departamento_id">Departamento</Label>
            <select
              id="departamento_id"
              className={selectClass}
              value={form.departamento_id}
              onChange={(e) => { set('departamento_id', e.target.value); set('perfil_puesto_id', '') }}
            >
              <option value="">— Sin departamento —</option>
              {depts.filter((d) => d.activo).map((d) => (
                <option key={d._id} value={d._id}>{d.nombre} ({d.codigo})</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="perfil_puesto_id">Perfil de puesto</Label>
            <select
              id="perfil_puesto_id"
              className={selectClass}
              value={form.perfil_puesto_id}
              onChange={(e) => {
                const val = e.target.value
                set('perfil_puesto_id', val)
                if (val) {
                  const p = perfiles.find((x) => x._id === val)
                  if (p) {
                    if (!form.puesto) set('puesto', p.titulo)
                    if (!form.codigo_puesto) set('codigo_puesto', p.codigo)
                  }
                }
              }}
            >
              <option value="">— Sin perfil —</option>
              {filteredPerfiles.map((p) => (
                <option key={p._id} value={p._id}>{p.titulo} ({p.codigo})</option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="frente">Frente / Área</Label>
            <Input
              id="frente"
              required
              placeholder="Desarrollo, Infraestructura, Jefatura…"
              value={form.frente}
              onChange={(e) => set('frente', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nivel">Nivel</Label>
            <select
              id="nivel"
              className={selectClass}
              value={form.nivel}
              onChange={(e) => set('nivel', e.target.value as FormState['nivel'])}
            >
              <option value="">—</option>
              <option value="Junior">Junior</option>
              <option value="Mid-Senior">Mid-Senior</option>
              <option value="Senior">Senior</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="estado">Estado</Label>
            <select
              id="estado"
              className={selectClass}
              value={form.estado}
              onChange={(e) => set('estado', e.target.value as ColaboradorEstado)}
            >
              <option value="Activo">Activo</option>
              <option value="Por contratar">Por contratar</option>
              <option value="Futuro">Futuro</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="salario">Salario mensual (Lps)</Label>
            <Input
              id="salario"
              type="number"
              min={0}
              step="1"
              value={form.salario_mensual}
              onChange={(e) => set('salario_mensual', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fecha_ingreso">Fecha de ingreso</Label>
            <Input
              id="fecha_ingreso"
              type="date"
              value={form.fecha_ingreso}
              onChange={(e) => set('fecha_ingreso', e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              rows={3}
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
            />
          </div>
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

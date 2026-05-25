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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { SistemaIT } from '@/types/itArquitectura'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: SistemaIT | null
  onSave: (body: Partial<SistemaIT>) => Promise<void>
  saving?: boolean
}

function empty(): Partial<SistemaIT> {
  return {
    nombre: '',
    descripcion: '',
    estado: 'stable',
    stack: '',
    integraciones: '',
    responsable: '',
    notas: '',
    tags: [],
    orden: 0,
  }
}

export function SistemaDialog({ open, onOpenChange, initial, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<SistemaIT>>(empty())
  const [tagsStr, setTagsStr] = useState('')

  useEffect(() => {
    if (initial) {
      setForm({ ...initial })
      setTagsStr((initial.tags ?? []).join(', '))
    } else {
      setForm(empty())
      setTagsStr('')
    }
  }, [initial, open])

  async function handleSubmit() {
    if (!form.nombre?.trim() || !form.stack?.trim()) return
    await onSave({
      ...form,
      nombre: form.nombre.trim(),
      stack: form.stack.trim(),
      tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar sistema' : 'Nuevo sistema'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Nombre *</Label>
            <Input value={form.nombre ?? ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </div>
          <div>
            <Label>Stack *</Label>
            <Input value={form.stack ?? ''} onChange={(e) => setForm({ ...form, stack: e.target.value })} />
          </div>
          <div>
            <Label>Estado</Label>
            <Select value={form.estado ?? 'stable'} onValueChange={(v) => setForm({ ...form, estado: v as SistemaIT['estado'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">Estable</SelectItem>
                <SelectItem value="warning">Advertencia</SelectItem>
                <SelectItem value="legacy">Legacy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Integraciones</Label>
            <Input value={form.integraciones ?? ''} onChange={(e) => setForm({ ...form, integraciones: e.target.value })} />
          </div>
          <div>
            <Label>Responsable</Label>
            <Input value={form.responsable ?? ''} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
          </div>
          <div>
            <Label>Tags (separados por coma)</Label>
            <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} />
          </div>
          <div>
            <Label>Orden</Label>
            <Input type="number" value={form.orden ?? 0} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea rows={3} value={form.notas ?? ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
import type { ApiEndpointIT } from '@/types/itArquitectura'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (body: Partial<ApiEndpointIT>) => Promise<void>
}

function empty(): Partial<ApiEndpointIT> {
  return {
    grupo: '',
    metodo: 'GET',
    path: '',
    descripcion: '',
    version: 'v1',
    notas: '',
    orden: 0,
  }
}

export function EndpointDialog({ open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState<Partial<ApiEndpointIT>>(empty())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setForm(empty())
  }, [open])

  async function handleSubmit() {
    if (!form.grupo?.trim() || !form.path?.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        grupo: form.grupo.trim(),
        path: form.path.trim(),
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo endpoint</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Grupo *</Label>
            <Input value={form.grupo ?? ''} onChange={(e) => setForm({ ...form, grupo: e.target.value })} placeholder="eTickets" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Método</Label>
              <Select value={form.metodo ?? 'GET'} onValueChange={(v) => setForm({ ...form, metodo: v as ApiEndpointIT['metodo'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versión</Label>
              <Input value={form.version ?? 'v1'} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Path *</Label>
            <Input value={form.path ?? ''} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="/api/v1/..." />
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notas ?? ''} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
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

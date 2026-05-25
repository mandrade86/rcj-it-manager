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
import { getDeudaJiraSugerenciaApi } from '@/lib/api/itArquitectura'
import type { DeudaTecnica } from '@/types/itArquitectura'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: DeudaTecnica | null
  onSave: (body: Partial<DeudaTecnica>) => Promise<void>
  saving?: boolean
}

function empty(): Partial<DeudaTecnica> {
  return {
    titulo: '',
    sistema: '',
    severidad: 'medium',
    riesgo: '',
    descripcion: '',
    urgencia: 50,
    estado: 'abierta',
    responsable: '',
    trimestre_roadmap: '',
  }
}

export function DeudaDialog({ open, onOpenChange, initial, onSave, saving }: Props) {
  const [form, setForm] = useState<Partial<DeudaTecnica>>(empty())
  const [sugBusy, setSugBusy] = useState(false)

  useEffect(() => {
    setForm(initial ? { ...initial } : empty())
  }, [initial, open])

  async function handleSubmit() {
    if (!form.titulo?.trim() || !form.sistema?.trim()) return
    await onSave({
      ...form,
      titulo: form.titulo.trim(),
      sistema: form.sistema.trim(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar deuda técnica' : 'Nueva deuda técnica'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo ?? ''} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </div>
          <div>
            <Label>Sistema *</Label>
            <Input value={form.sistema ?? ''} onChange={(e) => setForm({ ...form, sistema: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severidad</Label>
              <Select value={form.severidad ?? 'medium'} onValueChange={(v) => setForm({ ...form, severidad: v as DeudaTecnica['severidad'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado ?? 'abierta'} onValueChange={(v) => setForm({ ...form, estado: v as DeudaTecnica['estado'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierta">Abierta</SelectItem>
                  <SelectItem value="en_progreso">En progreso</SelectItem>
                  <SelectItem value="resuelta">Resuelta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Urgencia (0-100)</Label>
            <Input type="number" min={0} max={100} value={form.urgencia ?? 50} onChange={(e) => setForm({ ...form, urgencia: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Riesgo</Label>
            <Input value={form.riesgo ?? ''} onChange={(e) => setForm({ ...form, riesgo: e.target.value })} />
          </div>
          <div>
            <Label>Trimestre roadmap</Label>
            <Input value={form.trimestre_roadmap ?? ''} onChange={(e) => setForm({ ...form, trimestre_roadmap: e.target.value })} placeholder="Q4 2026" />
          </div>
          <div>
            <Label>Responsable</Label>
            <Input value={form.responsable ?? ''} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <Label>Descripción</Label>
              {initial?._id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={sugBusy}
                  onClick={() => {
                    setSugBusy(true)
                    void getDeudaJiraSugerenciaApi(initial._id)
                      .then((s) => {
                        const bloque = [
                          form.descripcion?.trim(),
                          '--- Qué hacer ---',
                          ...s.que_hacer.map((p) => `• ${p}`),
                          '--- Qué aplicar ---',
                          ...s.que_aplicar.map((p) => `• ${p}`),
                        ]
                          .filter(Boolean)
                          .join('\n')
                        setForm({ ...form, descripcion: bloque })
                      })
                      .catch((e) =>
                        window.alert(e instanceof Error ? e.message : 'No se pudo cargar sugerencia'),
                      )
                      .finally(() => setSugBusy(false))
                  }}
                >
                  {sugBusy ? 'Generando…' : 'Insertar sugerencias'}
                </Button>
              )}
            </div>
            <Textarea rows={5} value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
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

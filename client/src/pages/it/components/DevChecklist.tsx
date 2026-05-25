import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useChecklistItemsIT } from '@/pages/it/hooks/useITData'

export function DevChecklist() {
  const { items, loading, error, create } = useChecklistItemsIT()
  const canEdit = useAuthStore((s) => s.hasPermiso('it:arquitectura:editar'))
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoria, setCategoria] = useState('Arquitectura')
  const [texto, setTexto] = useState('')
  const [saving, setSaving] = useState(false)

  const byCategoria = useMemo(() => {
    const m = new Map<string, typeof items>()
    for (const it of items) {
      const list = m.get(it.categoria) ?? []
      list.push(it)
      m.set(it.categoria, list)
    }
    return [...m.entries()]
  }, [items])

  const total = items.length
  const done = checked.size
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAdd() {
    if (!texto.trim()) return
    setSaving(true)
    try {
      await create({ categoria: categoria.trim(), texto: texto.trim(), orden: items.length + 1 })
      setTexto('')
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[200px] flex-1">
          <p className="text-sm font-medium">
            {done} / {total} verificados
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-[var(--lime)] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 size-4" />
            Item
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando checklist…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {byCategoria.map(([cat, list]) => (
        <Card key={cat}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pb-3 pt-0">
            {list.map((it) => (
              <button
                key={it._id}
                type="button"
                onClick={() => toggle(it._id)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted/60',
                  checked.has(it._id) && 'bg-[var(--lime-lt)]',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border',
                    checked.has(it._id)
                      ? 'border-[var(--lime)] bg-[var(--lime)] text-white'
                      : 'border-border',
                  )}
                >
                  {checked.has(it._id) && <Check className="size-3" />}
                </span>
                <span className={cn(checked.has(it._id) && 'line-through text-muted-foreground')}>
                  {it.texto}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar item al checklist</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Categoría</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
            </div>
            <div>
              <Label>Texto</Label>
              <Input value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleAdd()} disabled={saving}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

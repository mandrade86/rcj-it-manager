import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ESTADOS_BASE,
  fetchTareaEstados,
  saveTareaEstados,
  type GrupoEstado,
  type TareaEstadoDef,
} from '@/lib/tareaBoardPrefs'

const GRUPOS: Array<{ id: GrupoEstado; label: string }> = [
  { id: 'por_hacer', label: 'Por hacer' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'detenido', label: 'Detenido' },
  { id: 'listo', label: 'Listo' },
]

export function TareaEstadosDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (list: TareaEstadoDef[]) => void
}) {
  const [rows, setRows] = useState<TareaEstadoDef[]>(ESTADOS_BASE)
  const [nuevo, setNuevo] = useState('')
  const [grupo, setGrupo] = useState<GrupoEstado>('por_hacer')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchTareaEstados().then(setRows).catch(() => setRows(ESTADOS_BASE))
  }, [open])

  async function guardar() {
    setSaving(true)
    try {
      const saved = await saveTareaEstados(rows)
      onSaved(saved)
      onOpenChange(false)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Estados de las tareas</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.clave} className="grid grid-cols-[auto_1fr_140px_auto] items-center gap-2">
              <input
                type="color"
                value={row.color}
                aria-label={`Color de ${row.etiqueta}`}
                onChange={(e) => setRows(rows.map((r, n) => n === i ? { ...r, color: e.target.value } : r))}
              />
              <Input
                value={row.etiqueta}
                className="h-8"
                onChange={(e) => setRows(rows.map((r, n) => n === i ? { ...r, etiqueta: e.target.value } : r))}
              />
              <select
                className="h-8 rounded-md border px-2 text-sm"
                value={row.grupo}
                onChange={(e) => setRows(rows.map((r, n) => n === i ? { ...r, grupo: e.target.value as GrupoEstado } : r))}
              >
                {GRUPOS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
              {row.sistema ? (
                <span className="text-[10px] text-muted-foreground">base</span>
              ) : (
                <button type="button" className="text-xs text-destructive" onClick={() => setRows(rows.filter((_, n) => n !== i))}>Quitar</button>
              )}
            </div>
          ))}
          <form className="flex gap-2 pt-2" onSubmit={(e) => {
            e.preventDefault()
            const etiqueta = nuevo.trim()
            if (!etiqueta) return
            const clave = etiqueta
            if (rows.some((r) => r.clave.toLowerCase() === clave.toLowerCase())) return
            setRows([...rows, { clave, etiqueta, color: '#1f4e79', grupo, sistema: false }])
            setNuevo('')
          }}>
            <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nuevo estado" className="h-8" />
            <select className="h-8 rounded-md border px-2 text-sm" value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoEstado)}>
              {GRUPOS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            <Button type="submit" variant="outline" className="h-8">Agregar</Button>
          </form>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={saving} className="bg-[var(--navy)] text-white" onClick={() => void guardar()}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

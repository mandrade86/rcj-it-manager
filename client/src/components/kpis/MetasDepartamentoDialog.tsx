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
import { updateDepartamentoMetas } from '@/lib/api/departamentos'
import {
  META_TIPO_CALCULO_LABELS,
  META_TIPOS_CALCULO,
  type MetaTipoCalculo,
} from '@/lib/kpiCalculoTipos'
import { metasEditorFromDepartamento, plantillaMetasEstrategicas } from '@/lib/metasDepartamento'
import type { DepartamentoDoc, MetaEstrategicaDepto } from '@/types/departamento'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type Props = {
  departamento: DepartamentoDoc | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (doc: DepartamentoDoc) => void
  readOnly?: boolean
}

export function MetasDepartamentoDialog({
  departamento,
  open,
  onOpenChange,
  onSaved,
  readOnly = false,
}: Props) {
  const [metas, setMetas] = useState<MetaEstrategicaDepto[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && departamento) {
      setMetas(metasEditorFromDepartamento(departamento))
      setDirty(false)
    }
  }, [open, departamento])

  function patchMeta(id: MetaEstrategicaDepto['id'], patch: Partial<MetaEstrategicaDepto>) {
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    setDirty(true)
  }

  async function handleSave() {
    if (!departamento || readOnly) return
    setSaving(true)
    try {
      const updated = await updateDepartamentoMetas(departamento._id, metas)
      setDirty(false)
      onSaved?.(updated)
      onOpenChange(false)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudieron guardar las metas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Metas anuales del departamento
            {departamento ? ` — ${departamento.codigo} · ${departamento.nombre}` : ''}
          </DialogTitle>
        </DialogHeader>
        {!departamento ? (
          <p className="text-sm text-muted-foreground">Selecciona un departamento.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Define las metas estratégicas del departamento (normalmente 5). Los KPIs se vinculan a
              una meta; el avance se calcula según el tipo de agregación que elijas. No se precargan
              solas: usa la plantilla solo si lo deseas.
            </p>
            {metas.length === 0 && !readOnly ? (
              <div className="rounded-md border border-dashed border-[var(--navy)]/25 bg-[var(--blue-lt)]/30 p-4 text-sm">
                <p className="text-muted-foreground">
                  Este departamento aún no tiene metas configuradas.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setMetas(plantillaMetasEstrategicas())
                    setDirty(true)
                  }}
                >
                  Usar plantilla de 5 metas (RH)
                </Button>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {metas.map((me) => (
                <div
                  key={me.id}
                  className="space-y-2 rounded-md border border-border bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      {me.id}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--lime)]"
                        checked={me.activa !== false}
                        disabled={readOnly}
                        onChange={(e) => patchMeta(me.id, { activa: e.target.checked })}
                      />
                      Activa
                    </label>
                  </div>
                  <Input
                    value={me.titulo}
                    disabled={readOnly}
                    onChange={(e) => patchMeta(me.id, { titulo: e.target.value })}
                    placeholder="Título de la meta"
                  />
                  <Textarea
                    rows={2}
                    value={me.objetivo}
                    disabled={readOnly}
                    onChange={(e) => patchMeta(me.id, { objetivo: e.target.value })}
                    placeholder="Objetivo / descripción"
                  />
                  <Input
                    value={me.valor_objetivo ?? ''}
                    disabled={readOnly}
                    onChange={(e) => patchMeta(me.id, { valor_objetivo: e.target.value })}
                    placeholder="Valor objetivo (ej. ≥ 99.7%)"
                  />
                  <div className="grid gap-1">
                    <Label className="text-xs">Cálculo del avance</Label>
                    <select
                      className={selectClass}
                      value={me.tipo_calculo ?? 'promedio_kpis'}
                      disabled={readOnly}
                      onChange={(e) =>
                        patchMeta(me.id, {
                          tipo_calculo: e.target.value as MetaTipoCalculo,
                        })
                      }
                    >
                      {META_TIPOS_CALCULO.map((t) => (
                        <option key={t} value={t}>
                          {META_TIPO_CALCULO_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!readOnly && departamento && (
            <Button
              type="button"
              disabled={!dirty || saving}
              className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              onClick={() => void handleSave()}
            >
              {saving ? 'Guardando…' : 'Guardar metas'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Save, Target, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { fetchKpis } from '@/lib/api/kpis'
import {
  fetchKpisEvaluacionPerfil,
  updateKpisEvaluacionPerfil,
} from '@/lib/api/perfilesPuesto'
import { useAuthStore } from '@/store/authStore'
import type { KpiDoc } from '@/types/kpi'
import { kpiDepartamentoId } from '@/types/kpi'
import type { PerfilPuestoDoc } from '@/types/perfilPuesto'
import { deptFromPerfil } from '@/types/perfilPuesto'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

type ItemForm = {
  kpi_id: string
  peso: number
  descripcion: string
}

type Props = {
  perfil: PerfilPuestoDoc | null
  onClose: () => void
  onSaved?: () => void
}

export function KpisEvaluacionDialog({ perfil, onClose, onSaved }: Props) {
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const esAdmin = hasPermiso('*')

  const [items, setItems] = useState<ItemForm[]>([])
  const [allKpis, setAllKpis] = useState<KpiDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [addKpiId, setAddKpiId] = useState('')

  const cargar = useCallback(async (p: PerfilPuestoDoc) => {
    setLoading(true)
    setErr(null)
    try {
      const dept = deptFromPerfil(p)
      const [config, kpisData] = await Promise.all([
        fetchKpisEvaluacionPerfil(p._id),
        fetchKpis(dept ? { departamento_id: dept._id } : undefined),
      ])
      setItems(
        config.items.map((it) => ({
          kpi_id: typeof it.kpi_id === 'string' ? it.kpi_id : (it.kpi?._id ?? ''),
          peso: it.peso,
          descripcion: it.descripcion ?? '',
        })),
      )
      // Si algún kpi de la config no está en la lista del depto (fue movido o eliminado),
      // lo agregamos a allKpis sintéticamente
      const kpiMap = new Map(kpisData.map((k) => [k._id, k]))
      for (const it of config.items) {
        if (it.kpi && !kpiMap.has(it.kpi._id)) {
          kpiMap.set(it.kpi._id, {
            _id: it.kpi._id,
            eje: it.kpi.eje ?? '',
            nombre: it.kpi.nombre,
            meta: it.kpi.meta,
            unidad: it.kpi.unidad,
            frecuencia: it.kpi.frecuencia,
          } as KpiDoc)
        }
      }
      setAllKpis([...kpiMap.values()])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perfil) {
      setItems([])
      setAddKpiId('')
      void cargar(perfil)
    }
  }, [perfil, cargar])

  const totalPeso = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.peso) || 0), 0),
    [items],
  )

  const kpisDisponibles = useMemo(() => {
    const usados = new Set(items.map((it) => it.kpi_id))
    return allKpis.filter((k) => !usados.has(k._id))
  }, [allKpis, items])

  const kpisDepto = useMemo(() => {
    if (!perfil) return allKpis
    const deptId = deptFromPerfil(perfil)?._id
    if (!deptId) return allKpis
    return kpisDisponibles.filter((k) => kpiDepartamentoId(k) === deptId)
  }, [allKpis, perfil, kpisDisponibles])

  const kpisOtros = useMemo(() => {
    if (!perfil) return [] as KpiDoc[]
    const deptId = deptFromPerfil(perfil)?._id
    if (!deptId) return [] as KpiDoc[]
    return kpisDisponibles.filter((k) => kpiDepartamentoId(k) !== deptId)
  }, [perfil, kpisDisponibles])

  function agregarKpi() {
    if (!addKpiId) return
    setItems((prev) => [
      ...prev,
      { kpi_id: addKpiId, peso: 0, descripcion: '' },
    ])
    setAddKpiId('')
  }

  function eliminarItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function setItemField<K extends keyof ItemForm>(idx: number, k: K, v: ItemForm[K]) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [k]: v } : it)))
  }

  function distribuirEquitativo() {
    if (items.length === 0) return
    const peso = Math.floor((100 / items.length) * 100) / 100
    const resto = Math.round((100 - peso * items.length) * 100) / 100
    setItems((prev) =>
      prev.map((it, i) => ({
        ...it,
        peso: i === 0 ? Math.round((peso + resto) * 100) / 100 : peso,
      })),
    )
  }

  async function guardar() {
    if (!perfil) return
    if (Math.abs(totalPeso - 100) > 0.01) {
      window.alert(`La suma de pesos debe ser 100. Actualmente es ${totalPeso}.`)
      return
    }
    if (items.some((it) => !it.kpi_id || it.peso <= 0)) {
      window.alert('Todos los KPIs deben tener un peso > 0.')
      return
    }
    setSaving(true)
    try {
      await updateKpisEvaluacionPerfil(perfil._id, items)
      onSaved?.()
      onClose()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(perfil)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Target className="size-5 text-[var(--navy)]" />
            Evaluación por cumplimiento de KPI
            {perfil && (
              <span className="text-sm font-normal text-muted-foreground">
                · {perfil.codigo} — {perfil.titulo}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!esAdmin && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Solo el rol <strong>Administrador</strong> puede modificar los KPIs de evaluación
            de un perfil de puesto. Puedes consultar la configuración actual, pero no podrás
            guardar cambios.
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {err && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
        )}

        {!loading && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
              Los KPIs configurados aquí componen la <strong className="text-foreground">
              evaluación por cumplimiento</strong> que se aplica a los colaboradores que tengan
              este perfil. El cumplimiento se calcula automáticamente del último registro de
              cada KPI, ponderado por el peso asignado.
              <p className="mt-1">
                <strong className="text-foreground">Niveles del score global:</strong>{' '}
                ≥110 → Supera · ≥85 → Cumple · ≥60 → Parcial · &lt;60 → No cumple.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Eje</TableHead>
                    <TableHead>KPI</TableHead>
                    <TableHead className="w-[120px]">Meta</TableHead>
                    <TableHead className="w-[110px] text-center">Peso (%)</TableHead>
                    <TableHead>Nota interna</TableHead>
                    <TableHead className="w-[50px] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        No hay KPIs configurados. {esAdmin ? 'Agrega abajo.' : ''}
                      </TableCell>
                    </TableRow>
                  )}
                  {items.map((it, idx) => {
                    const kpi = allKpis.find((k) => k._id === it.kpi_id)
                    return (
                      <TableRow key={idx} className="align-top">
                        <TableCell className="text-xs uppercase text-muted-foreground">
                          {kpi?.eje ?? '—'}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium leading-snug">
                            {kpi?.nombre ?? '(KPI eliminado)'}
                          </p>
                          {kpi?.descripcion && (
                            <p className="text-xs text-muted-foreground">{kpi.descripcion}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {kpi?.meta ?? '—'}{' '}
                          {kpi?.unidad && (
                            <span className="text-xs text-muted-foreground">({kpi.unidad})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            disabled={!esAdmin}
                            value={Number.isFinite(it.peso) ? it.peso : 0}
                            onChange={(e) => setItemField(idx, 'peso', Number(e.target.value))}
                            className="text-center"
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            rows={2}
                            disabled={!esAdmin}
                            placeholder="Aclaración opcional para el evaluador…"
                            value={it.descripcion}
                            onChange={(e) => setItemField(idx, 'descripcion', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {esAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => eliminarItem(idx)}
                              title="Eliminar"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Suma de pesos:</span>
                <Badge
                  variant="outline"
                  className={
                    'border ' +
                    (Math.abs(totalPeso - 100) < 0.01
                      ? 'border-[var(--lime)] text-[var(--lime)]'
                      : 'border-amber-400 text-amber-700')
                  }
                >
                  {totalPeso} / 100
                </Badge>
              </div>
              {esAdmin && items.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={distribuirEquitativo}
                >
                  Distribuir 100% equitativamente
                </Button>
              )}
            </div>

            {esAdmin && (
              <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Agregar KPI
                </Label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className={selectClass + ' max-w-md flex-1'}
                    value={addKpiId}
                    onChange={(e) => setAddKpiId(e.target.value)}
                  >
                    <option value="">Selecciona un KPI…</option>
                    {kpisDepto.length > 0 && (
                      <optgroup label="KPIs del departamento">
                        {kpisDepto.map((k) => (
                          <option key={k._id} value={k._id}>
                            {k.eje} — {k.nombre}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {kpisOtros.length > 0 && (
                      <optgroup label="Otros departamentos">
                        {kpisOtros.map((k) => (
                          <option key={k._id} value={k._id}>
                            {k.eje} — {k.nombre}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={agregarKpi}
                    disabled={!addKpiId}
                    className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
                  >
                    <Plus className="size-4" /> Agregar
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Sugerencia: trata de que cada KPI tenga un peso significativo (≥10%) para
                  que el resultado de la evaluación tenga sensibilidad.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            {esAdmin ? 'Cancelar' : 'Cerrar'}
          </Button>
          {esAdmin && (
            <Button
              type="button"
              onClick={() => void guardar()}
              disabled={saving || items.length === 0}
              className="gap-2 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
            >
              <Save className="size-4" />
              {saving ? 'Guardando…' : 'Guardar configuración'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

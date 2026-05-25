import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Plus, Trash2 } from 'lucide-react'

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
import {
  createRegistroVacacion,
  deleteRegistroVacacion,
  fetchVacacionesEmpleado,
} from '@/lib/api/vacaciones'
import { formatDateDMY } from '@/lib/format'
import type {
  EstadoVacacion,
  VacacionesEmpleadoResponse,
} from '@/types/vacacion'

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function estadoBadgeClass(e: EstadoVacacion): string {
  switch (e) {
    case 'Aprobado':
      return 'bg-[var(--lime-lt)] text-[var(--navy)]'
    case 'Gozado':
      return 'bg-[var(--blue-lt)] text-[var(--navy)]'
    case 'Programado':
      return 'bg-amber-50 text-amber-800 border-amber-300'
    case 'Cancelado':
      return 'bg-red-50 text-red-700 border-red-200 line-through'
    default:
      return ''
  }
}

function diffDiasHabiles(desde: string, hasta: string): number {
  if (!desde || !hasta) return 0
  const a = new Date(desde + 'T00:00:00')
  const b = new Date(hasta + 'T00:00:00')
  if (b.getTime() < a.getTime()) return 0
  let dias = 0
  const cursor = new Date(a)
  while (cursor.getTime() <= b.getTime()) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) dias++
    cursor.setDate(cursor.getDate() + 1)
  }
  return dias
}

type Props = {
  empleadoId: string | null
  open: boolean
  onClose: () => void
  /** Disparar refresh del resumen externo después de cualquier cambio */
  onChanged?: () => void
}

export function VacacionesDialog({ empleadoId, open, onClose, onChanged }: Props) {
  const [data, setData] = useState<VacacionesEmpleadoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formDesde, setFormDesde] = useState('')
  const [formHasta, setFormHasta] = useState('')
  const [formEstado, setFormEstado] = useState<EstadoVacacion>('Aprobado')
  const [formNotas, setFormNotas] = useState('')
  const [formDiasManual, setFormDiasManual] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!empleadoId) return
    setLoading(true)
    setErr(null)
    try {
      const r = await fetchVacacionesEmpleado(empleadoId)
      setData(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [empleadoId])

  useEffect(() => {
    if (open && empleadoId) {
      setShowForm(false)
      setFormDesde('')
      setFormHasta('')
      setFormEstado('Aprobado')
      setFormNotas('')
      setFormDiasManual('')
      void reload()
    }
  }, [open, empleadoId, reload])

  const diasCalculados = useMemo(
    () => diffDiasHabiles(formDesde, formHasta),
    [formDesde, formHasta],
  )

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!empleadoId || !formDesde || !formHasta) return
    setSaving(true)
    try {
      const diasManual = formDiasManual.trim() !== '' ? Number(formDiasManual) : undefined
      await createRegistroVacacion({
        empleado_id: empleadoId,
        fecha_inicio: formDesde,
        fecha_fin: formHasta,
        dias_habiles: Number.isFinite(diasManual as number) ? (diasManual as number) : undefined,
        estado: formEstado,
        notas: formNotas.trim() || undefined,
      })
      setShowForm(false)
      await reload()
      onChanged?.()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'No se pudo registrar')
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(id: string) {
    if (!window.confirm('¿Eliminar este período de vacaciones?')) return
    try {
      await deleteRegistroVacacion(id)
      await reload()
      onChanged?.()
    } catch (ex) {
      window.alert(ex instanceof Error ? ex.message : 'No se pudo eliminar')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-5 text-[var(--navy)]" />
            Vacaciones {data?.empleado ? `— ${data.empleado.nombre}` : ''}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {err && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {!data.empleado.fecha_ingreso ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Este empleado no tiene fecha de ingreso registrada. Edítalo desde
                «Mi equipo» y asígnale la fecha para poder calcular sus vacaciones.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Antigüedad
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
                    {data.calculo.aniosServicio}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">años</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.calculo.mesesServicio} mes(es) adicionales
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Días acumulados
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
                    {data.calculo.diasAcumuladosTotales}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Por años cumplidos + proporcional del año en curso.
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Días gozados
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
                    {data.calculo.diasGozados}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Suma de registros (no cancelados).
                  </p>
                </div>
                <div className="rounded-lg border-2 border-[var(--lime)] bg-[var(--lime-lt)]/40 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--navy)]">
                    Días DISPONIBLES
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--navy)]">
                    {data.calculo.diasDisponibles}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Lo que puede tomar hoy.
                  </p>
                </div>
              </div>
            )}

            {data.empleado.fecha_ingreso && (
              <div className="rounded-lg border bg-card p-3 text-xs">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Fecha de ingreso:</strong>{' '}
                  {formatDateDMY(data.empleado.fecha_ingreso)} ·{' '}
                  <strong className="text-foreground">Derecho del año actual:</strong>{' '}
                  {data.calculo.diasDerechoPorAnioActual} días hábiles ·{' '}
                  <strong className="text-foreground">Próximo aniversario:</strong>{' '}
                  {data.calculo.proximoAniversario
                    ? formatDateDMY(data.calculo.proximoAniversario)
                    : '—'}{' '}
                  ({data.calculo.proximoDerecho} días).
                </p>
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  Cálculo según el Código del Trabajo de Honduras (Art. 346):
                  1 año → 10 días · 2 años → 12 · 3 años → 15 · 4+ años → 20.
                  Los días son <strong>hábiles</strong> (lunes a viernes).
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--navy)]">
                Historial de vacaciones
              </h4>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowForm((v) => !v)}
                className="gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
              >
                <Plus className="size-3.5" />
                Registrar período
              </Button>
            </div>

            {showForm && (
              <form
                onSubmit={(e) => void handleCrear(e)}
                className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="vac-ini">Desde *</Label>
                  <Input
                    id="vac-ini"
                    type="date"
                    required
                    value={formDesde}
                    onChange={(e) => setFormDesde(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="vac-fin">Hasta *</Label>
                  <Input
                    id="vac-fin"
                    type="date"
                    required
                    value={formHasta}
                    onChange={(e) => setFormHasta(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="vac-dias">
                    Días hábiles{' '}
                    <span className="font-normal text-muted-foreground">
                      (auto: {diasCalculados})
                    </span>
                  </Label>
                  <Input
                    id="vac-dias"
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder={String(diasCalculados)}
                    value={formDiasManual}
                    onChange={(e) => setFormDiasManual(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Solo si necesitas ajustar por feriados o medio día.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label>Estado</Label>
                  <select
                    className={selectClass}
                    value={formEstado}
                    onChange={(e) => setFormEstado(e.target.value as EstadoVacacion)}
                  >
                    <option value="Programado">Programado</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Gozado">Gozado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="vac-notas">Notas</Label>
                  <Textarea
                    id="vac-notas"
                    rows={2}
                    value={formNotas}
                    onChange={(e) => setFormNotas(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 sm:col-span-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={saving || !formDesde || !formHasta}
                    className="bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
                  >
                    {saving ? 'Guardando…' : 'Registrar'}
                  </Button>
                </div>
              </form>
            )}

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desde</TableHead>
                    <TableHead>Hasta</TableHead>
                    <TableHead className="w-[110px] text-center">Días háb.</TableHead>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="w-[60px] text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.registros.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        Sin períodos registrados todavía.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.registros.map((r) => (
                    <TableRow key={r._id}>
                      <TableCell className="text-sm">{formatDateDMY(r.fecha_inicio)}</TableCell>
                      <TableCell className="text-sm">{formatDateDMY(r.fecha_fin)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">
                        {r.dias_habiles}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={estadoBadgeClass(r.estado)}>
                          {r.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.notas || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleEliminar(r._id)}
                          title="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type PlanCarreraDoc,
  type PlanCarreraItem,
  updatePlanCarreraItem,
} from '@/lib/api/planCarrera'
import { fetchCapacitaciones } from '@/lib/api/capacitaciones'
import { cn } from '@/lib/utils'
import { colaboradorIdFromAsignado } from '@/types/capacitacion'

const selectClass =
  'flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

const ESTADOS: NonNullable<PlanCarreraItem['estado']>[] = [
  'Pendiente',
  'En progreso',
  'Completado',
]

const ESTADO_LABELS: Record<string, string> = {
  Pendiente: '⬜ Pendiente',
  'En progreso': '🔄 En progreso',
  Completado: '✅ Completado',
}

function tipoLabel(tipo: PlanCarreraDoc['tipo']): string {
  switch (tipo) {
    case 'N2_a_Coord':
      return 'N2 → Coordinador de Infraestructura'
    case 'Jr_a_Mid':
      return 'Programador Junior → Mid-Senior'
    case 'Mid_a_Senior':
      return 'Programador Mid-Senior → Senior'
    default:
      return tipo
  }
}

function EstadoIcon({ estado }: { estado?: PlanCarreraItem['estado'] }) {
  if (estado === 'Completado')
    return <CheckCircle2 className="size-4 shrink-0 text-[var(--lime)]" aria-hidden />
  if (estado === 'En progreso')
    return <RefreshCw className="size-4 shrink-0 text-amber-500" aria-hidden />
  return <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />
}

// Inline notes field — saves on blur when value changed
function NotasInline({
  initial,
  disabled,
  itemId,
  onSave,
}: {
  initial: string
  disabled: boolean
  itemId: string | undefined
  onSave: (v: string) => void
}) {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    setValue(initial)
  }, [initial, itemId])

  return (
    <Input
      className="h-7 min-w-[120px] text-xs"
      disabled={disabled}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initial) onSave(value)
      }}
      placeholder="Notas…"
    />
  )
}

type Props = {
  plan: PlanCarreraDoc
  onUpdated: (doc: PlanCarreraDoc) => void
  colaboradorId?: string
}

export function PlanCarreraChecklist({ plan, onUpdated, colaboradorId }: Props) {
  const [sub, setSub] = useState<'checklist' | 'cap'>('checklist')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [capRows, setCapRows] = useState<
    { capId: string; capNombre: string; estado: string; proveedor?: string }[]
  >([])
  const [capLoading, setCapLoading] = useState(false)

  useEffect(() => {
    if (sub !== 'cap' || !colaboradorId) return
    let cancel = false
    void (async () => {
      setCapLoading(true)
      try {
        const list = await fetchCapacitaciones({ colaborador_id: colaboradorId })
        if (cancel) return
        const rows: { capId: string; capNombre: string; estado: string; proveedor?: string }[] = []
        for (const cap of list) {
          const a = cap.asignados.find((x) => colaboradorIdFromAsignado(x) === colaboradorId)
          if (a) {
            rows.push({
              capId: cap._id,
              capNombre: cap.nombre,
              estado: a.estado ?? 'Pendiente',
              proveedor: cap.proveedor,
            })
          }
        }
        setCapRows(rows)
      } catch {
        if (!cancel) setCapRows([])
      } finally {
        if (!cancel) setCapLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [sub, colaboradorId])

  const grouped = useMemo(() => {
    const map = new Map<string, PlanCarreraItem[]>()
    for (const it of plan.items) {
      const k = it.seccion?.trim() || 'Checklist'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(it)
    }
    return [...map.entries()]
  }, [plan.items])

  const total = plan.items.length
  const completados = plan.items.filter((i) => i.estado === 'Completado').length
  const enProgreso = plan.items.filter((i) => i.estado === 'En progreso').length
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  async function patchItem(
    itemId: string,
    patch: { estado?: PlanCarreraItem['estado']; notas?: string },
  ) {
    setBusyId(itemId)
    try {
      const doc = await updatePlanCarreraItem(itemId, patch)
      onUpdated(doc)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card with progress */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">{tipoLabel(plan.tipo)}</CardTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {plan.periodo_estimado && <span>Periodo estimado: {plan.periodo_estimado}</span>}
            {plan.responsable_seguimiento && (
              <span>Seguimiento: {plan.responsable_seguimiento}</span>
            )}
          </div>
          <div className="space-y-2 pt-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">
                Avance: {completados} / {total} ítems completados
                {enProgreso > 0 ? ` · ${enProgreso} en progreso` : ''}
              </span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--lime)] transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sub-tab switcher */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          type="button"
          variant={sub === 'checklist' ? 'secondary' : 'ghost'}
          size="sm"
          className={sub === 'checklist' ? 'bg-[var(--blue-lt)] text-[var(--navy)]' : ''}
          onClick={() => setSub('checklist')}
        >
          Checklist de requisitos
        </Button>
        <Button
          type="button"
          variant={sub === 'cap' ? 'secondary' : 'ghost'}
          size="sm"
          className={sub === 'cap' ? 'bg-[var(--blue-lt)] text-[var(--navy)]' : ''}
          onClick={() => setSub('cap')}
        >
          Plan de capacitaciones
        </Button>
      </div>

      {/* ── Capacitaciones sub-tab ── */}
      {sub === 'cap' && (
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm">
            {!colaboradorId && (
              <p className="text-muted-foreground">
                No se puede cargar el plan de capacitaciones sin identificador de colaborador.
              </p>
            )}
            {colaboradorId && capLoading && (
              <p className="text-muted-foreground">Cargando capacitaciones asignadas…</p>
            )}
            {colaboradorId && !capLoading && capRows.length === 0 && (
              <p className="text-muted-foreground">
                No hay capacitaciones asignadas. Gestiona el catálogo en{' '}
                <Link className="font-medium text-[var(--navy)] underline" to="/capacitaciones">
                  Capacitaciones
                </Link>
                .
              </p>
            )}
            {colaboradorId && !capLoading && capRows.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Capacitación</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {capRows.map((r) => (
                    <TableRow key={r.capId}>
                      <TableCell className="font-medium">{r.capNombre}</TableCell>
                      <TableCell className="text-muted-foreground">{r.proveedor ?? '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            r.estado === 'Completado'
                              ? 'bg-[var(--lime-lt)] text-[var(--navy)]'
                              : r.estado === 'En progreso'
                                ? 'bg-amber-500/10 text-amber-900'
                                : undefined
                          }
                        >
                          {r.estado}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground">
              El detalle y la edición de estados por persona están en el módulo Capacitaciones y
              en la pestaña Capacitaciones del perfil.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Checklist sub-tab — datatable por sección ── */}
      {sub === 'checklist' && (
        <div className="space-y-6">
          {grouped.map(([seccion, items]) => {
            const secDone = items.filter((i) => i.estado === 'Completado').length
            const secPct = items.length > 0 ? Math.round((secDone / items.length) * 100) : 0

            return (
              <Card key={seccion} className="overflow-hidden">
                <CardHeader className="border-b border-border bg-[var(--blue-lt)]/40 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold text-[var(--navy)]">
                      {seccion}
                    </CardTitle>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {secDone}/{items.length} completados
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-[var(--lime)] transition-[width]"
                            style={{ width: `${secPct}%` }}
                          />
                        </div>
                        <span className="font-medium text-foreground">{secPct}%</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-8 px-3" />
                        <TableHead className="w-14 px-3 text-xs">Código</TableHead>
                        <TableHead className="min-w-[280px] px-3 text-xs">Requisito</TableHead>
                        <TableHead className="w-32 px-3 text-xs">Tipo</TableHead>
                        <TableHead className="w-28 px-3 text-xs">Plazo</TableHead>
                        <TableHead className="w-36 px-3 text-xs">Recurso</TableHead>
                        <TableHead className="w-36 px-3 text-xs">Estado</TableHead>
                        <TableHead className="w-44 px-3 text-xs">Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const itemId = item._id
                        const disabled = busyId === itemId || !itemId
                        const isComplete = item.estado === 'Completado'

                        return (
                          <TableRow
                            key={itemId ?? `${item.codigo}-${item.requisito.slice(0, 20)}`}
                            className={cn(
                              'align-top transition-colors',
                              isComplete && 'bg-[var(--lime-lt)]/30',
                            )}
                          >
                            {/* Status icon */}
                            <TableCell className="px-3 pt-3">
                              <EstadoIcon estado={item.estado} />
                            </TableCell>

                            {/* Código */}
                            <TableCell className="px-3 pt-2.5">
                              {item.codigo && (
                                <span className="font-mono text-xs font-semibold text-muted-foreground">
                                  {item.codigo}
                                </span>
                              )}
                            </TableCell>

                            {/* Requisito */}
                            <TableCell className="px-3 py-2.5">
                              <p
                                className={cn(
                                  'text-sm leading-snug',
                                  isComplete && 'text-muted-foreground line-through decoration-[var(--lime)]',
                                )}
                              >
                                {item.requisito}
                              </p>
                            </TableCell>

                            {/* Tipo */}
                            <TableCell className="px-3 pt-2.5">
                              {item.tipo_requisito && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'whitespace-nowrap text-xs',
                                    item.tipo_requisito === 'Indispensable'
                                      ? 'border-red-300 bg-red-50 text-red-800'
                                      : 'border-blue-300 bg-blue-50 text-blue-800',
                                  )}
                                >
                                  {item.tipo_requisito}
                                </Badge>
                              )}
                            </TableCell>

                            {/* Plazo */}
                            <TableCell className="px-3 pt-2.5 text-xs text-muted-foreground">
                              {item.plazo_estimado ?? '—'}
                            </TableCell>

                            {/* Recurso */}
                            <TableCell className="px-3 pt-2.5 text-xs text-muted-foreground">
                              {item.recurso ?? '—'}
                            </TableCell>

                            {/* Estado selector */}
                            <TableCell className="px-3 pt-2">
                              {!itemId ? (
                                <span className="text-xs text-destructive">sin ID</span>
                              ) : (
                                <select
                                  className={selectClass}
                                  disabled={disabled}
                                  value={item.estado ?? 'Pendiente'}
                                  onChange={(e) => {
                                    const v = e.target.value as PlanCarreraItem['estado']
                                    if (!itemId || v === item.estado) return
                                    void patchItem(itemId, { estado: v })
                                  }}
                                >
                                  {ESTADOS.map((s) => (
                                    <option key={s} value={s}>
                                      {ESTADO_LABELS[s]}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </TableCell>

                            {/* Notas inline */}
                            <TableCell className="px-3 pt-2">
                              <NotasInline
                                initial={item.notas ?? ''}
                                disabled={disabled}
                                itemId={itemId}
                                onSave={(notas) => {
                                  if (itemId) void patchItem(itemId, { notas })
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

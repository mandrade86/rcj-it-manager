import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Search,
  Scale,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchOpVsReceta, fetchProduccionDetalle, fetchVentasCatalogo } from '@/lib/api/costeoMuestras'
import { formatDateDMY, formatLps } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  IngredienteRow,
  OpVsRecetaMuestra,
  OpVsRecetaPayload,
  ProduccionOrdenDetalle,
} from '@/types/costeoMuestras'

import { BI_CHART } from './chartTheme'
import { CosteoCatalogSearchSelect } from './CosteoCatalogSearchSelect'
import { hasSelectValue } from './selectHelpers'

type Props = {
  onError: (msg: string | null) => void
}

const SIN_CLIENTE = ''

function formatPct(v: number | null | undefined): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function formatQty(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('es-HN', { maximumFractionDigits: 4 })
}

export function EnlaceFacturaTab({ onError }: Props) {
  const [codigoCliente, setCodigoCliente] = useState(SIN_CLIENTE)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)
  const [catalogoListo, setCatalogoListo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [opcionesCliente, setOpcionesCliente] = useState<
    { value: string; code: string; label: string }[]
  >([])
  const [data, setData] = useState<OpVsRecetaPayload | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [ordenInput, setOrdenInput] = useState('')
  const [detalleOp, setDetalleOp] = useState<ProduccionOrdenDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const loadCatalogo = useCallback(async () => {
    setLoadingCatalogo(true)
    onError(null)
    try {
      const cat = await fetchVentasCatalogo({
        desde: desde || undefined,
        hasta: hasta || undefined,
      })
      setOpcionesCliente(
        (cat.clientes ?? [])
          .filter((c) => hasSelectValue(c.codigo_cliente))
          .map((c) => ({
            value: c.codigo_cliente,
            code: c.codigo_cliente,
            label: c.cliente || c.codigo_cliente,
          })),
      )
      setCatalogoListo(true)
    } catch (e) {
      onError((e as Error).message)
      setOpcionesCliente([])
      setCatalogoListo(true)
    } finally {
      setLoadingCatalogo(false)
    }
  }, [desde, hasta, onError])

  useEffect(() => {
    void loadCatalogo()
  }, [loadCatalogo])

  const clienteLabel = useMemo(() => {
    if (data?.cliente?.cliente) return data.cliente.cliente
    return opcionesCliente.find((c) => c.value === codigoCliente)?.label ?? codigoCliente
  }, [data, opcionesCliente, codigoCliente])

  if (!catalogoListo || (loadingCatalogo && opcionesCliente.length === 0 && !data)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
        <Loader2 className="size-6 animate-spin text-[var(--navy)]" />
        <p className="text-sm">Cargando clientes…</p>
      </div>
    )
  }

  const buscar = async () => {
    if (!codigoCliente.trim()) {
      onError('Seleccione un cliente.')
      return
    }
    onError(null)
    setLoading(true)
    try {
      const payload = await fetchOpVsReceta({
        codigo_cliente: codigoCliente.trim(),
        desde: desde || undefined,
        hasta: hasta || undefined,
      })
      setData(payload)
      setExpanded(new Set())
    } catch (e) {
      setData(null)
      onError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const buscarDetalleOp = async (ordenNum?: string) => {
    const orden = (ordenNum ?? ordenInput).trim()
    if (!orden) {
      onError('Indique el número de orden de producción.')
      return
    }
    onError(null)
    setOrdenInput(orden)
    setLoadingDetalle(true)
    try {
      const det = await fetchProduccionDetalle(orden)
      setDetalleOp(det)
    } catch (e) {
      setDetalleOp(null)
      onError((e as Error).message)
    } finally {
      setLoadingDetalle(false)
    }
  }

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const res = data?.resumen
  const varAlza = (res?.var_costo ?? 0) > 0

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-[var(--navy)] bg-gradient-to-r from-[#DCE6F1]/70 to-white">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-5 text-[var(--navy)]" />
            OP vs receta — por muestra
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)]">
            Filtre por cliente. La cantidad producida se limita a las OPs ligadas a ese cliente
            (factura→OP o ClienteOrden). Si no hay vínculo en SAP, qty producida = qty vendida
            y el costo teórico usa BOM × qty vendida.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 pb-3">
          <div className="min-w-[240px] flex-[2]">
            <Label className="text-[11px]">Cliente</Label>
            <div className="relative">
              <CosteoCatalogSearchSelect
                id="op-cliente"
                options={opcionesCliente}
                value={codigoCliente || '__none__'}
                allValue="__none__"
                allLabel="Seleccione cliente…"
                onChange={(v) => setCodigoCliente(v === '__none__' ? SIN_CLIENTE : v)}
                placeholder={loadingCatalogo ? 'Cargando clientes…' : 'Buscar cliente…'}
                disabled={loadingCatalogo}
                compact
              />
              {loadingCatalogo ? (
                <Loader2 className="pointer-events-none absolute right-8 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-[var(--navy)]" />
              ) : null}
            </div>
          </div>
          <div>
            <Label htmlFor="op-desde" className="text-[11px]">
              Desde
            </Label>
            <Input
              id="op-desde"
              type="date"
              className="h-8"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="op-hasta" className="text-[11px]">
              Hasta
            </Label>
            <Input
              id="op-hasta"
              type="date"
              className="h-8"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => void buscar()}
            disabled={loading || !codigoCliente}
          >
            {loading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 size-3.5" />
            )}
            Buscar
          </Button>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-[var(--lime)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalle de orden de producción</CardTitle>
          <p className="text-xs text-[var(--text-muted)]">
            Busque por número de OP para ver cabecera, líneas SAP, costo teórico (BOM × qty) y
            variación.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 pb-3">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="op-numero" className="text-[11px]">
              Nº orden
            </Label>
            <Input
              id="op-numero"
              className="h-8 font-mono"
              placeholder="Ej. 12345"
              value={ordenInput}
              onChange={(e) => setOrdenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void buscarDetalleOp()
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => void buscarDetalleOp()}
            disabled={loadingDetalle || !ordenInput.trim()}
          >
            {loadingDetalle ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Search className="mr-1.5 size-3.5" />
            )}
            Ver detalle
          </Button>
        </CardContent>
      </Card>

      {detalleOp ? (
        <DetalleOrdenPanel
          detalle={detalleOp}
          onClose={() => setDetalleOp(null)}
        />
      ) : null}

      {data?.aviso ? (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {data.aviso}
        </p>
      ) : null}

      {data?.produccion_error ? (
        <p className="text-xs text-amber-800">Producción: {data.produccion_error}</p>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Comparando OP vs receta…
        </div>
      ) : null}

      {data && res ? (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            Cliente:{' '}
            <span className="font-medium text-[var(--text)]">{clienteLabel}</span>
            {data.cliente.codigo_cliente ? (
              <span className="ml-1 font-mono text-[10px]">({data.cliente.codigo_cliente})</span>
            ) : null}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.purple }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="text-[11px] text-[var(--text-muted)]">Muestras</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className="text-base font-bold" style={{ color: BI_CHART.purple }}>
                  {res.muestras}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {res.con_produccion} con OP · {res.sin_produccion} sin OP
                </p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.amber }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="text-[11px] text-[var(--text-muted)]">Costo teórico</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className="text-base font-bold" style={{ color: BI_CHART.amber }}>
                  {formatLps(res.costo_teorico)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Qty prod. {formatQty(res.qty_producida)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.coral }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="text-[11px] text-[var(--text-muted)]">Costo OP</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className="text-base font-bold" style={{ color: BI_CHART.coral }}>
                  {formatLps(res.costo_op)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Qty vendida {formatQty(res.qty_vendida)}
                </p>
              </CardContent>
            </Card>
            <Card
              className="border-t-4"
              style={{ borderTopColor: varAlza ? BI_CHART.red : BI_CHART.teal }}
            >
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  {varAlza ? (
                    <ArrowUpRight className="size-3 text-red-600" />
                  ) : (
                    <ArrowDownRight className="size-3 text-teal-600" />
                  )}
                  Variación costo
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p
                  className="text-base font-bold"
                  style={{ color: varAlza ? BI_CHART.red : BI_CHART.teal }}
                >
                  {formatLps(res.var_costo)}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {formatPct(res.var_costo_pct)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              {data.muestras.length === 0 ? (
                <p className="py-10 text-center text-sm text-[var(--text-muted)]">
                  No hay muestras (recetas) vendidas a este cliente en el rango.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[var(--gray-lt)]">
                      <TableHead className="w-8" />
                      <TableHead>Muestra</TableHead>
                      <TableHead className="text-right">Qty vendida</TableHead>
                      <TableHead className="text-right" title="Solo OPs del cliente; si no hay vínculo, = qty vendida">
                        Qty producida
                      </TableHead>
                      <TableHead className="text-right">Var. qty</TableHead>
                      <TableHead className="text-right">Teórico</TableHead>
                      <TableHead className="text-right">Costo OP</TableHead>
                      <TableHead className="text-right">Var. costo</TableHead>
                      <TableHead>Órdenes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.muestras.map((m) => (
                      <MuestraRows
                        key={m.receta_code}
                        muestra={m}
                        open={expanded.has(m.receta_code)}
                        onToggle={() => toggle(m.receta_code)}
                        onVerOrden={(orden) => void buscarDetalleOp(orden)}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : !loading ? (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">
          Seleccione un cliente y pulse Buscar para ver muestras con variación OP vs receta.
        </p>
      ) : null}
    </div>
  )
}

function DetalleOrdenPanel({
  detalle,
  onClose,
}: {
  detalle: ProduccionOrdenDetalle
  onClose: () => void
}) {
  const varAlza = detalle.var_costo > 0
  const alertasDetalle =
    detalle.ingredientes_alerta_receta
    ?? detalle.ingredientes.filter((i) =>
      resolveAlertaReceta(i, detalle.tiene_consumo_real),
    ).length
  return (
    <Card className="border-[var(--navy)]/30 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-[var(--navy)]" />
            OP <span className="font-mono text-[var(--navy)]">{detalle.orden}</span>
          </CardTitle>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            ID OP (DocEntry){' '}
            <span className="font-mono font-medium text-[var(--text)]">
              {detalle.orden_id || '—'}
            </span>
            {' · '}
            <span className="font-mono font-medium text-[var(--text)]">{detalle.receta_code}</span>
            {detalle.receta_nombre ? ` — ${detalle.receta_nombre}` : ''}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
          Cerrar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {(detalle.aviso || alertasDetalle > 0) ? (
          <p
            className={cn(
              'flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
              alertasDetalle > 0
                ? 'border-red-300 bg-red-50 text-red-900'
                : 'border-amber-200 bg-amber-50 text-amber-900',
            )}
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {detalle.aviso
              || `Hay ${alertasDetalle} ingrediente(s) con código distinto entre receta y OP.`}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-[var(--border)] bg-[var(--gray-lt)] px-3 py-2">
            <p className="text-[11px] text-[var(--text-muted)]">Fecha / estado</p>
            <p className="text-sm font-medium">
              {detalle.fecha ? formatDateDMY(detalle.fecha) : '—'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {detalle.estado || '—'}
              {detalle.almacen ? ` · Alm. ${detalle.almacen}` : ''}
            </p>
          </div>
          <div className="rounded-md border border-[var(--border)] px-3 py-2">
            <p className="text-[11px] text-[var(--text-muted)]">Qty producida (real)</p>
            <p className="text-sm font-bold" style={{ color: BI_CHART.coral }}>
              {formatQty(detalle.cantidad)}
            </p>
          </div>
          <div
            className="rounded-md border px-3 py-2"
            style={{ borderColor: `${BI_CHART.amber}66` }}
          >
            <p className="text-[11px] font-medium" style={{ color: BI_CHART.amber }}>
              Teórico (BOM × qty)
            </p>
            <p className="text-sm font-bold" style={{ color: BI_CHART.amber }}>
              {formatLps(detalle.costo_teorico)}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              BOM/und {formatLps(detalle.costo_unitario_bom)}
            </p>
          </div>
          <div
            className="rounded-md border px-3 py-2"
            style={{ borderColor: `${BI_CHART.coral}66` }}
          >
            <p className="text-[11px] font-medium" style={{ color: BI_CHART.coral }}>
              Real (Σ precio × qty)
            </p>
            <p className="text-sm font-bold" style={{ color: BI_CHART.coral }}>
              {formatLps(detalle.costo)}
            </p>
            <p
              className="text-[11px] font-medium"
              style={{ color: varAlza ? BI_CHART.red : BI_CHART.teal }}
            >
              Var. {formatLps(detalle.var_costo)} ({formatPct(detalle.var_costo_pct)})
            </p>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
            Líneas reales SAP — cabecera y consumo
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Receta</TableHead>
                  <TableHead className="text-xs">Componente</TableHead>
                  <TableHead className="text-right text-xs">Cantidad</TableHead>
                  <TableHead className="text-right text-xs">Costo</TableHead>
                  <TableHead className="text-xs">Almacén</TableHead>
                  <TableHead className="text-xs">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.lineas.map((l, i) => (
                  <TableRow key={`${l.orden}-${l.componente_code}-${i}`}>
                    <TableCell className="text-xs">
                      {l.fecha ? formatDateDMY(l.fecha) : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.receta_code || '—'}</TableCell>
                    <TableCell className="text-xs">
                      {l.componente_code || l.componente_nombre ? (
                        <>
                          <span className="bi-sentence-case">
                            {l.componente_nombre || l.componente_code}
                          </span>
                          {l.componente_code ? (
                            <div className="font-mono text-[10px] text-[var(--text-muted)]">
                              {l.componente_code}
                              {l.unidad ? ` · ${l.unidad}` : ''}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-[var(--text-muted)]">Cabecera producto</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs">{formatQty(l.cantidad)}</TableCell>
                    <TableCell className="text-right text-xs">{formatLps(l.costo)}</TableCell>
                    <TableCell className="text-xs">{l.almacen || '—'}</TableCell>
                    <TableCell className="text-xs">{l.estado || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <IngredientesTable
          ordenId={detalle.orden_id}
          ordenNum={detalle.orden}
          ingredientes={detalle.ingredientes}
          tieneConsumoReal={detalle.tiene_consumo_real}
          recetaFuente={detalle.receta_fuente}
          cobertura={{
            con: detalle.ingredientes_con_consumo ?? 0,
            bom: detalle.ingredientes_bom ?? detalle.ingredientes.length,
          }}
        />

        {detalle.bom_maestro && detalle.bom_maestro.length > 0 && detalle.bom_op && detalle.bom_op.length > 0
          && detalle.receta_fuente === 'op_wor1' ? (
          <BomMaestroDiffTable
            bomMaestro={detalle.bom_maestro}
            bomOp={detalle.bom_op}
            qtyPt={detalle.cantidad}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

function alertaRecetaLabel(tipo: OpVsRecetaMuestra['ingredientes'][number]['alerta_receta']): string {
  if (tipo === 'falta_en_op') return 'No está en OP'
  if (tipo === 'extra_en_op') return 'No está en receta'
  return ''
}

/** Fallback UI si el API no envió alerta_receta (p. ej. build antiguo en client/dist). */
function resolveAlertaReceta(
  ing: OpVsRecetaMuestra['ingredientes'][number],
  tieneConsumoReal: boolean,
): 'falta_en_op' | 'extra_en_op' | null {
  if (ing.alerta_receta) return ing.alerta_receta
  if (!tieneConsumoReal) return null
  const enBom =
    ing.qty_por_unidad > 0 || ing.qty_teorica > 0 || (ing.costo_teorico ?? 0) > 0
  const enOp =
    ing.qty_real != null
    || (ing.qty_plan != null && ing.qty_plan > 0)
    || (ing.costo_real != null && ing.costo_real > 0)
  if (enBom && !enOp) return 'falta_en_op'
  if (!enBom && enOp) return 'extra_en_op'
  return null
}

function BomMaestroDiffTable({
  bomMaestro,
  bomOp,
  qtyPt,
}: {
  bomMaestro: IngredienteRow[]
  bomOp: IngredienteRow[]
  qtyPt: number
}) {
  const codesOp = new Set(bomOp.map((b) => b.componente_code).filter(Boolean))
  const soloMaestro = bomMaestro.filter((b) => b.componente_code && !codesOp.has(b.componente_code))
  if (!soloMaestro.length) return null
  return (
    <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
      <p className="mb-2 text-xs font-semibold text-red-900">
        BOM maestro (VW_BI_RECETA_COSTO) — ítems que no están en la OP
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Código</TableHead>
            <TableHead className="text-xs">Descripción</TableHead>
            <TableHead className="text-right text-xs">Qty/und</TableHead>
            <TableHead className="text-right text-xs">
              Qty × {qtyPt > 0 ? qtyPt : '?'} und
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {soloMaestro.map((b) => (
            <TableRow key={b.componente_code} className="bg-white/80">
              <TableCell className="font-mono text-xs text-red-800">{b.componente_code}</TableCell>
              <TableCell className="text-xs text-red-900">{b.componente_nombre}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">{formatQty(b.cantidad)}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {qtyPt > 0 ? formatQty(b.cantidad * qtyPt) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function IngredientesTable({
  ordenId,
  ordenNum,
  ingredientes,
  tieneConsumoReal,
  recetaFuente,
  cobertura,
}: {
  /** DocEntry SAP (OWOR). */
  ordenId?: string
  /** DocNum visible de la OP. */
  ordenNum?: string
  ingredientes: OpVsRecetaMuestra['ingredientes']
  tieneConsumoReal: boolean
  recetaFuente?: 'maestro' | 'op_wor1'
  cobertura?: { con: number; bom: number } | null
}) {
  if (ingredientes.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-[var(--text-muted)]">
        Sin ingredientes en el BOM de esta muestra.
      </p>
    )
  }
  const parcial =
    cobertura
    && cobertura.bom > 0
    && cobertura.con > 0
    && cobertura.con < cobertura.bom

  const alertasReceta = ingredientes.filter(
    (i) => resolveAlertaReceta(i, tieneConsumoReal),
  ).length

  const ordenados = [...ingredientes].sort((a, b) => {
    const aAlert = resolveAlertaReceta(a, tieneConsumoReal) ? 0 : 1
    const bAlert = resolveAlertaReceta(b, tieneConsumoReal) ? 0 : 1
    if (aAlert !== bAlert) return aAlert - bAlert
    const aBom = a.qty_por_unidad > 0 || a.qty_teorica > 0 ? 0 : 1
    const bBom = b.qty_por_unidad > 0 || b.qty_teorica > 0 ? 0 : 1
    if (aBom !== bBom) return aBom - bBom
    return (a.componente_code || '').localeCompare(b.componente_code || '')
  })

  const filas = ordenados.map((ing) => {
    const alerta = resolveAlertaReceta(ing, tieneConsumoReal)
    // Teórico = Lista de materiales (nunca CantPlan/IssuedQty de la OP).
    const qtyTeo =
      ing.qty_teorica > 0
        ? ing.qty_teorica
        : ing.qty_por_unidad > 0
          ? ing.qty_por_unidad
          : 0
    const precioTeo = ing.costo_unitario > 0 ? ing.costo_unitario : 0
    const costoTeoricoIng =
      ing.costo_teorico > 0
        ? ing.costo_teorico
        : precioTeo > 0 && qtyTeo > 0
          ? precioTeo * qtyTeo
          : 0
    const precioReal =
      (ing.precio_real != null && ing.precio_real > 0 ? ing.precio_real : precioTeo) || 0
    const qtyReal = ing.qty_real
    const costoRealIng =
      qtyReal != null && precioReal > 0
        ? precioReal * qtyReal
        : ing.costo_real != null
          ? ing.costo_real
          : null
    const varCosto = costoRealIng != null ? costoRealIng - costoTeoricoIng : null
    const varCostoPct =
      varCosto != null && costoTeoricoIng > 0 ? (varCosto / costoTeoricoIng) * 100 : null
    const varQty =
      !alerta && qtyReal != null ? qtyReal - qtyTeo : null
    return {
      ing,
      alerta,
      qtyTeo,
      precioTeo,
      costoTeoricoIng,
      precioReal,
      qtyReal,
      costoRealIng,
      varCosto,
      varCostoPct,
      varQty,
    }
  })

  const totales = filas.reduce(
    (acc, f) => {
      acc.costo_teorico += f.costoTeoricoIng
      if (f.qtyReal != null && !f.alerta) {
        acc.costo_real += f.costoRealIng ?? 0
        acc.tiene_real = true
      }
      return acc
    },
    { costo_teorico: 0, costo_real: 0, tiene_real: false },
  )
  // Misma fórmula que el header: Σ real − Σ teórico (líneas sin real aportan 0 al real)
  const varTotal = totales.tiene_real ? totales.costo_real - totales.costo_teorico : null
  const varTotalPct =
    varTotal != null && totales.costo_teorico > 0
      ? (varTotal / totales.costo_teorico) * 100
      : null

  return (
    <>
      {alertasReceta > 0 ? (
        <p className="mb-2 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Hay {alertasReceta} ingrediente{alertasReceta === 1 ? '' : 's'} con código distinto entre la receta (BOM) y la OP.
          Las filas en rojo no se cruzan automáticamente.
        </p>
      ) : null}
      <p className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
        Comparación por componente
        {recetaFuente === 'op_wor1' ? (
          <Badge variant="outline" className="border-amber-400 bg-amber-50 text-[10px] text-amber-900">
            Fallback WOR1 (sin LMat)
          </Badge>
        ) : (
          <Badge variant="outline" className="border-[var(--navy)] bg-white text-[10px] text-[var(--navy)]">
            Lista de materiales (OITT)
          </Badge>
        )}
        {alertasReceta > 0 ? (
          <Badge variant="outline" className="border-red-400 bg-red-50 text-red-800">
            {alertasReceta} ingrediente{alertasReceta === 1 ? '' : 's'} distinto{alertasReceta === 1 ? '' : 's'}
          </Badge>
        ) : tieneConsumoReal && parcial ? (
          <Badge variant="outline" className="border-amber-400 text-amber-900">
            Consumo parcial ({cobertura!.con}/{cobertura!.bom})
          </Badge>
        ) : tieneConsumoReal ? (
          <Badge className="bg-[var(--lime)] text-[var(--navy)]">Receta y OP coinciden</Badge>
        ) : (
          <Badge variant="outline" className="text-amber-800">
            Solo teórico (sin emisiones en SAP)
          </Badge>
        )}
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--gray-lt)]">
              <TableHead rowSpan={2} className="align-bottom text-xs">
                ID OP
              </TableHead>
              <TableHead rowSpan={2} className="align-bottom text-xs">
                Nº OP
              </TableHead>
              <TableHead rowSpan={2} className="align-bottom text-xs">
                Ingrediente
              </TableHead>
              <TableHead rowSpan={2} className="align-bottom text-xs">
                Estado
              </TableHead>
              <TableHead
                colSpan={3}
                className="border-l border-[var(--border)] text-center text-[11px] font-semibold"
                style={{ color: BI_CHART.amber }}
              >
                Teórico (Lista de materiales)
              </TableHead>
              <TableHead
                colSpan={4}
                className="border-l border-[var(--border)] text-center text-[11px] font-semibold"
                style={{ color: BI_CHART.coral }}
              >
                Real (OP / consumo)
              </TableHead>
              <TableHead
                colSpan={2}
                className="border-l border-[var(--border)] text-center text-[11px] font-semibold text-[var(--text-muted)]"
              >
                Variación (real − teórico)
              </TableHead>
            </TableRow>
            <TableRow className="bg-[var(--gray-lt)]">
              <TableHead className="border-l border-[var(--border)] text-right text-[10px]">
                Precio
              </TableHead>
              <TableHead
                className="text-right text-[10px]"
                title="Cantidad en Lista de materiales (OITT/ITT1), igual que SAP"
              >
                Qty LMat
              </TableHead>
              <TableHead className="text-right text-[10px]" title="Precio × Qty LMat">
                Costo teórico
              </TableHead>
              <TableHead className="border-l border-[var(--border)] text-right text-[10px]">
                Precio
              </TableHead>
              <TableHead className="text-right text-[10px]" title="CantPlanComponente (WOR1)">
                Qty plan OP
              </TableHead>
              <TableHead className="text-right text-[10px]" title="CantEmitida / IssuedQty">
                Qty emitida
              </TableHead>
              <TableHead className="text-right text-[10px]" title="Precio × Qty real">
                Costo real
              </TableHead>
              <TableHead className="border-l border-[var(--border)] text-right text-[10px]">
                Var. qty
              </TableHead>
              <TableHead className="text-right text-[10px]">Var. costo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map(({
              ing,
              alerta,
              qtyTeo,
              precioTeo,
              costoTeoricoIng,
              precioReal,
              qtyReal,
              costoRealIng,
              varCosto,
              varCostoPct,
              varQty,
            }, i) => (
              <TableRow
                key={`${ing.componente_code}-${i}`}
                className={cn(
                  alerta && 'bg-red-100 hover:bg-red-100',
                )}
              >
                <TableCell className="font-mono text-xs font-medium">
                  {ordenId || '—'}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {ordenNum && ordenNum !== '—' ? ordenNum : '—'}
                </TableCell>
                <TableCell className="text-xs">
                  <span
                    className={cn(
                      'bi-sentence-case',
                      alerta && 'font-semibold text-red-900',
                    )}
                  >
                    {ing.componente_nombre}
                  </span>
                  <div
                    className={cn(
                      'font-mono text-[10px]',
                      alerta ? 'text-red-800' : 'text-[var(--text-muted)]',
                    )}
                  >
                    {ing.componente_code || '—'}
                    {ing.unidad ? ` · ${ing.unidad}` : ''}
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {alerta ? (
                    <Badge
                      variant="outline"
                      className="border-red-500 bg-white text-[10px] font-semibold text-red-800"
                    >
                      {alertaRecetaLabel(alerta)}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-[var(--lime)] bg-[var(--lime-lt)] text-[10px] text-[var(--navy)]"
                    >
                      OK
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="border-l border-[var(--border)] text-right text-xs tabular-nums">
                  {precioTeo > 0 ? formatLps(precioTeo) : '—'}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {formatQty(qtyTeo)}
                </TableCell>
                <TableCell className="text-right text-xs" style={{ color: BI_CHART.amber }}>
                  {costoTeoricoIng > 0 ? formatLps(costoTeoricoIng) : '—'}
                </TableCell>
                <TableCell className="border-l border-[var(--border)] text-right text-xs tabular-nums">
                  {qtyReal != null && precioReal > 0 ? formatLps(precioReal) : '—'}
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-[var(--text-muted)]">
                  {ing.qty_plan != null ? formatQty(ing.qty_plan) : '—'}
                </TableCell>
                <TableCell
                  className="text-right text-xs font-medium tabular-nums"
                  style={{ color: BI_CHART.coral }}
                >
                  {formatQty(qtyReal)}
                </TableCell>
                <TableCell className="text-right text-xs font-medium" style={{ color: BI_CHART.coral }}>
                  {costoRealIng != null && (costoRealIng > 0 || qtyReal != null)
                    ? formatLps(costoRealIng)
                    : '—'}
                </TableCell>
                <TableCell
                  className="border-l border-[var(--border)] text-right text-xs tabular-nums"
                  style={{
                    color:
                      varQty == null
                        ? undefined
                        : varQty > 0
                          ? BI_CHART.red
                          : BI_CHART.teal,
                  }}
                >
                  {formatQty(varQty)}
                  {varQty != null && qtyTeo > 0 ? (
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {formatPct((varQty / qtyTeo) * 100)}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell
                  className="text-right text-xs"
                  style={{
                    color:
                      varCosto == null
                        ? undefined
                        : varCosto > 0
                          ? BI_CHART.red
                          : BI_CHART.teal,
                  }}
                >
                  {varCosto != null ? formatLps(varCosto) : '—'}
                  {varCostoPct != null ? (
                    <div className="text-[10px] text-[var(--text-muted)]">
                      {formatPct(varCostoPct)}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="border-t-2 border-[var(--navy)]/20 bg-[var(--gray-lt)] font-semibold">
              <TableCell className="text-xs text-[var(--navy)]" colSpan={4}>
                Total
              </TableCell>
              <TableCell className="border-l border-[var(--border)] text-right text-xs text-[var(--text-muted)]">
                —
              </TableCell>
              <TableCell className="text-right text-xs text-[var(--text-muted)]">—</TableCell>
              <TableCell className="text-right text-xs" style={{ color: BI_CHART.amber }}>
                {formatLps(totales.costo_teorico)}
              </TableCell>
              <TableCell className="border-l border-[var(--border)] text-right text-xs text-[var(--text-muted)]">
                —
              </TableCell>
              <TableCell className="text-right text-xs text-[var(--text-muted)]">—</TableCell>
              <TableCell className="text-right text-xs text-[var(--text-muted)]">—</TableCell>
              <TableCell className="text-right text-xs" style={{ color: BI_CHART.coral }}>
                {totales.tiene_real ? formatLps(totales.costo_real) : '—'}
              </TableCell>
              <TableCell className="border-l border-[var(--border)] text-right text-xs text-[var(--text-muted)]">
                —
              </TableCell>
              <TableCell
                className="text-right text-xs"
                style={{
                  color: varTotal == null
                    ? undefined
                    : varTotal > 0
                      ? BI_CHART.red
                      : BI_CHART.teal,
                }}
              >
                {varTotal != null ? formatLps(varTotal) : '—'}
                {varTotalPct != null ? (
                  <div className="text-[10px] font-normal text-[var(--text-muted)]">
                    {formatPct(varTotalPct)}
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  )
}

function MuestraRows({
  muestra,
  open,
  onToggle,
  onVerOrden,
}: {
  muestra: OpVsRecetaMuestra
  open: boolean
  onToggle: () => void
  onVerOrden: (orden: string) => void
}) {
  const varCostoAlza = muestra.var_costo > 0
  const varQtyAlza = muestra.var_qty > 0
  const [ordenOpen, setOrdenOpen] = useState<string | null>(null)

  return (
    <>
      <TableRow
        className={cn('cursor-pointer', open && 'bg-[var(--blue-lt)]/40')}
        onClick={onToggle}
      >
        <TableCell className="px-1">
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded text-[var(--navy)]"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5">
            <FlaskConical className="size-3.5 text-[var(--navy)]" />
            <div>
              <div className="font-mono text-xs font-semibold text-[var(--navy)]">
                {muestra.receta_code}
              </div>
              <div className="max-w-[180px] truncate text-[10px] text-[var(--text-muted)]">
                {muestra.receta_nombre}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right text-xs">{formatQty(muestra.qty_vendida)}</TableCell>
        <TableCell className="text-right text-xs">{formatQty(muestra.qty_producida)}</TableCell>
        <TableCell
          className="text-right text-xs"
          style={{ color: varQtyAlza ? BI_CHART.red : BI_CHART.teal }}
        >
          {formatQty(muestra.var_qty)}
          <div className="text-[10px] text-[var(--text-muted)]">
            {formatPct(muestra.var_qty_pct)}
          </div>
        </TableCell>
        <TableCell className="text-right text-xs" style={{ color: BI_CHART.amber }}>
          {formatLps(muestra.costo_teorico)}
          <div className="text-[10px] text-[var(--text-muted)]">
            BOM/und {formatLps(muestra.costo_unitario_bom ?? 0)}
          </div>
        </TableCell>
        <TableCell className="text-right text-xs" style={{ color: BI_CHART.coral }}>
          {formatLps(muestra.costo_op)}
        </TableCell>
        <TableCell
          className="text-right text-xs font-medium"
          style={{ color: varCostoAlza ? BI_CHART.red : BI_CHART.teal }}
        >
          {formatLps(muestra.var_costo)}
          <div className="text-[10px] font-normal text-[var(--text-muted)]">
            {formatPct(muestra.var_costo_pct)}
          </div>
        </TableCell>
        <TableCell className="max-w-[120px] truncate font-mono text-xs">
          {muestra.ordenes.length
            ? muestra.ordenes.map((o) => o.orden).filter((x) => x !== '—').join(', ') || '—'
            : '—'}
        </TableCell>
      </TableRow>

      {open ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={9} className="bg-[var(--gray-bg)] p-0">
            <div className="space-y-3 border-t border-[var(--border)] px-3 py-3">
              {muestra.ordenes.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
                    Órdenes de producción — teórico vs real
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[var(--gray-lt)]">
                        <TableHead rowSpan={2} className="w-8 align-bottom text-xs" />
                        <TableHead rowSpan={2} className="align-bottom text-xs">
                          ID OP
                        </TableHead>
                        <TableHead rowSpan={2} className="align-bottom text-xs">
                          Nº OP
                        </TableHead>
                        <TableHead rowSpan={2} className="align-bottom text-xs">
                          Fecha
                        </TableHead>
                        <TableHead rowSpan={2} className="align-bottom text-xs">
                          Estado
                        </TableHead>
                        <TableHead
                          colSpan={2}
                          className="border-l text-center text-[10px] font-semibold"
                          style={{ color: BI_CHART.amber }}
                        >
                          Teórico
                        </TableHead>
                        <TableHead
                          colSpan={2}
                          className="border-l text-center text-[10px] font-semibold"
                          style={{ color: BI_CHART.coral }}
                        >
                          Real
                        </TableHead>
                        <TableHead
                          rowSpan={2}
                          className="align-bottom border-l text-right text-xs"
                        >
                          Var. costo
                        </TableHead>
                      </TableRow>
                      <TableRow className="bg-[var(--gray-lt)]">
                        <TableHead className="border-l text-right text-[10px]">Qty BOM</TableHead>
                        <TableHead className="text-right text-[10px]">Costo BOM</TableHead>
                        <TableHead className="border-l text-right text-[10px]">Qty OP</TableHead>
                        <TableHead className="text-right text-[10px]">Costo OP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {muestra.ordenes.map((o, i) => {
                        const key = `${o.orden}-${i}`
                        const openOrd = ordenOpen === key
                        const varAlza = (o.var_costo ?? 0) > 0
                        return (
                          <Fragment key={key}>
                            <TableRow
                              className={cn('cursor-pointer', openOrd && 'bg-[var(--blue-lt)]/30')}
                              onClick={(e) => {
                                e.stopPropagation()
                                setOrdenOpen(openOrd ? null : key)
                              }}
                            >
                              <TableCell className="px-1">
                                {openOrd ? (
                                  <ChevronDown className="size-3.5 text-[var(--navy)]" />
                                ) : (
                                  <ChevronRight className="size-3.5 text-[var(--navy)]" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {o.orden_id || '—'}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {o.orden !== '—' ? (
                                  <button
                                    type="button"
                                    className="text-[var(--navy)] underline-offset-2 hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onVerOrden(o.orden)
                                    }}
                                    title="Ver detalle de la OP"
                                  >
                                    {o.orden}
                                  </button>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {o.fecha ? formatDateDMY(o.fecha) : '—'}
                              </TableCell>
                              <TableCell className="text-xs">{o.estado || '—'}</TableCell>
                              <TableCell className="border-l text-right text-xs tabular-nums">
                                {formatQty(o.cantidad)}
                              </TableCell>
                              <TableCell
                                className="text-right text-xs"
                                style={{ color: BI_CHART.amber }}
                              >
                                {formatLps(o.costo_teorico ?? 0)}
                              </TableCell>
                              <TableCell className="border-l text-right text-xs tabular-nums" style={{ color: BI_CHART.coral }}>
                                {formatQty(o.cantidad)}
                              </TableCell>
                              <TableCell
                                className="text-right text-xs"
                                style={{ color: BI_CHART.coral }}
                              >
                                {formatLps(o.costo)}
                              </TableCell>
                              <TableCell
                                className="border-l text-right text-xs font-medium"
                                style={{ color: varAlza ? BI_CHART.red : BI_CHART.teal }}
                              >
                                {formatLps(o.var_costo ?? 0)}
                                <div className="text-[10px] font-normal text-[var(--text-muted)]">
                                  {formatPct(o.var_costo_pct)}
                                </div>
                              </TableCell>
                            </TableRow>
                            {openOrd ? (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={10} className="bg-white/80 p-3">
                                  <IngredientesTable
                                    ordenId={o.orden_id}
                                    ordenNum={o.orden}
                                    ingredientes={o.ingredientes ?? []}
                                    tieneConsumoReal={muestra.tiene_consumo_real}
                                    cobertura={{
                                      con: (o.ingredientes ?? []).filter((i) => i.qty_real != null)
                                        .length,
                                      bom: (o.ingredientes ?? []).filter((i) => i.qty_por_unidad > 0)
                                        .length,
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  Sin órdenes de producción vinculadas a esta muestra en el rango.
                </p>
              )}

              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
                  Totales de la muestra (todas las OP)
                </p>
                <IngredientesTable
                  ordenId={
                    [...new Set(muestra.ordenes.map((o) => o.orden_id).filter(Boolean))].join(', ')
                    || undefined
                  }
                  ordenNum={
                    [...new Set(muestra.ordenes.map((o) => o.orden).filter((x) => x && x !== '—'))].join(', ')
                    || undefined
                  }
                  ingredientes={muestra.ingredientes}
                  tieneConsumoReal={muestra.tiene_consumo_real}
                  cobertura={{
                    con: muestra.ingredientes.filter((i) => i.qty_real != null).length,
                    bom: muestra.ingredientes.filter((i) => i.qty_por_unidad > 0).length,
                  }}
                />
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

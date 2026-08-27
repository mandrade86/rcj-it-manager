import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Scale,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { exportVentasAnalisisExcel } from '@/lib/exportCosteoExcel'
import { fetchProduccionReceta, fetchRecetaDetalle } from '@/lib/api/costeoMuestras'
import { formatDateDMY, formatLps } from '@/lib/format'
import { cn } from '@/lib/utils'
import { costeoCacheKey, useCosteoMuestrasStore } from '@/store/costeoMuestrasStore'
import type {
  IngredienteRow,
  ProduccionLinea,
  VentaAnalisisPayload,
  VentaAnalisisRow,
  VentaPorReceta,
} from '@/types/costeoMuestras'

import { BiChartTooltip } from './BiChartTooltip'
import { BI_CHART } from './chartTheme'
import { CosteoCatalogSearchSelect } from './CosteoCatalogSearchSelect'
import { hasSelectValue } from './selectHelpers'

function formatPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function formatQty(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('es-HN', { maximumFractionDigits: 2 })
}

function toneMargen(v: number): string {
  if (v > 0) return 'text-[var(--lime)]'
  if (v < 0) return 'text-red-600'
  return 'text-[var(--text-muted)]'
}

function toneVarQty(v: number): string {
  if (v < 0) return 'text-red-600'
  if (v > 0) return 'text-teal-700'
  return 'text-[var(--text-muted)]'
}

/** Etiquetas compactas sobre barras/líneas. */
function formatLpsLabel(v: number): string {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${abs.toFixed(0)}`
}

type Props = {
  onError: (msg: string | null) => void
}

const TODAS_RECETAS = '__todas__'
const TODOS_CLIENTES = '__todos__'

export function VentasAnalisisTab({ onError }: Props) {
  const filtros = useCosteoMuestrasStore((s) => s.ventasFiltros)
  const setVentasFiltros = useCosteoMuestrasStore((s) => s.setVentasFiltros)
  const loadVentasCatalogo = useCosteoMuestrasStore((s) => s.loadVentasCatalogo)
  const loadVentasAnalisis = useCosteoMuestrasStore((s) => s.loadVentasAnalisis)
  const ventasCatalogoMap = useCosteoMuestrasStore((s) => s.ventasCatalogo)
  const ventasAnalisisMap = useCosteoMuestrasStore((s) => s.ventasAnalisis)
  const ventasCatalogoLoading = useCosteoMuestrasStore((s) => s.ventasCatalogoLoading)
  const ventasAnalisisLoading = useCosteoMuestrasStore((s) => s.ventasAnalisisLoading)
  const cacheEpoch = useCosteoMuestrasStore((s) => s.cacheEpoch)

  const filtroReceta = filtros.receta || TODAS_RECETAS
  const filtroCodigoCliente = filtros.codigo_cliente || TODOS_CLIENTES
  const filtroDesde = filtros.desde
  const filtroHasta = filtros.hasta
  const recetaParam = filtroReceta === TODAS_RECETAS ? undefined : filtroReceta
  const codigoClienteParam = filtroCodigoCliente === TODOS_CLIENTES ? undefined : filtroCodigoCliente

  const catKey = useMemo(
    () =>
      costeoCacheKey({
        receta: recetaParam,
        desde: filtroDesde || undefined,
        hasta: filtroHasta || undefined,
      }),
    [recetaParam, filtroDesde, filtroHasta],
  )
  const anKey = useMemo(
    () =>
      costeoCacheKey({
        receta: recetaParam,
        codigo_cliente: codigoClienteParam,
        desde: filtroDesde || undefined,
        hasta: filtroHasta || undefined,
      }),
    [recetaParam, codigoClienteParam, filtroDesde, filtroHasta],
  )

  const catalogoPayload = ventasCatalogoMap[catKey]
  const data: VentaAnalisisPayload | null = ventasAnalisisMap[anKey] ?? null

  const loadCatalogo = useCallback(async (force = false) => {
    onError(null)
    try {
      const payload = await loadVentasCatalogo({ force })
      const ok = payload.clientes.some(
        (c) => c.codigo_cliente === filtroCodigoCliente && hasSelectValue(c.codigo_cliente),
      )
      if (filtroCodigoCliente !== TODOS_CLIENTES && !ok) {
        setVentasFiltros({ codigo_cliente: TODOS_CLIENTES })
      }
    } catch (e) {
      onError((e as Error).message)
    }
  }, [loadVentasCatalogo, onError, filtroCodigoCliente, setVentasFiltros])

  const load = useCallback(async (force = false) => {
    onError(null)
    try {
      await loadVentasAnalisis({ force })
    } catch (e) {
      onError((e as Error).message)
    }
  }, [loadVentasAnalisis, onError])

  useEffect(() => {
    void loadCatalogo()
  }, [loadCatalogo, catKey, cacheEpoch])

  useEffect(() => {
    void load()
  }, [load, anKey, cacheEpoch])

  const loadingCatalogo = ventasCatalogoLoading && !catalogoPayload
  const loading = ventasAnalisisLoading && !data

  const opcionesReceta = useMemo(
    () =>
      (catalogoPayload?.recetas ?? [])
        .filter((r) => hasSelectValue(r.receta_code))
        .map((r) => ({
          value: r.receta_code,
          code: r.receta_code,
          label: r.receta_nombre || r.receta_code,
        })),
    [catalogoPayload],
  )

  const opcionesCliente = useMemo(
    () =>
      (catalogoPayload?.clientes ?? [])
        .filter((c) => hasSelectValue(c.codigo_cliente))
        .map((c) => ({
          value: c.codigo_cliente,
          code: c.codigo_cliente,
          label: c.cliente || c.codigo_cliente,
        })),
    [catalogoPayload],
  )

  const chartComparativa = useMemo(() => {
    if (!data) return []
    return data.por_receta.slice(0, 10).map((r) => ({
      name: r.receta_nombre.length > 16 ? `${r.receta_nombre.slice(0, 14)}…` : r.receta_nombre,
      teórico: r.costo_teorico,
      produccion: r.costo_produccion,
      venta: r.venta,
    }))
  }, [data])

  const chartVariacion = useMemo(() => {
    if (!data) return []
    return [...data.por_receta]
      .sort((a, b) => Math.abs(b.variacion) - Math.abs(a.variacion))
      .slice(0, 10)
      .map((r) => ({
        name: r.receta_code || r.receta_nombre.slice(0, 12),
        variacion: r.variacion,
      }))
  }, [data])

  const donutMargen = useMemo(() => {
    if (!data) return []
    const { total_costo, total_margen } = data.resumen
    return [
      { name: 'Margen', value: Math.max(total_margen, 0), fill: BI_CHART.lime },
      { name: 'Costo producción', value: total_costo, fill: BI_CHART.coral },
    ]
  }, [data])

  const tendenciaMes = useMemo(() => {
    if (!data) return []
    const byPeriod = new Map<string, { periodo: string; costo: number; margen: number; teorico: number }>()
    for (const row of data.detalle) {
      const key = row.periodo || (row.fecha ? row.fecha.slice(0, 7) : 'Sin fecha')
      const prev = byPeriod.get(key) ?? { periodo: key, costo: 0, margen: 0, teorico: 0 }
      prev.costo += row.costo
      prev.margen += row.margen
      prev.teorico += row.costo_teorico
      byPeriod.set(key, prev)
    }
    return [...byPeriod.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
  }, [data])

  if (loadingCatalogo && !catalogoPayload) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
        <Loader2 className="size-6 animate-spin text-[var(--navy)]" />
        <p className="text-sm">Cargando clientes…</p>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando análisis ventas/costos…
      </div>
    )
  }

  const res = data?.resumen

  return (
    <div className="space-y-4">
      <Card className="border-l-4 bg-gradient-to-r from-[#DCE6F1]/80 to-white" style={{ borderLeftColor: BI_CHART.sky }}>
        <CardContent className="flex flex-wrap items-end gap-2 px-3 py-2.5">
          <div className="mr-auto flex min-w-0 items-center gap-1.5 pb-1.5 pr-2">
            <Scale className="size-4 shrink-0" style={{ color: BI_CHART.navy }} />
            <span className="text-sm font-semibold text-[var(--text)]">
              Venta vs producción
            </span>
          </div>
          <div className="w-[200px] max-w-full">
            <Label htmlFor="v-receta" className="text-[11px]">Receta</Label>
            <CosteoCatalogSearchSelect
              id="v-receta"
              options={opcionesReceta}
              value={filtroReceta}
              allValue={TODAS_RECETAS}
              allLabel="Todas las recetas"
              placeholder="Código o nombre…"
              disabled={loadingCatalogo}
              compact
              onChange={(v) => {
                setVentasFiltros({ receta: v, codigo_cliente: TODOS_CLIENTES })
              }}
            />
          </div>
          <div className="w-[200px] max-w-full">
            <Label htmlFor="v-cliente" className="text-[11px]">Cliente</Label>
            <CosteoCatalogSearchSelect
              id="v-cliente"
              options={opcionesCliente}
              value={filtroCodigoCliente}
              allValue={TODOS_CLIENTES}
              allLabel="Todos los clientes"
              placeholder="Código o nombre…"
              disabled={loadingCatalogo}
              compact
              onChange={(v) => setVentasFiltros({ codigo_cliente: v })}
            />
          </div>
          <div className="w-[138px]">
            <Label htmlFor="v-desde" className="text-[11px]">Desde</Label>
            <Input
              id="v-desde"
              type="date"
              className="mt-0.5 h-8 text-xs"
              value={filtroDesde}
              onChange={(e) => setVentasFiltros({ desde: e.target.value })}
            />
          </div>
          <div className="w-[138px]">
            <Label htmlFor="v-hasta" className="text-[11px]">Hasta</Label>
            <Input
              id="v-hasta"
              type="date"
              className="mt-0.5 h-8 text-xs"
              value={filtroHasta}
              onChange={(e) => setVentasFiltros({ hasta: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8"
            onClick={() => {
              void loadCatalogo(true)
              void load(true)
            }}
            disabled={loading || loadingCatalogo}
          >
            {(loading || loadingCatalogo) ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Aplicar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={!data}
            onClick={() => {
              if (data) exportVentasAnalisisExcel(data)
            }}
          >
            <FileSpreadsheet className="mr-1.5 size-3.5" />
            Excel
          </Button>
        </CardContent>
      </Card>

      {data && res ? (
        <>
          {data.aviso ? (
            <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {data.aviso}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.sky }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="text-[11px] text-[var(--text-muted)]">Venta total</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className="text-base font-bold" style={{ color: BI_CHART.navy }}>{formatLps(res.total_venta)}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.amber }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="text-[11px] text-[var(--text-muted)]">Costo teórico (BOM)</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className="text-base font-bold" style={{ color: BI_CHART.amber }}>{formatLps(res.total_costo_teorico)}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.coral }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="text-[11px] text-[var(--text-muted)]">Costo producción real</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className="text-base font-bold" style={{ color: BI_CHART.coral }}>{formatLps(res.total_costo)}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: ((res.total_qty_producida ?? 0) - (res.total_qty_vendida ?? 0)) < 0 ? BI_CHART.red : BI_CHART.teal }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  Variación qty (prod − venta)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className={cn('text-base font-bold', toneVarQty((res.total_qty_producida ?? 0) - (res.total_qty_vendida ?? 0)))}>
                  {formatQty((res.total_qty_producida ?? 0) - (res.total_qty_vendida ?? 0))}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Venta {formatQty(res.total_qty_vendida)} · Prod {formatQty(res.total_qty_producida)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: (res.total_margen ?? 0) >= 0 ? BI_CHART.lime : BI_CHART.red }}>
              <CardHeader className="px-3 pb-1 pt-2">
                <CardTitle className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <TrendingUp className="size-3" style={{ color: (res.total_margen ?? 0) >= 0 ? BI_CHART.lime : BI_CHART.red }} />
                  Margen total
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <p className={cn('text-base font-bold', toneMargen(res.total_margen))}>{formatLps(res.total_margen)}</p>
                <p className={cn('text-[11px]', toneMargen(res.total_margen))}>{formatPct(res.margen_pct)} s/ venta</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm">Venta vs producción (top 10)</CardTitle>
              </CardHeader>
              <CardContent className="h-72 px-3 pb-3">
                {chartComparativa.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartComparativa} margin={{ top: 16, bottom: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E4E8" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis tickFormatter={(v) => formatLps(Number(v))} width={64} tick={{ fontSize: 10 }} />
                      <Tooltip content={<BiChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="teórico" name="Costo teórico" fill={BI_CHART.amber} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="teórico" position="top" formatter={(v) => formatLpsLabel(Number(v))} style={{ fontSize: 9, fill: '#6B7280' }} />
                      </Bar>
                      <Bar dataKey="produccion" name="Costo producción" fill={BI_CHART.coral} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="produccion" position="top" formatter={(v) => formatLpsLabel(Number(v))} style={{ fontSize: 9, fill: '#6B7280' }} />
                      </Bar>
                      <Bar dataKey="venta" name="Venta" fill={BI_CHART.navy} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="venta" position="top" formatter={(v) => formatLpsLabel(Number(v))} style={{ fontSize: 9, fill: '#6B7280' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm">Composición venta</CardTitle>
              </CardHeader>
              <CardContent className="h-72 px-3 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutMargen}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={3}
                      label={({ name, value, percent }) =>
                        `${name}: ${formatLpsLabel(Number(value))} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                      labelLine
                    >
                      {donutMargen.map((e) => (
                        <Cell key={e.name} fill={e.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<BiChartTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="px-3 py-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="size-3.5" style={{ color: BI_CHART.amber }} />
                  Desviación de costo por receta
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64 px-3 pb-3">
                {chartVariacion.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">Sin variaciones.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartVariacion} layout="vertical" margin={{ right: 48 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatLps(Number(v))} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
                      <Tooltip content={<BiChartTooltip />} />
                      <Bar dataKey="variacion" name="Variación" radius={[0, 4, 4, 0]}>
                        {chartVariacion.map((e) => (
                          <Cell key={e.name} fill={e.variacion > 0 ? BI_CHART.red : BI_CHART.teal} />
                        ))}
                        <LabelList
                          dataKey="variacion"
                          position="right"
                          formatter={(v) => formatLpsLabel(Number(v))}
                          style={{ fontSize: 10, fill: '#1A1A2E' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm">Tendencia por periodo</CardTitle>
              </CardHeader>
              <CardContent className="h-64 px-3 pb-3">
                {tendenciaMes.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[var(--text-muted)]">Sin periodos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={tendenciaMes} margin={{ top: 16, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatLps(Number(v))} width={64} tick={{ fontSize: 10 }} />
                      <Tooltip content={<BiChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="teorico" name="Teórico" fill={BI_CHART.amber} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="teorico" position="top" formatter={(v) => formatLpsLabel(Number(v))} style={{ fontSize: 8, fill: '#6B7280' }} />
                      </Bar>
                      <Bar dataKey="costo" name="Producción" fill={BI_CHART.coral} radius={[3, 3, 0, 0]}>
                        <LabelList dataKey="costo" position="top" formatter={(v) => formatLpsLabel(Number(v))} style={{ fontSize: 8, fill: '#6B7280' }} />
                      </Bar>
                      <Line type="monotone" dataKey="margen" name="Margen" stroke={BI_CHART.lime} strokeWidth={2.5} dot={{ r: 3 }}>
                        <LabelList dataKey="margen" position="top" formatter={(v) => formatLpsLabel(Number(v))} style={{ fontSize: 9, fill: BI_CHART.lime }} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-sm">Venta vs producción — por receta</CardTitle>
              <p className="text-[11px] text-[var(--text-muted)]">
                Compara qty y monto de venta contra producción. Margen = venta − costo producción
                (verde positivo, rojo negativo). Expanda para ver el detalle de receta.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto px-3 pb-3">
              <ResumenPorRecetaTable
                rows={data.por_receta}
                resumen={res}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Detalle y validación</CardTitle>
              {data.produccion_error ? (
                <p className="text-xs text-amber-800">Producción: {data.produccion_error}</p>
              ) : data.campos_venta?.factura || data.campos_venta?.orden_produccion ? (
                <p className="text-[11px] text-[var(--text-muted)]">
                  Campos venta:{' '}
                  {[
                    data.campos_venta.factura ? `factura→${data.campos_venta.factura}` : null,
                    data.campos_venta.orden_produccion
                      ? `orden→${data.campos_venta.orden_produccion}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              ) : (
                <p className="text-[11px] text-amber-800">
                  No se detectó columna de factura u orden en VW_BI_VENTA_COSTO; se relaciona por receta/periodo.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="lineas">
                <TabsList className="mb-3 h-9">
                  <TabsTrigger value="lineas" className="text-xs">Detalle por línea</TabsTrigger>
                  <TabsTrigger value="relacion" className="text-xs">Venta-Producción</TabsTrigger>
                </TabsList>

                <TabsContent value="lineas" className="mt-0 overflow-x-auto">
                  <DetalleLineasTable
                    rows={data.detalle}
                    desde={filtroDesde}
                    hasta={filtroHasta}
                  />
                </TabsContent>

                <TabsContent value="relacion" className="mt-0 overflow-x-auto">
                  <RelacionVentaOpTable
                    rows={data.relacion_venta_op ?? []}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function ResumenPorRecetaTable({
  rows,
  resumen,
}: {
  rows: VentaPorReceta[]
  resumen: VentaAnalisisPayload['resumen']
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [ingsByReceta, setIngsByReceta] = useState<Record<string, IngredienteRow[]>>({})
  const [prodByReceta, setProdByReceta] = useState<Record<string, ProduccionLinea[]>>({})
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const ensureDetalle = async (code: string) => {
    if (!code || (ingsByReceta[code] && prodByReceta[code])) return
    setLoadingKey(code)
    setLoadError(null)
    try {
      const [det, prod] = await Promise.all([
        ingsByReceta[code] ? null : fetchRecetaDetalle(code),
        prodByReceta[code] ? null : fetchProduccionReceta({ receta: code }),
      ])
      if (det) {
        setIngsByReceta((prev) => ({ ...prev, [code]: det.ingredientes }))
      }
      if (prod) {
        setProdByReceta((prev) => ({ ...prev, [code]: prod.lineas.filter((l) => !l.componente_code) }))
      }
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoadingKey(null)
    }
  }

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else {
        next.add(code)
        void ensureDetalle(code)
      }
      return next
    })
  }

  const qtyVendida = resumen.total_qty_vendida ?? rows.reduce((s, r) => s + r.cantidad, 0)
  const qtyProducida = resumen.total_qty_producida ?? rows.reduce((s, r) => s + (r.qty_producida ?? 0), 0)
  const varQtyTotal = qtyProducida - qtyVendida
  const varQtyPct = qtyVendida > 0 ? (varQtyTotal / qtyVendida) * 100 : 0

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[var(--gray-lt)]">
          <TableHead rowSpan={2} className="w-8 align-bottom" />
          <TableHead rowSpan={2} className="align-bottom">Receta</TableHead>
          <TableHead
            colSpan={2}
            className="border-l text-center text-[11px] font-semibold"
            style={{ color: BI_CHART.lime }}
          >
            Venta
          </TableHead>
          <TableHead
            colSpan={2}
            className="border-l text-center text-[11px] font-semibold"
            style={{ color: BI_CHART.coral }}
          >
            Producción
          </TableHead>
          <TableHead
            colSpan={2}
            className="border-l text-center text-[11px] font-semibold text-[var(--text-muted)]"
          >
            Variación venta–producción
          </TableHead>
          <TableHead
            colSpan={2}
            className="border-l text-center text-[11px] font-semibold"
          >
            Margen
          </TableHead>
        </TableRow>
        <TableRow className="bg-[var(--gray-lt)]">
          <TableHead className="border-l text-right text-[10px]">Qty</TableHead>
          <TableHead className="text-right text-[10px]">Monto</TableHead>
          <TableHead className="border-l text-right text-[10px]">Qty</TableHead>
          <TableHead className="text-right text-[10px]">Costo</TableHead>
          <TableHead className="border-l text-right text-[10px]">Qty</TableHead>
          <TableHead className="text-right text-[10px]">Monto</TableHead>
          <TableHead className="border-l text-right text-[10px]">Lps</TableHead>
          <TableHead className="text-right text-[10px]">%</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const key = r.receta_code || r.receta_nombre
          const open = expanded.has(key)
          const ings = ingsByReceta[r.receta_code] ?? []
          const prod = prodByReceta[r.receta_code] ?? []
          const loading = loadingKey === r.receta_code
          const qtyProd = r.qty_producida ?? 0
          const varQty = r.var_qty ?? qtyProd - r.cantidad
          const varQtyPctRow = r.var_qty_pct ?? (r.cantidad > 0 ? (varQty / r.cantidad) * 100 : 0)
          return (
            <Fragment key={key}>
              <TableRow
                className={cn('cursor-pointer', open && 'bg-[var(--blue-lt)]/40')}
                onClick={() => toggle(key)}
              >
                <TableCell className="px-1">
                  {open ? (
                    <ChevronDown className="size-3.5 text-[var(--navy)]" />
                  ) : (
                    <ChevronRight className="size-3.5 text-[var(--navy)]" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{r.receta_nombre}</div>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{r.receta_code}</span>
                </TableCell>
                <TableCell className="border-l text-right tabular-nums">{formatQty(r.cantidad)}</TableCell>
                <TableCell className="text-right font-medium" style={{ color: BI_CHART.lime }}>
                  {formatLps(r.venta)}
                </TableCell>
                <TableCell className="border-l text-right tabular-nums" style={{ color: BI_CHART.coral }}>
                  {formatQty(qtyProd)}
                </TableCell>
                <TableCell className="text-right" style={{ color: BI_CHART.coral }}>
                  {formatLps(r.costo_produccion)}
                </TableCell>
                <TableCell className={cn('border-l text-right font-medium', toneVarQty(varQty))}>
                  {formatQty(varQty)}
                  <div className="text-[10px] font-normal text-[var(--text-muted)]">
                    {formatPct(varQtyPctRow)}
                  </div>
                </TableCell>
                <TableCell className={cn('text-right font-medium', toneMargen(r.variacion))}>
                  {formatLps(r.variacion)}
                  <div className="text-[10px] font-normal text-[var(--text-muted)]">
                    {formatPct(r.variacion_pct)}
                  </div>
                </TableCell>
                <TableCell className={cn('border-l text-right font-semibold', toneMargen(r.margen))}>
                  {formatLps(r.margen)}
                </TableCell>
                <TableCell className={cn('text-right font-semibold', toneMargen(r.margen))}>
                  {formatPct(r.margen_pct)}
                </TableCell>
              </TableRow>
              {open ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={10} className="bg-[var(--gray-bg)] p-0">
                    <div className="grid gap-3 border-t border-[var(--border)] px-3 py-3 lg:grid-cols-2">
                      {loading ? (
                        <p className="col-span-2 flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-muted)]">
                          <Loader2 className="size-3.5 animate-spin" />
                          Cargando detalle de receta…
                        </p>
                      ) : null}
                      {loadError && !loading ? (
                        <p className="col-span-2 py-2 text-center text-xs text-amber-800">{loadError}</p>
                      ) : null}
                      {!loading ? (
                        <>
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
                              Detalle receta (BOM) — {r.receta_code}
                            </p>
                            {ings.length === 0 ? (
                              <p className="py-2 text-center text-xs text-[var(--text-muted)]">
                                Sin ingredientes.
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Componente</TableHead>
                                    <TableHead className="text-right text-xs">Cant.</TableHead>
                                    <TableHead className="text-right text-xs">Costo</TableHead>
                                    <TableHead className="text-right text-xs">%</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ings.slice(0, 40).map((ing, j) => (
                                    <TableRow key={`${ing.componente_code}-${j}`}>
                                      <TableCell className="text-xs">
                                        <span className="bi-sentence-case">{ing.componente_nombre}</span>
                                        <div className="font-mono text-[10px] text-[var(--text-muted)]">
                                          {ing.componente_code}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right text-xs tabular-nums">
                                        {ing.cantidad.toLocaleString('es-HN', { maximumFractionDigits: 4 })}
                                        {ing.unidad ? ` ${ing.unidad}` : ''}
                                      </TableCell>
                                      <TableCell className="text-right text-xs">
                                        {formatLps(ing.costo_teorico)}
                                      </TableCell>
                                      <TableCell className="text-right text-xs">
                                        {ing.pct_costo.toFixed(1)}%
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
                              Órdenes de producción ({r.ordenes || prod.length})
                            </p>
                            {prod.length === 0 ? (
                              <p className="py-2 text-center text-xs text-[var(--text-muted)]">
                                Sin OP para esta receta en el rango.
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">OP</TableHead>
                                    <TableHead className="text-xs">Fecha</TableHead>
                                    <TableHead className="text-right text-xs">Qty</TableHead>
                                    <TableHead className="text-right text-xs">Costo</TableHead>
                                    <TableHead className="text-xs">Estado</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {prod.slice(0, 30).map((l, j) => (
                                    <TableRow key={`${l.orden}-${j}`}>
                                      <TableCell className="font-mono text-xs">{l.orden || '—'}</TableCell>
                                      <TableCell className="text-xs">
                                        {l.fecha ? formatDateDMY(l.fecha) : '—'}
                                      </TableCell>
                                      <TableCell className="text-right text-xs tabular-nums">
                                        {formatQty(l.cantidad)}
                                      </TableCell>
                                      <TableCell className="text-right text-xs">{formatLps(l.costo)}</TableCell>
                                      <TableCell className="text-xs">{l.estado || '—'}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          )
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="bg-[var(--gray-lt)] font-semibold">
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="border-l text-right">{formatQty(qtyVendida)}</TableCell>
          <TableCell className="text-right">{formatLps(resumen.total_venta)}</TableCell>
          <TableCell className="border-l text-right">{formatQty(qtyProducida)}</TableCell>
          <TableCell className="text-right">{formatLps(resumen.total_costo)}</TableCell>
          <TableCell className={cn('border-l text-right', toneVarQty(varQtyTotal))}>
            {formatQty(varQtyTotal)}
            <div className="text-[10px] font-normal text-[var(--text-muted)]">{formatPct(varQtyPct)}</div>
          </TableCell>
          <TableCell className={cn('text-right', toneMargen(resumen.total_variacion))}>
            {formatLps(resumen.total_variacion)}
            <div className="text-[10px] font-normal text-[var(--text-muted)]">
              {formatPct(resumen.variacion_pct)}
            </div>
          </TableCell>
          <TableCell className={cn('border-l text-right', toneMargen(resumen.total_margen))}>
            {formatLps(resumen.total_margen)}
          </TableCell>
          <TableCell className={cn('text-right', toneMargen(resumen.total_margen))}>
            {formatPct(resumen.margen_pct)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

function matchBadge(match: string) {
  switch (match) {
    case 'orden':
      return <Badge className="bg-[var(--lime)] text-[var(--navy)]">Por orden</Badge>
    case 'receta_periodo':
      return <Badge variant="outline" className="border-[var(--navy)] text-[var(--navy)]">Receta + periodo</Badge>
    case 'receta':
      return <Badge variant="secondary">Solo receta</Badge>
    default:
      return <Badge variant="outline" className="text-amber-800">Sin OP</Badge>
  }
}

function DetalleLineasTable({
  rows,
  desde,
  hasta,
}: {
  rows: VentaAnalisisRow[]
  desde?: string
  hasta?: string
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [ingsByReceta, setIngsByReceta] = useState<Record<string, IngredienteRow[]>>({})
  const [prodByKey, setProdByKey] = useState<Record<string, ProduccionLinea[]>>({})
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const toggle = (i: number, row: VentaAnalisisRow) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else {
        next.add(i)
        void ensureDetalle(row)
      }
      return next
    })
  }

  const ensureDetalle = async (row: VentaAnalisisRow) => {
    const code = row.receta_code
    if (!code) return
    const prodKey = `${code}|${row.orden_produccion || ''}`
    const needBom = !ingsByReceta[code]
    const needProd = !prodByKey[prodKey]
    if (!needBom && !needProd) return

    setLoadingKey(prodKey)
    setLoadError(null)
    try {
      if (needBom) {
        const det = await fetchRecetaDetalle(code)
        setIngsByReceta((prev) => ({ ...prev, [code]: det.ingredientes }))
      }
      if (needProd) {
        const prod = await fetchProduccionReceta({
          receta: code,
          orden: row.orden_produccion || undefined,
          desde: desde || undefined,
          hasta: hasta || undefined,
        })
        setProdByKey((prev) => ({ ...prev, [prodKey]: prod.lineas }))
      }
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8" />
          <TableHead>Factura</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Receta</TableHead>
          <TableHead>Orden OP</TableHead>
          <TableHead className="text-right">Cant.</TableHead>
          <TableHead className="text-right">Venta</TableHead>
          <TableHead className="text-right">Teórico</TableHead>
          <TableHead className="text-right">Producción</TableHead>
          <TableHead className="text-right">Variación</TableHead>
          <TableHead className="text-right">Margen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 300).map((d, i) => {
          const open = expanded.has(i)
          const prodKey = `${d.receta_code}|${d.orden_produccion || ''}`
          const ings = ingsByReceta[d.receta_code] ?? []
          const prodShow = (prodByKey[prodKey] ?? []).slice(0, 40)
          const loading = loadingKey === prodKey
          return (
            <Fragment key={`${d.factura}-${d.receta_code}-${d.codigo_cliente}-${i}`}>
              <TableRow
                className={cn('cursor-pointer', open && 'bg-[var(--blue-lt)]/40')}
                onClick={() => toggle(i, d)}
              >
                <TableCell className="px-1">
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded text-[var(--navy)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(i, d)
                    }}
                  >
                    {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </button>
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold text-[var(--navy)]">
                  {d.factura || '—'}
                </TableCell>
                <TableCell className="text-xs">{d.fecha ? formatDateDMY(d.fecha) : '—'}</TableCell>
                <TableCell className="max-w-[120px] truncate text-xs">{d.cliente}</TableCell>
                <TableCell>
                  <div className="font-mono text-xs">{d.receta_code}</div>
                  <div className="max-w-[140px] truncate text-[10px] text-[var(--text-muted)]">
                    {d.receta_nombre}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{d.orden_produccion || '—'}</TableCell>
                <TableCell className="text-right text-xs">
                  {d.cantidad > 0 ? d.cantidad.toLocaleString('es-HN') : '—'}
                </TableCell>
                <TableCell className="text-right">{formatLps(d.venta)}</TableCell>
                <TableCell className="text-right">{formatLps(d.costo_teorico)}</TableCell>
                <TableCell className="text-right">{formatLps(d.costo)}</TableCell>
                <TableCell className={`text-right ${d.variacion > 0 ? 'text-red-600' : 'text-teal-700'}`}>
                  {formatLps(d.variacion)}
                </TableCell>
                <TableCell className={cn('text-right font-medium', toneMargen(d.margen))}>{formatLps(d.margen)}</TableCell>
              </TableRow>
              {open ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={12} className="bg-[var(--gray-bg)] p-0">
                    <div className="grid gap-3 border-t border-[var(--border)] px-3 py-3 lg:grid-cols-2">
                      {loading ? (
                        <p className="col-span-2 flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-muted)]">
                          <Loader2 className="size-3.5 animate-spin" />
                          Cargando BOM y producción…
                        </p>
                      ) : null}
                      {loadError && !loading ? (
                        <p className="col-span-2 py-2 text-center text-xs text-amber-800">{loadError}</p>
                      ) : null}
                      {!loading ? (
                        <>
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
                              Detalle receta (BOM) — {d.receta_code}
                            </p>
                            {ings.length === 0 ? (
                              <p className="py-2 text-center text-xs text-[var(--text-muted)]">Sin ingredientes.</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Componente</TableHead>
                                    <TableHead className="text-right text-xs">Cant.</TableHead>
                                    <TableHead className="text-right text-xs">Costo</TableHead>
                                    <TableHead className="text-right text-xs">%</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {ings.slice(0, 40).map((ing, j) => (
                                    <TableRow key={`${ing.componente_code}-${j}`}>
                                      <TableCell className="text-xs">
                                        <span className="bi-sentence-case">{ing.componente_nombre}</span>
                                        <div className="font-mono text-[10px] text-[var(--text-muted)]">
                                          {ing.componente_code}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right text-xs tabular-nums">
                                        {ing.cantidad.toLocaleString('es-HN', { maximumFractionDigits: 4 })}
                                        {ing.unidad ? ` ${ing.unidad}` : ''}
                                      </TableCell>
                                      <TableCell className="text-right text-xs">{formatLps(ing.costo_teorico)}</TableCell>
                                      <TableCell className="text-right text-xs">{ing.pct_costo.toFixed(1)}%</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-[var(--text-muted)]">
                              Producción relacionada
                              {d.orden_produccion ? ` · OP ${d.orden_produccion}` : ''}
                            </p>
                            {prodShow.length === 0 ? (
                              <p className="py-2 text-center text-xs text-[var(--text-muted)]">
                                Sin líneas de producción para esta receta.
                              </p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Orden</TableHead>
                                    <TableHead className="text-xs">Fecha</TableHead>
                                    <TableHead className="text-xs">Estado</TableHead>
                                    <TableHead className="text-right text-xs">Cant.</TableHead>
                                    <TableHead className="text-right text-xs">Costo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {prodShow.map((p, j) => (
                                    <TableRow key={`${p.orden}-${j}`}>
                                      <TableCell className="font-mono text-xs">{p.orden || '—'}</TableCell>
                                      <TableCell className="text-xs">
                                        {p.fecha ? formatDateDMY(p.fecha) : p.periodo || '—'}
                                      </TableCell>
                                      <TableCell className="text-xs">{p.estado || p.almacen || '—'}</TableCell>
                                      <TableCell className="text-right text-xs">
                                        {p.cantidad > 0
                                          ? p.cantidad.toLocaleString('es-HN', { maximumFractionDigits: 2 })
                                          : '—'}
                                      </TableCell>
                                      <TableCell className="text-right text-xs">{formatLps(p.costo)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          )
        })}
      </TableBody>
    </Table>
  )
}

function RelacionVentaOpTable({
  rows,
}: {
  rows: NonNullable<VentaAnalisisPayload['relacion_venta_op']>
}) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-muted)]">
        No hay relaciones venta ↔ producción para los filtros actuales.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Factura</TableHead>
          <TableHead>Fecha venta</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Receta</TableHead>
          <TableHead className="text-right">Venta</TableHead>
          <TableHead>Orden OP</TableHead>
          <TableHead>Fecha OP</TableHead>
          <TableHead className="text-right">Cant. OP</TableHead>
          <TableHead className="text-right">Costo OP</TableHead>
          <TableHead>Cruce</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 400).map((r, i) => (
          <TableRow key={`${r.factura}-${r.orden_produccion}-${i}`}>
            <TableCell className="font-mono text-xs font-semibold text-[var(--navy)]">
              {r.factura || '—'}
            </TableCell>
            <TableCell className="text-xs">
              {r.fecha_venta ? formatDateDMY(r.fecha_venta) : r.periodo || '—'}
            </TableCell>
            <TableCell className="max-w-[120px] truncate text-xs">{r.cliente}</TableCell>
            <TableCell>
              <div className="font-mono text-xs">{r.receta_code}</div>
              <div className="max-w-[120px] truncate text-[10px] text-[var(--text-muted)]">
                {r.receta_nombre}
              </div>
            </TableCell>
            <TableCell className="text-right text-xs">{formatLps(r.venta)}</TableCell>
            <TableCell className="font-mono text-xs font-medium">
              {r.orden_produccion || '—'}
            </TableCell>
            <TableCell className="text-xs">
              {r.fecha_op ? formatDateDMY(r.fecha_op) : '—'}
            </TableCell>
            <TableCell className="text-right text-xs">
              {r.cantidad_op > 0
                ? r.cantidad_op.toLocaleString('es-HN', { maximumFractionDigits: 2 })
                : '—'}
            </TableCell>
            <TableCell className="text-right text-xs">{formatLps(r.costo_op)}</TableCell>
            <TableCell>{matchBadge(r.match)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

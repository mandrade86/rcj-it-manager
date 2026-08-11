import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchVentasAnalisis, fetchVentasCatalogo } from '@/lib/api/costeoMuestras'
import { formatDateDMY, formatLps } from '@/lib/format'
import type {
  ClienteCatalogoItem,
  RecetaVentaCatalogoItem,
  VentaAnalisisPayload,
} from '@/types/costeoMuestras'

import { BiChartTooltip } from './BiChartTooltip'
import { BI_CHART } from './chartTheme'

function formatPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

type Props = {
  onError: (msg: string | null) => void
}

const TODAS_RECETAS = '__todas__'
const TODOS_CLIENTES = '__todos__'

export function VentasAnalisisTab({ onError }: Props) {
  const [loading, setLoading] = useState(true)
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)
  const [data, setData] = useState<VentaAnalisisPayload | null>(null)
  const [catalogoRecetas, setCatalogoRecetas] = useState<RecetaVentaCatalogoItem[]>([])
  const [catalogoClientes, setCatalogoClientes] = useState<ClienteCatalogoItem[]>([])
  const [filtroReceta, setFiltroReceta] = useState(TODAS_RECETAS)
  const [filtroCodigoCliente, setFiltroCodigoCliente] = useState(TODOS_CLIENTES)
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const recetaParam = filtroReceta === TODAS_RECETAS ? undefined : filtroReceta
  const codigoClienteParam = filtroCodigoCliente === TODOS_CLIENTES ? undefined : filtroCodigoCliente

  const loadCatalogo = useCallback(async () => {
    setLoadingCatalogo(true)
    onError(null)
    try {
      const payload = await fetchVentasCatalogo({
        receta: recetaParam,
        recetaExact: true,
        desde: filtroDesde || undefined,
        hasta: filtroHasta || undefined,
      })
      setCatalogoRecetas(payload.recetas)
      setCatalogoClientes(payload.clientes)
      setFiltroCodigoCliente((prev) => {
        if (prev === TODOS_CLIENTES) return prev
        return payload.clientes.some((c) => c.codigo_cliente === prev) ? prev : TODOS_CLIENTES
      })
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setLoadingCatalogo(false)
    }
  }, [recetaParam, filtroDesde, filtroHasta, onError])

  const load = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const payload = await fetchVentasAnalisis({
        codigo_cliente: codigoClienteParam,
        receta: recetaParam,
        recetaExact: true,
        desde: filtroDesde || undefined,
        hasta: filtroHasta || undefined,
      })
      setData(payload)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [codigoClienteParam, recetaParam, filtroDesde, filtroHasta, onError])

  useEffect(() => {
    void loadCatalogo()
  }, [loadCatalogo])

  useEffect(() => {
    void load()
  }, [load])

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

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando análisis ventas/costos…
      </div>
    )
  }

  const res = data?.resumen
  const variacionAlza = (res?.total_variacion ?? 0) > 0

  return (
    <div className="space-y-6">
      <Card className="border-l-4 bg-gradient-to-r from-[#DCE6F1]/80 to-white" style={{ borderLeftColor: BI_CHART.sky }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-5" style={{ color: BI_CHART.navy }} />
            Análisis inventario de costos — teórico vs producción
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)]">
            Cruce entre costo teórico de receta (BOM) y costo real de producción/venta.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="v-receta">Receta</Label>
            <Select
              value={filtroReceta}
              onValueChange={(v) => {
                setFiltroReceta(v)
                setFiltroCodigoCliente(TODOS_CLIENTES)
              }}
              disabled={loadingCatalogo}
            >
              <SelectTrigger id="v-receta">
                <SelectValue placeholder="Seleccione receta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS_RECETAS}>Todas las recetas</SelectItem>
                {catalogoRecetas.map((r) => (
                  <SelectItem key={r.receta_code} value={r.receta_code}>
                    {r.receta_nombre} ({r.receta_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="v-cliente">Cliente</Label>
            <Select
              value={filtroCodigoCliente}
              onValueChange={setFiltroCodigoCliente}
              disabled={loadingCatalogo}
            >
              <SelectTrigger id="v-cliente">
                <SelectValue placeholder="Seleccione cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_CLIENTES}>Todos los clientes</SelectItem>
                {catalogoClientes.map((c) => (
                  <SelectItem key={c.codigo_cliente} value={c.codigo_cliente}>
                    {c.cliente} ({c.codigo_cliente})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {recetaParam ? (
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">
                Clientes con ventas de la receta seleccionada
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="v-desde">Desde</Label>
            <Input id="v-desde" type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="v-hasta">Hasta</Label>
            <Input id="v-hasta" type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadCatalogo()
                void load()
              }}
              disabled={loading || loadingCatalogo}
            >
              {(loading || loadingCatalogo) ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && res ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.sky }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-[var(--text-muted)]">Venta total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold" style={{ color: BI_CHART.navy }}>{formatLps(res.total_venta)}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.amber }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-[var(--text-muted)]">Costo teórico (BOM)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold" style={{ color: BI_CHART.amber }}>{formatLps(res.total_costo_teorico)}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.coral }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-[var(--text-muted)]">Costo producción real</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold" style={{ color: BI_CHART.coral }}>{formatLps(res.total_costo)}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: variacionAlza ? BI_CHART.red : BI_CHART.teal }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  {variacionAlza ? <ArrowUpRight className="size-3 text-red-600" /> : <ArrowDownRight className="size-3 text-teal-600" />}
                  Variación vs teórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold" style={{ color: variacionAlza ? BI_CHART.red : BI_CHART.teal }}>
                  {formatLps(res.total_variacion)}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{formatPct(res.variacion_pct)}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4 border-t-[var(--lime)]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <TrendingUp className="size-3 text-[var(--lime)]" />
                  Margen total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-[var(--lime)]">{formatLps(res.total_margen)}</p>
                <p className="text-xs text-[var(--text-muted)]">{res.margen_pct.toFixed(1)}% s/ venta</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Teórico vs producción vs venta (top 10)</CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                {chartComparativa.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartComparativa} margin={{ bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E0E4E8" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tickFormatter={(v) => formatLps(Number(v))} width={72} tick={{ fontSize: 10 }} />
                      <Tooltip content={<BiChartTooltip />} />
                      <Legend />
                      <Bar dataKey="teórico" name="Costo teórico" fill={BI_CHART.amber} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="produccion" name="Costo producción" fill={BI_CHART.coral} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="venta" name="Venta" fill={BI_CHART.navy} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Composición venta</CardTitle>
              </CardHeader>
              <CardContent className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutMargen} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
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

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Desviación de costo por receta
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {chartVariacion.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin variaciones.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartVariacion} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatLps(Number(v))} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                      <Tooltip content={<BiChartTooltip />} />
                      <Bar dataKey="variacion" name="Variación" radius={[0, 4, 4, 0]}>
                        {chartVariacion.map((e) => (
                          <Cell key={e.name} fill={e.variacion > 0 ? BI_CHART.red : BI_CHART.teal} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tendencia por periodo</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {tendenciaMes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin periodos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={tendenciaMes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatLps(Number(v))} width={70} tick={{ fontSize: 10 }} />
                      <Tooltip content={<BiChartTooltip />} />
                      <Legend />
                      <Bar dataKey="teorico" name="Teórico" fill={BI_CHART.amber} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="costo" name="Producción" fill={BI_CHART.coral} radius={[3, 3, 0, 0]} />
                      <Line type="monotone" dataKey="margen" name="Margen" stroke={BI_CHART.lime} strokeWidth={3} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen por receta</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receta</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead className="text-right">Teórico</TableHead>
                    <TableHead className="text-right">Producción</TableHead>
                    <TableHead className="text-right">Variación</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                    <TableHead className="text-right">Margen %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.por_receta.map((r) => (
                    <TableRow key={r.receta_code || r.receta_nombre}>
                      <TableCell>
                        <div className="font-medium">{r.receta_nombre}</div>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">{r.receta_code}</span>
                      </TableCell>
                      <TableCell className="text-right">{r.cantidad.toLocaleString('es-HN')}</TableCell>
                      <TableCell className="text-right">{formatLps(r.venta)}</TableCell>
                      <TableCell className="text-right text-amber-700">{formatLps(r.costo_teorico)}</TableCell>
                      <TableCell className="text-right text-orange-700">{formatLps(r.costo_produccion)}</TableCell>
                      <TableCell className={`text-right font-medium ${r.variacion > 0 ? 'text-red-600' : 'text-teal-700'}`}>
                        {formatLps(r.variacion)} ({formatPct(r.variacion_pct)})
                      </TableCell>
                      <TableCell className="text-right font-medium text-[var(--lime)]">{formatLps(r.margen)}</TableCell>
                      <TableCell className="text-right">{r.margen_pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-[var(--gray-lt)] font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{formatLps(res.total_venta)}</TableCell>
                    <TableCell className="text-right">{formatLps(res.total_costo_teorico)}</TableCell>
                    <TableCell className="text-right">{formatLps(res.total_costo)}</TableCell>
                    <TableCell className="text-right">{formatLps(res.total_variacion)}</TableCell>
                    <TableCell className="text-right text-[var(--lime)]">{formatLps(res.total_margen)}</TableCell>
                    <TableCell className="text-right">{res.margen_pct.toFixed(1)}%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle por línea</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Receta</TableHead>
                    <TableHead className="text-right">Venta</TableHead>
                    <TableHead className="text-right">Teórico</TableHead>
                    <TableHead className="text-right">Producción</TableHead>
                    <TableHead className="text-right">Variación</TableHead>
                    <TableHead className="text-right">Margen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.detalle.slice(0, 300).map((d, i) => (
                    <TableRow key={`${d.receta_code}-${d.codigo_cliente}-${i}`}>
                      <TableCell>{d.fecha ? formatDateDMY(d.fecha) : '—'}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{d.cliente}</TableCell>
                      <TableCell className="font-mono text-xs">{d.receta_code}</TableCell>
                      <TableCell className="text-right">{formatLps(d.venta)}</TableCell>
                      <TableCell className="text-right">{formatLps(d.costo_teorico)}</TableCell>
                      <TableCell className="text-right">{formatLps(d.costo)}</TableCell>
                      <TableCell className={`text-right ${d.variacion > 0 ? 'text-red-600' : 'text-teal-700'}`}>
                        {formatLps(d.variacion)}
                      </TableCell>
                      <TableCell className="text-right text-[var(--lime)]">{formatLps(d.margen)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

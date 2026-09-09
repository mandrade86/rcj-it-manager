import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Loader2, RefreshCw, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchCostosItDashboard } from '@/lib/api/costosIt'
import { formatDateDMY, formatUsd } from '@/lib/format'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { GastosAnalisisCategoriaTab } from '@/pages/gastos-it/GastosAnalisisCategoriaTab'
import {
  GastosDetalleTablaHeader,
  type GastosDetalleColumnaDef,
} from '@/pages/gastos-it/GastosDetalleTablaHeader'
import { useGastosDetalleTabla } from '@/pages/gastos-it/useGastosDetalleTabla'
import type { CostosItDashboard, CostosItFila } from '@/types/costosIt'

const CHART_COLORS = [
  '#002060',
  '#70AD47',
  '#1F4E79',
  '#C00000',
  '#7F6000',
  '#4527A0',
  '#0F6E56',
  '#375623',
  '#6B7280',
]

const ANIOS_DISPONIBLES = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

function VariacionBadge({ pct, usd }: { pct: number; usd: number }) {
  const sube = usd > 0
  const baja = usd < 0
  const color = sube ? 'text-red-600' : baja ? 'text-green-600' : 'text-[var(--text-muted)]'
  const Icon = sube ? ArrowUpRight : baja ? ArrowDownRight : null
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${color}`}>
      {Icon && <Icon className="size-3.5" />}
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)}% ({usd > 0 ? '+' : ''}
      {formatUsd(usd)})
    </span>
  )
}

const COLUMNAS_DETALLE_COSTOS: GastosDetalleColumnaDef[] = [
  { id: 'anio', label: 'Año', filter: 'select' },
  { id: 'fecha', label: 'Fecha', filter: 'text' },
  { id: 'cuenta', label: 'Nº Cuenta', filter: 'select', className: 'min-w-[110px]' },
  { id: 'categoria', label: 'Categoría', filter: 'select' },
  { id: 'descripcion', label: 'Descripción', filter: 'text', className: 'min-w-[200px]' },
  { id: 'proveedor', label: 'Proveedor', filter: 'select', className: 'min-w-[140px]' },
  { id: 'documento', label: 'Documento', filter: 'text' },
  { id: 'monto', label: 'Monto USD', align: 'right' },
]

export function CostosItPage() {
  const nowYear = new Date().getFullYear()
  const [anioBase, setAnioBase] = useState(nowYear)
  const [anioComp, setAnioComp] = useState(nowYear - 1)
  const [categoria, setCategoria] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [filtrosColumnas, setFiltrosColumnas] = useState<Record<string, string>>({})
  const [categoriasDisponibles, setCategoriasDisponibles] = useState<string[]>([])
  const [data, setData] = useState<CostosItDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    setData(null)
    try {
      const payload = await fetchCostosItDashboard({
        anio_base: anioBase,
        anio_comp: anioComp,
        categoria: categoria === 'todas' ? undefined : categoria,
      })
      setData(payload)
      if (payload.categorias_disponibles?.length) {
        setCategoriasDisponibles(payload.categorias_disponibles)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error cargando gastos IT')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [anioBase, anioComp, categoria])

  useEffect(() => {
    void load()
  }, [load])

  const categoriasOpciones = useMemo(() => {
    if (categoriasDisponibles.length) return categoriasDisponibles
    if (data?.categorias_disponibles?.length) return data.categorias_disponibles
    const base = data?.por_categoria.map((c) => c.categoria) ?? []
    const comp = data?.comparacion.por_categoria.map((c) => c.categoria) ?? []
    return [...new Set([...base, ...comp])].sort((a, b) => a.localeCompare(b, 'es'))
  }, [categoriasDisponibles, data])

  const pieData = useMemo(
    () =>
      (data?.por_categoria ?? []).map((c) => ({
        name: c.categoria,
        value: c.monto,
        pct: c.pct,
      })),
    [data],
  )

  const mesData = useMemo(
    () =>
      (data?.por_mes ?? []).map((m) => ({
        mes: m.mes === 'Sin fecha' ? m.mes : m.mes.slice(5),
        monto: m.monto,
      })),
    [data],
  )

  const comparacionChart = useMemo(() => {
    if (!data) return []
    return data.comparacion.por_categoria
      .filter((c) => c.monto_base > 0 || c.monto_comp > 0)
      .slice(0, 10)
      .map((c) => ({
        categoria: c.categoria.length > 22 ? `${c.categoria.slice(0, 20)}…` : c.categoria,
        categoriaFull: c.categoria,
        [`${data.comparacion.anio_base}`]: c.monto_base,
        [`${data.comparacion.anio_comp}`]: c.monto_comp,
      }))
  }, [data])

  const anioChart = useMemo(
    () =>
      (data?.por_anio ?? []).map((a) => ({
        anio: String(a.anio),
        monto: a.monto,
        transacciones: a.transacciones,
      })),
    [data],
  )

  const matchBusquedaDetalle = useCallback((f: CostosItFila, q: string) =>
      f.descripcion.toLowerCase().includes(q) ||
      f.proveedor.toLowerCase().includes(q) ||
      f.categoria.toLowerCase().includes(q) ||
      f.documento.toLowerCase().includes(q) ||
      f.cuenta.toLowerCase().includes(q) ||
      String(f.anio ?? '').includes(q),
  [],)

  const getValorColumnaDetalle = useCallback((f: CostosItFila, col: string) => {
    switch (col) {
      case 'anio':
        return String(f.anio ?? '')
      case 'fecha':
        return f.fecha ? formatDateDMY(f.fecha) : ''
      case 'cuenta':
        return f.cuenta
      case 'categoria':
        return f.categoria
      case 'descripcion':
        return f.descripcion
      case 'proveedor':
        return f.proveedor
      case 'documento':
        return f.documento
      default:
        return ''
    }
  }, [])

  const setFiltroColumna = useCallback((columna: string, valor: string) => {
    setFiltrosColumnas((prev) => ({ ...prev, [columna]: valor }))
  }, [])

  const limpiarFiltrosColumna = useCallback(() => {
    setFiltrosColumnas({})
  }, [])

  const {
    filasFiltradas,
    filasPagina,
    opcionesColumna,
    pagination: detallePagination,
    hayFiltrosColumna,
  } = useGastosDetalleTabla(
    data?.filas,
    busqueda,
    filtrosColumnas,
    matchBusquedaDetalle,
    getValorColumnaDetalle,
  )

  const comp = data?.comparacion

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Control de gastos IT</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Análisis financiero · SAP HANA — {data?.vista ?? 'VW_COSTOS_IT'}
            {data?.ultimo_sync ? ` · Última lectura: ${formatDateDMY(data.ultimo_sync)}` : ''}
            {' · Moneda: USD'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="comparativo" className="space-y-4">
        <TabsList>
          <TabsTrigger value="comparativo">Comparativo anual</TabsTrigger>
          <TabsTrigger value="categoria">Análisis por categoría</TabsTrigger>
        </TabsList>

        <TabsContent value="comparativo" className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
          <Select value={String(anioBase)} onValueChange={(v) => setAnioBase(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Año base" />
            </SelectTrigger>
            <SelectContent>
              {ANIOS_DISPONIBLES.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a} (base)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-[var(--text-muted)]">vs</span>
          <Select value={String(anioComp)} onValueChange={(v) => setAnioComp(Number(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Año comparación" />
            </SelectTrigger>
            <SelectContent>
              {ANIOS_DISPONIBLES.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a} (comparar)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {categoriasOpciones.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span className="ml-2">Actualizar</span>
          </Button>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      {categoria !== 'todas' && data?.resumen.categoria_filtro && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--navy)]/20 bg-[var(--blue-lt)] px-4 py-3 text-sm">
          <span>
            Mostrando solo gastos de <strong>{data.resumen.categoria_filtro}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={() => setCategoria('todas')}>
            Ver todas las categorías
          </Button>
        </div>
      )}

      {data?.aviso && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.aviso}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-6 animate-spin" />
          Consultando SAP HANA…
        </div>
      ) : data && comp ? (
        <>
          {/* KPIs comparativos */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Total {comp.anio_base}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatUsd(comp.total_base)}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {data.resumen.transacciones} transacciones
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Total {comp.anio_comp}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatUsd(comp.total_comp)}</p>
                <p className="text-xs text-[var(--text-muted)]">Año de comparación</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Variación anual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VariacionBadge pct={comp.variacion_pct} usd={comp.variacion_usd} />
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {comp.anio_base} vs {comp.anio_comp}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Promedio por línea ({comp.anio_base})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatUsd(data.resumen.promedio)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Tendencia mensual — {comp.anio_base} vs {comp.anio_comp}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.evolucion_mensual} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes_label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v, name) => [
                      formatUsd(Number(v)),
                      name === 'monto_base' ? String(comp.anio_base) : String(comp.anio_comp),
                    ]}
                    labelFormatter={(label) => `Mes: ${label}`}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'monto_base' ? String(comp.anio_base) : String(comp.anio_comp)
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="monto_base"
                    stroke="#002060"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#002060' }}
                    activeDot={{ r: 6 }}
                    name="monto_base"
                  />
                  <Line
                    type="monotone"
                    dataKey="monto_comp"
                    stroke="#70AD47"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#70AD47' }}
                    activeDot={{ r: 6 }}
                    name="monto_comp"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Gráficas comparativas */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Comparación por categoría — {comp.anio_base} vs {comp.anio_comp}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[360px]">
                {comparacionChart.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">Sin datos para comparar.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparacionChart} margin={{ left: 8, right: 8, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="categoria"
                        tick={{ fontSize: 10 }}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(v) => formatUsd(Number(v))}
                        labelFormatter={(_, payload) =>
                          payload?.[0]?.payload?.categoriaFull ?? ''
                        }
                      />
                      <Legend />
                      <Bar
                        dataKey={String(comp.anio_base)}
                        fill="#002060"
                        name={String(comp.anio_base)}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey={String(comp.anio_comp)}
                        fill="#70AD47"
                        name={String(comp.anio_comp)}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolución total por año</CardTitle>
              </CardHeader>
              <CardContent className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={anioChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="anio" />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v, name) =>
                        name === 'monto' ? formatUsd(Number(v)) : v
                      }
                    />
                    <Bar dataKey="monto" fill="#1F4E79" name="Total USD" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Distribución {comp.anio_base} por categoría
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {pieData.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        label={({ name, percent }) =>
                          `${String(name).slice(0, 16)} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatUsd(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolución mensual — {comp.anio_base}</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatUsd(Number(v))} />
                    <Bar dataKey="monto" fill="#002060" name="Monto USD" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabla comparativa por categoría */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Análisis por categoría — {comp.anio_base} vs {comp.anio_comp}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">{comp.anio_base}</TableHead>
                    <TableHead className="text-right">{comp.anio_comp}</TableHead>
                    <TableHead className="text-right">Variación USD</TableHead>
                    <TableHead className="text-right">Variación %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comp.por_categoria.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-[var(--text-muted)]">
                        Sin datos.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comp.por_categoria.map((c) => (
                      <TableRow key={c.categoria}>
                        <TableCell className="font-medium">{c.categoria}</TableCell>
                        <TableCell className="text-right">{formatUsd(c.monto_base)}</TableCell>
                        <TableCell className="text-right">{formatUsd(c.monto_comp)}</TableCell>
                        <TableCell className="text-right">
                          <VariacionBadge pct={c.variacion_pct} usd={c.variacion_usd} />
                        </TableCell>
                        <TableCell className="text-right text-sm text-[var(--text-muted)]">
                          {c.monto_comp > 0
                            ? `${((c.monto_base / c.monto_comp) * 100).toFixed(0)}% del año ant.`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top proveedores — {comp.anio_base}</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.top_proveedores}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="proveedor" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatUsd(Number(v))} />
                  <Bar dataKey="monto" fill="#70AD47" name="Monto USD" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detalle de transacciones */}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                Detalle de gastos — {comp.anio_base} y {comp.anio_comp}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {hayFiltrosColumna ? (
                  <Button variant="ghost" size="sm" onClick={limpiarFiltrosColumna}>
                    <X className="mr-1 size-3.5" />
                    Limpiar filtros
                  </Button>
                ) : null}
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-[var(--text-muted)]" />
                  <Input
                    placeholder="Buscar cuenta, descripción, proveedor…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <GastosDetalleTablaHeader
                  columnas={COLUMNAS_DETALLE_COSTOS}
                  filtros={filtrosColumnas}
                  opciones={opcionesColumna}
                  onFiltroChange={setFiltroColumna}
                />
                <TableBody>
                  {filasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[var(--text-muted)]">
                        {busqueda || hayFiltrosColumna
                          ? 'Sin resultados para la búsqueda.'
                          : 'Sin transacciones en los años seleccionados.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filasPagina.map((f) => (
                      <TableRow key={`${f.row_hash}-${f.anio}`}>
                        <TableCell className="font-medium">{f.anio ?? '—'}</TableCell>
                        <TableCell>{f.fecha ? formatDateDMY(f.fecha) : '—'}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {f.cuenta || '—'}
                        </TableCell>
                        <TableCell>
                          <span className="rounded bg-[var(--blue-lt)] px-1.5 py-0.5 text-xs font-medium">
                            {f.categoria}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-normal text-sm leading-snug">
                          {f.descripcion || '—'}
                        </TableCell>
                        <TableCell className="text-sm">{f.proveedor || '—'}</TableCell>
                        <TableCell className="text-xs text-[var(--text-muted)]">
                          {f.documento || '—'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatUsd(f.monto)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationBar
                page={detallePagination.page}
                totalPages={detallePagination.totalPages}
                pageSize={detallePagination.pageSize}
                totalItems={detallePagination.totalItems}
                fromItem={detallePagination.fromItem}
                toItem={detallePagination.toItem}
                onPageChange={detallePagination.setPage}
                onPageSizeChange={detallePagination.setPageSize}
                className="-mx-6 rounded-b-lg"
              />
              {filasFiltradas.length > 0 && data && (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  {data.aviso ? `${data.aviso} · ` : ''}
                  Clasificación: {data.categorizacion.reglas + data.categorizacion.vista} reglas/SAP,{' '}
                  {data.categorizacion.manual} manual
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
        </TabsContent>

        <TabsContent value="categoria">
          <GastosAnalisisCategoriaTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

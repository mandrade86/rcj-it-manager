import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Building2, Loader2, RefreshCw, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { fetchCostosItAnalisisCategoria } from '@/lib/api/costosIt'
import { formatDateDMY, formatUsd } from '@/lib/format'
import { PaginationBar } from '@/components/ui/PaginationBar'
import {
  GastosDetalleTablaHeader,
  type GastosDetalleColumnaDef,
} from '@/pages/gastos-it/GastosDetalleTablaHeader'
import { useGastosDetalleTabla } from '@/pages/gastos-it/useGastosDetalleTabla'
import type { CostosItAnalisisCategoria, CostosItFila } from '@/types/costosIt'

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

const MESES = [
  { value: 'todos', label: 'Todos los meses' },
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]

const COLUMNAS_DETALLE_ANALISIS: GastosDetalleColumnaDef[] = [
  { id: 'anio', label: 'Año', filter: 'select' },
  { id: 'fecha', label: 'Fecha', filter: 'text' },
  { id: 'empresa', label: 'Empresa', filter: 'select' },
  { id: 'cuenta', label: 'Nº Cuenta', filter: 'select', className: 'min-w-[110px]' },
  { id: 'categoria', label: 'Categoría', filter: 'select' },
  { id: 'descripcion', label: 'Descripción', filter: 'text', className: 'min-w-[200px]' },
  { id: 'proveedor', label: 'Proveedor', filter: 'select' },
  { id: 'monto', label: 'Monto USD', align: 'right' },
]

export function GastosAnalisisCategoriaTab() {
  const nowYear = new Date().getFullYear()
  const [anio, setAnio] = useState(nowYear)
  const [mes, setMes] = useState('todos')
  const [empresa, setEmpresa] = useState('todas')
  const [categoria, setCategoria] = useState('todas')
  const [categoriasOpciones, setCategoriasOpciones] = useState<string[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [filtrosColumnas, setFiltrosColumnas] = useState<Record<string, string>>({})
  const [data, setData] = useState<CostosItAnalisisCategoria | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    setData(null)
    try {
      const payload = await fetchCostosItAnalisisCategoria({
        anio,
        mes: mes === 'todos' ? undefined : Number(mes),
        empresa: empresa === 'todas' ? undefined : empresa,
        categoria: categoria === 'todas' ? undefined : categoria,
      })
      setData(payload)
      if (payload.categorias?.length) setCategoriasOpciones(payload.categorias)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error cargando análisis')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [anio, mes, empresa, categoria])

  useEffect(() => {
    void load()
  }, [load])

  const pieData = useMemo(
    () =>
      (data?.por_categoria ?? []).map((c) => ({
        name: c.categoria,
        value: c.monto,
        pct: c.pct,
      })),
    [data],
  )

  const empresaChart = useMemo(
    () =>
      (data?.por_empresa ?? []).slice(0, 12).map((e) => ({
        empresa: e.empresa.length > 24 ? `${e.empresa.slice(0, 22)}…` : e.empresa,
        empresaFull: e.empresa,
        monto: e.monto,
      })),
    [data],
  )

  const mesChart = useMemo(
    () =>
      (data?.por_mes ?? []).map((m) => ({
        mes: m.mes_label,
        monto: m.monto,
      })),
    [data],
  )

  const matchBusquedaDetalle = useCallback(
    (f: CostosItFila, q: string) =>
      f.descripcion.toLowerCase().includes(q) ||
      f.proveedor.toLowerCase().includes(q) ||
      f.categoria.toLowerCase().includes(q) ||
      f.empresa.toLowerCase().includes(q) ||
      f.cuenta.toLowerCase().includes(q) ||
      String(f.anio ?? '').includes(q),
    [],
  )

  const getValorColumnaDetalle = useCallback((f: CostosItFila, col: string) => {
    switch (col) {
      case 'anio':
        return String(f.anio ?? '')
      case 'fecha':
        return f.fecha ? formatDateDMY(f.fecha) : ''
      case 'empresa':
        return f.empresa
      case 'cuenta':
        return f.cuenta
      case 'categoria':
        return f.categoria
      case 'descripcion':
        return f.descripcion
      case 'proveedor':
        return f.proveedor
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

  const aniosOpciones = data?.anios_disponibles.length
    ? data.anios_disponibles
    : Array.from({ length: 6 }, (_, i) => nowYear - i)

  const periodoLabel = useMemo(() => {
    if (!data) return ''
    const mesLabel = data.filtros.mes
      ? MESES.find((m) => m.value === String(data.filtros.mes))?.label
      : null
    const parts = [String(data.filtros.anio)]
    if (mesLabel) parts.unshift(mesLabel)
    if (data.filtros.empresa) parts.push(data.filtros.empresa)
    if (data.filtros.categoria) parts.push(data.filtros.categoria)
    return parts.join(' · ')
  }, [data])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {aniosOpciones.map((a) => (
              <SelectItem key={a} value={String(a)}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {MESES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las empresas</SelectItem>
            {(data?.empresas ?? []).map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las categorías</SelectItem>
            {(categoriasOpciones.length ? categoriasOpciones : data?.categorias ?? []).map((c) => (
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

      {data?.aviso && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.aviso}
        </div>
      )}

      {data?.filtros.categoria && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--navy)]/20 bg-[var(--blue-lt)] px-4 py-3 text-sm">
          <span>
            Mostrando solo gastos de <strong>{data.filtros.categoria}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={() => setCategoria('todas')}>
            Ver todas las categorías
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-6 animate-spin" />
          Consultando SAP HANA…
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Total período
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatUsd(data.resumen.total)}</p>
                <p className="text-xs text-[var(--text-muted)]">{periodoLabel}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Transacciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data.resumen.transacciones}</p>
                <p className="text-xs text-[var(--text-muted)]">Líneas de gasto</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Promedio por línea
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatUsd(data.resumen.promedio)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                  Categorías activas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{data.por_categoria.length}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {data.filtros.categoria ?? 'Todas'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribución por categoría</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {pieData.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">Sin datos para el período.</p>
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
                          `${String(name).slice(0, 14)} ${((percent ?? 0) * 100).toFixed(0)}%`
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
                <CardTitle className="text-base">
                  {data.filtros.mes ? 'Detalle del mes' : 'Evolución mensual'}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                {mesChart.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">Sin datos mensuales.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mesChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v) => formatUsd(Number(v))} />
                      <Bar dataKey="monto" fill="#002060" name="Monto USD" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {empresa === 'todas' && empresaChart.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4" />
                  Gasto por empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={empresaChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="empresa" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => formatUsd(Number(v))}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.empresaFull ?? ''
                      }
                    />
                    <Bar dataKey="monto" fill="#70AD47" name="Monto USD" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen por categoría</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto USD</TableHead>
                    <TableHead className="text-right">% del total</TableHead>
                    <TableHead className="text-right">Transacciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.por_categoria.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-[var(--text-muted)]">
                        Sin datos para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.por_categoria.map((c) => (
                      <TableRow key={c.categoria}>
                        <TableCell className="font-medium">{c.categoria}</TableCell>
                        <TableCell className="text-right">{formatUsd(c.monto)}</TableCell>
                        <TableCell className="text-right">{c.pct.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{c.transacciones}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {empresa === 'todas' && data.por_categoria_empresa.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Categoría × empresa</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Monto USD</TableHead>
                      <TableHead className="text-right">Líneas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.por_categoria_empresa.slice(0, 40).map((r) => (
                      <TableRow key={`${r.empresa}-${r.categoria}`}>
                        <TableCell className="text-sm">{r.empresa}</TableCell>
                        <TableCell>
                          <span className="rounded bg-[var(--blue-lt)] px-1.5 py-0.5 text-xs font-medium">
                            {r.categoria}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{formatUsd(r.monto)}</TableCell>
                        <TableCell className="text-right">{r.transacciones}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Detalle de transacciones</CardTitle>
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
                  columnas={COLUMNAS_DETALLE_ANALISIS}
                  filtros={filtrosColumnas}
                  opciones={opcionesColumna}
                  onFiltroChange={setFiltroColumna}
                />
                <TableBody>
                  {filasFiltradas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[var(--text-muted)]">
                        Sin transacciones para los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filasPagina.map((f) => (
                      <TableRow key={`${f.row_hash}-${f.fecha}`}>
                        <TableCell className="font-medium">{f.anio ?? '—'}</TableCell>
                        <TableCell>{f.fecha ? formatDateDMY(f.fecha) : '—'}</TableCell>
                        <TableCell className="text-sm">{f.empresa || '—'}</TableCell>
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
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

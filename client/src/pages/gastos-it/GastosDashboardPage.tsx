import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { exportGastosCsv, fetchGastosDashboard, putGastosClasificacion } from '@/lib/api/gastosDashboard'
import { formatDateDMY, formatUsd } from '@/lib/format'
import { PaginationBar } from '@/components/ui/PaginationBar'
import {
  GastosDetalleTablaHeader,
  type GastosDetalleColumnaDef,
} from '@/pages/gastos-it/GastosDetalleTablaHeader'
import { useGastosDetalleTabla } from '@/pages/gastos-it/useGastosDetalleTabla'
import type { GastosDashboard, GastoItFila, GastosItCategoria, SemafaroEstado } from '@/types/gastosDashboard'

const CHART_COLORS = ['#002060', '#70AD47', '#1F4E79', '#C00000', '#7F6000', '#4527A0', '#0F6E56', '#375623', '#6B7280']
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const COLUMNAS_DETALLE_DASHBOARD: GastosDetalleColumnaDef[] = [
  { id: 'anio', label: 'Año', filter: 'select' },
  { id: 'fecha', label: 'Fecha', filter: 'text' },
  { id: 'proveedor', label: 'Proveedor', filter: 'select' },
  { id: 'descripcion', label: 'Descripción', filter: 'text', className: 'min-w-[180px]' },
  { id: 'categoria', label: 'Categoría', filter: 'select' },
  { id: 'subcategoria', label: 'Subcategoría', filter: 'select' },
  { id: 'tipo', label: 'Tipo', filter: 'select' },
  { id: 'monto', label: 'Monto', align: 'right' },
  { id: 'acciones', label: '' },
]

const COLUMNAS_PRESUPUESTO_VS_REAL: GastosDetalleColumnaDef[] = [
  { id: 'cuenta', label: 'Cuenta', filter: 'select' },
  { id: 'cuenta_nombre', label: 'Nombre cuenta', filter: 'text', className: 'min-w-[200px]' },
  { id: 'presupuesto', label: 'Presupuesto', align: 'right' },
  { id: 'real', label: 'Real', align: 'right' },
  { id: 'variacion', label: 'Variación', align: 'right' },
  { id: 'variacion_pct', label: '%', align: 'right' },
]

function SemaforoDot({ estado }: { estado: SemafaroEstado }) {
  const color =
    estado === 'critico' ? 'bg-red-500' : estado === 'atencion' ? 'bg-amber-400' : 'bg-green-500'
  const label = estado === 'critico' ? 'Crítico' : estado === 'atencion' ? 'Atención' : 'Controlado'
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={`size-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function KpiCard({
  title,
  value,
  sub,
  trend,
}: {
  title: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | null
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--text-muted)]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-semibold">{value}</p>
          {trend === 'up' && <TrendingUp className="size-4 text-red-500" />}
          {trend === 'down' && <TrendingDown className="size-4 text-green-600" />}
        </div>
        {sub && <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export function GastosDashboardPage() {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [modoRango, setModoRango] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [compararMesAnt, setCompararMesAnt] = useState(true)
  const [compararPresupuesto, setCompararPresupuesto] = useState(true)
  const [data, setData] = useState<GastosDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtrosColumnas, setFiltrosColumnas] = useState<Record<string, string>>({})
  const [filtrosPresupuesto, setFiltrosPresupuesto] = useState<Record<string, string>>({})
  const [categoriaFiltroId, setCategoriaFiltroId] = useState('todas')
  const [categoriasOpciones, setCategoriasOpciones] = useState<GastosItCategoria[]>([])
  const [editFila, setEditFila] = useState<GastoItFila | null>(null)
  const [editCatId, setEditCatId] = useState('')
  const [editSubId, setEditSubId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    setData(null)
    try {
      const payload = await fetchGastosDashboard({
        anio: modoRango ? undefined : anio,
        mes: modoRango ? undefined : mes,
        desde: modoRango && desde ? desde : undefined,
        hasta: modoRango && hasta ? hasta : undefined,
        comparar_mes_anterior: compararMesAnt,
        comparar_presupuesto: compararPresupuesto,
        categoria_id: categoriaFiltroId === 'todas' ? undefined : categoriaFiltroId,
      })
      setData(payload)
      if (payload.categorias?.length) setCategoriasOpciones(payload.categorias)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error cargando dashboard')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [anio, mes, modoRango, desde, hasta, compararMesAnt, compararPresupuesto, categoriaFiltroId])

  useEffect(() => {
    void load()
  }, [load])

  const matchBusquedaDetalle = useCallback(
    (f: GastoItFila, q: string) =>
      f.descripcion.toLowerCase().includes(q) ||
      f.proveedor.toLowerCase().includes(q) ||
      f.categoria.toLowerCase().includes(q) ||
      f.subcategoria.toLowerCase().includes(q) ||
      String(f.anio ?? '').includes(q),
    [],
  )

  const getValorColumnaDetalle = useCallback((f: GastoItFila, col: string) => {
    switch (col) {
      case 'anio':
        return String(f.anio ?? '')
      case 'fecha':
        return f.fecha ? formatDateDMY(f.fecha) : ''
      case 'proveedor':
        return f.proveedor
      case 'descripcion':
        return f.descripcion
      case 'categoria':
        return f.categoria
      case 'subcategoria':
        return f.subcategoria
      case 'tipo':
        return f.tipo_gasto.replace('_', ' ')
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

  const filtrarPorCategoria = useCallback(
    (categoriaId: string) => {
      setCategoriaFiltroId((prev) => (prev === categoriaId ? 'todas' : categoriaId))
    },
    [],
  )

  const pieData = useMemo(
    () => (data?.por_categoria ?? []).map((c) => ({ name: c.categoria, value: c.monto, pct: c.pct })),
    [data],
  )

  const presupuestoFilas = data?.presupuesto_vs_real.filas ?? []

  const opcionesPresupuesto = useMemo(() => {
    const cuentas = [...new Set(presupuestoFilas.map((r) => r.cuenta).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
    const nombres = [...new Set(presupuestoFilas.map((r) => r.cuenta_nombre).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
    return { cuenta: cuentas, cuenta_nombre: nombres }
  }, [presupuestoFilas])

  const presupuestoFilasFiltradas = useMemo(() => {
    return presupuestoFilas.filter((r) => {
      const cuentaF = filtrosPresupuesto.cuenta
      const nombreF = filtrosPresupuesto.cuenta_nombre?.trim().toLowerCase()
      if (cuentaF && cuentaF !== 'todos' && r.cuenta !== cuentaF) return false
      if (nombreF && !r.cuenta_nombre.toLowerCase().includes(nombreF)) return false
      return true
    })
  }, [presupuestoFilas, filtrosPresupuesto])

  const hayFiltrosPresupuesto = Object.values(filtrosPresupuesto).some((v) => v && v !== 'todos')

  const setFiltroPresupuesto = useCallback((columna: string, valor: string) => {
    setFiltrosPresupuesto((prev) => ({ ...prev, [columna]: valor }))
  }, [])

  const limpiarFiltrosPresupuesto = useCallback(() => {
    setFiltrosPresupuesto({})
  }, [])

  async function guardarClasificacion() {
    if (!editFila || !editCatId || !editSubId) return
    await putGastosClasificacion(editFila.row_hash, {
      categoria_id: editCatId,
      subcategoria_id: editSubId,
    })
    setEditFila(null)
    void load()
  }

  const kpis = data?.kpis

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Dashboard de Gastos</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Análisis mensual IT · {data?.vista ?? 'SAP HANA'} · USD
            {data?.filtros.mes_label ? ` · ${data.filtros.mes_label}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={modoRango ? 'rango' : 'mes'} onValueChange={(v) => setModoRango(v === 'rango')}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Por mes</SelectItem>
              <SelectItem value="rango">Rango fechas</SelectItem>
            </SelectContent>
          </Select>
          {!modoRango ? (
            <>
              <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-[150px]" />
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-[150px]" />
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setCompararMesAnt(!compararMesAnt)}>
            {compararMesAnt ? '✓' : '○'} vs mes ant.
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCompararPresupuesto(!compararPresupuesto)}>
            {compararPresupuesto ? '✓' : '○'} vs presupuesto
          </Button>
          <Select value={categoriaFiltroId} onValueChange={setCategoriaFiltroId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {(categoriasOpciones.length ? categoriasOpciones : data?.categorias ?? [])
                .filter((c) => c.activo)
                .flatMap((c) =>
                  (c.subcategorias ?? [])
                    .filter((s) => s.activo)
                    .map((s) => (
                      <SelectItem key={`${c.id}|${s.id}`} value={`${c.id}|${s.id}`}>
                        {c.nombre} → {s.nombre}
                      </SelectItem>
                    )),
                )}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/it/gastos-presupuesto">
              <Settings2 className="mr-1 size-4" />
              Presupuesto
            </Link>
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      )}
      {data?.aviso && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{data.aviso}</div>
      )}

      {data?.filtros.categoria && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--navy)]/20 bg-[var(--blue-lt)] px-4 py-3 text-sm">
          <span>
            Mostrando solo gastos de <strong>{data.filtros.categoria}</strong>
          </span>
          <Button variant="outline" size="sm" onClick={() => setCategoriaFiltroId('todas')}>
            Ver todas las categorías
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-6 animate-spin" /> Cargando análisis…
        </div>
      ) : data && kpis ? (
        <>
          <Card className="border-[var(--border)] bg-[var(--blue-lt)]/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Resumen del mes</CardTitle>
                <SemaforoDot estado={kpis.semaforo} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-[var(--text)]">{data.resumen_mes}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Gasto total del mes" value={formatUsd(kpis.total_mes)} sub={`${kpis.transacciones} transacciones`} />
            <KpiCard
              title="Presupuesto del mes"
              value={kpis.presupuesto_mes != null ? formatUsd(kpis.presupuesto_mes) : '—'}
              sub={kpis.presupuesto_mes == null ? 'Sin presupuesto configurado' : undefined}
            />
            <KpiCard
              title="Variación vs presupuesto"
              value={
                kpis.variacion_presupuesto_pct != null
                  ? `${kpis.variacion_presupuesto_pct > 0 ? '+' : ''}${kpis.variacion_presupuesto_pct.toFixed(1)}%`
                  : 'N/D'
              }
              sub={
                kpis.variacion_presupuesto_usd != null
                  ? formatUsd(kpis.variacion_presupuesto_usd)
                  : 'Información insuficiente'
              }
              trend={kpis.variacion_presupuesto_pct != null && kpis.variacion_presupuesto_pct > 0 ? 'up' : kpis.variacion_presupuesto_pct != null && kpis.variacion_presupuesto_pct < 0 ? 'down' : null}
            />
            <KpiCard
              title="Variación vs mes anterior"
              value={
                kpis.variacion_mes_anterior_pct != null
                  ? `${kpis.variacion_mes_anterior_pct > 0 ? '+' : ''}${kpis.variacion_mes_anterior_pct.toFixed(1)}%`
                  : 'N/D'
              }
              sub={kpis.total_mes_anterior != null ? `Mes ant.: ${formatUsd(kpis.total_mes_anterior)}` : 'Sin datos mes anterior'}
              trend={kpis.variacion_mes_anterior_pct != null && kpis.variacion_mes_anterior_pct > 20 ? 'up' : null}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Promedio mensual" value={kpis.promedio_mensual != null ? formatUsd(kpis.promedio_mensual) : 'N/D'} />
            <KpiCard title="Gasto mes anterior" value={kpis.total_mes_anterior != null ? formatUsd(kpis.total_mes_anterior) : 'N/D'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Gastos por categoría</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95}
                      label={({ name, percent }) => `${String(name).slice(0, 14)} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      onClick={(_, i) => {
                        const cat = data.por_categoria[i]
                        if (cat) filtrarPorCategoria(cat.categoria_id)
                      }}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer" />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatUsd(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Evolución últimos 12 meses</CardTitle></CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.evolucion_12_meses}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes_label" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatUsd(Number(v))} />
                    <Line type="monotone" dataKey="monto" stroke="#002060" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Top proveedores</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.top_proveedores} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="proveedor" width={140} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => formatUsd(Number(v))} />
                    <Bar dataKey="monto" fill="#70AD47" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Gastos por tipo</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.por_tipo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatUsd(Number(v))} />
                    <Bar dataKey="monto" fill="#1F4E79" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">¿Dónde se está yendo el dinero?</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-[var(--text-muted)]">{data.concentracion.explicacion}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {data.concentracion.top.map((c) => {
                  const catId = data.por_categoria.find((x) => x.categoria === c.categoria)?.categoria_id
                  return (
                  <button
                    key={c.categoria}
                    type="button"
                    onClick={() => catId && filtrarPorCategoria(catId)}
                    className="rounded-lg border border-[var(--border)] bg-white p-3 text-left transition hover:border-[var(--navy)]"
                  >
                    <p className="text-lg font-semibold text-[var(--navy)]">{c.pct.toFixed(0)}%</p>
                    <p className="text-sm font-medium">{c.categoria}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatUsd(c.monto)}</p>
                  </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {data.anomalias.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> Alertas y anomalías</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {data.anomalias.map((a, i) => (
                  <div key={i} className={`rounded-md border px-3 py-2 text-sm ${a.severidad === 'critico' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                    <strong>{a.titulo}:</strong> {a.detalle}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {data.oportunidades.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Oportunidades de ahorro</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Problema</TableHead>
                      <TableHead>Impacto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Recomendación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.oportunidades.map((o, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{o.problema}</TableCell>
                        <TableCell>{o.impacto}</TableCell>
                        <TableCell className="text-right">{o.monto > 0 ? formatUsd(o.monto) : '—'}</TableCell>
                        <TableCell className="text-sm">{o.recomendacion}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Presupuesto vs Real</CardTitle>
              {hayFiltrosPresupuesto ? (
                <Button variant="ghost" size="sm" onClick={limpiarFiltrosPresupuesto}>
                  <X className="mr-1 size-3.5" />
                  Limpiar filtros
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {!data.presupuesto_vs_real.disponible ? (
                <p className="text-sm text-[var(--text-muted)]">
                  Información insuficiente para calcular este indicador.{' '}
                  <Link to="/it/gastos-presupuesto" className="font-medium text-[var(--navy)] underline">
                    Configure presupuestos mensuales
                  </Link>{' '}
                  por cuenta contable (misma estructura que Presupuesto IT).
                </p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-6 text-sm">
                    <span>Total presupuesto: <strong>{formatUsd(data.presupuesto_vs_real.total_presupuesto)}</strong></span>
                    <span>Total real: <strong>{formatUsd(data.presupuesto_vs_real.total_real)}</strong></span>
                    <span>Diferencia: <strong>{formatUsd(data.presupuesto_vs_real.diferencia)}</strong></span>
                    <span>Ejecución: <strong>{data.presupuesto_vs_real.ejecucion_pct.toFixed(1)}%</strong></span>
                  </div>
                  <Table>
                    <GastosDetalleTablaHeader
                      columnas={COLUMNAS_PRESUPUESTO_VS_REAL}
                      filtros={filtrosPresupuesto}
                      opciones={opcionesPresupuesto}
                      onFiltroChange={setFiltroPresupuesto}
                    />
                    <TableBody>
                      {presupuestoFilasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-[var(--text-muted)]">
                            Sin filas para los filtros seleccionados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        presupuestoFilasFiltradas.map((r) => (
                          <TableRow key={r.cuenta}>
                            <TableCell className="font-mono text-sm font-medium">{r.cuenta}</TableCell>
                            <TableCell>{r.cuenta_nombre || '—'}</TableCell>
                            <TableCell className="text-right">{formatUsd(r.presupuesto)}</TableCell>
                            <TableCell className="text-right">{formatUsd(r.real)}</TableCell>
                            <TableCell className={`text-right ${r.variacion > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatUsd(r.variacion)}</TableCell>
                            <TableCell className="text-right">{r.variacion_pct.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>

          {data.recurrentes.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Gastos recurrentes</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Promedio mensual</TableHead>
                      <TableHead className="text-right">Último gasto</TableHead>
                      <TableHead className="text-right">Frecuencia (meses)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recurrentes.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.proveedor}</TableCell>
                        <TableCell className="max-w-[240px] truncate">{r.concepto}</TableCell>
                        <TableCell className="text-right">{formatUsd(r.promedio_mensual)}</TableCell>
                        <TableCell className="text-right">{formatUsd(r.ultimo_gasto)}</TableCell>
                        <TableCell className="text-right">{r.frecuencia_meses}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Detalle de gastos</CardTitle>
              <div className="flex flex-wrap gap-2">
                {hayFiltrosColumna ? (
                  <Button variant="ghost" size="sm" onClick={limpiarFiltrosColumna}>
                    <X className="mr-1 size-3.5" />
                    Limpiar filtros
                  </Button>
                ) : null}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-[var(--text-muted)]" />
                  <Input placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-48 pl-9" />
                </div>
                <Button variant="outline" size="sm" onClick={() => data && exportGastosCsv(filasFiltradas)}>
                  <Download className="mr-1 size-4" /> Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <GastosDetalleTablaHeader
                  columnas={COLUMNAS_DETALLE_DASHBOARD}
                  filtros={filtrosColumnas}
                  opciones={opcionesColumna}
                  onFiltroChange={setFiltroColumna}
                />
                <TableBody>
                  {filasFiltradas.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-[var(--text-muted)]">Sin transacciones.</TableCell></TableRow>
                  ) : (
                    filasPagina.map((f) => (
                      <TableRow key={f.row_hash}>
                        <TableCell className="font-medium">{f.anio ?? '—'}</TableCell>
                        <TableCell>{f.fecha ? formatDateDMY(f.fecha) : '—'}</TableCell>
                        <TableCell>{f.proveedor || '—'}</TableCell>
                        <TableCell className="max-w-[220px] whitespace-normal text-sm">{f.descripcion}</TableCell>
                        <TableCell>{f.categoria}</TableCell>
                        <TableCell>{f.subcategoria}</TableCell>
                        <TableCell className="text-xs capitalize">{f.tipo_gasto.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right font-medium">{formatUsd(f.monto)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => { setEditFila(f); setEditCatId(f.categoria_id); setEditSubId(f.subcategoria_id) }}>
                            Editar
                          </Button>
                        </TableCell>
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

      <Dialog open={!!editFila} onOpenChange={(o) => !o && setEditFila(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar clasificación</DialogTitle></DialogHeader>
          {editFila && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">{editFila.descripcion}</p>
              <div>
                <Label>Categoría</Label>
                <Select value={editCatId} onValueChange={(v) => { setEditCatId(v); setEditSubId('') }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(data?.categorias ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subcategoría</Label>
                <Select value={editSubId} onValueChange={setEditSubId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(data?.categorias.find((c) => c.id === editCatId)?.subcategorias ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void guardarClasificacion()}>Guardar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

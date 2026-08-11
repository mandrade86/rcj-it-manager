import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Layers, Loader2, Search } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
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
import { fetchRecetaDetalle, fetchRecetasCatalogo } from '@/lib/api/costeoMuestras'
import { formatLps } from '@/lib/format'
import type { RecetaCatalogoItem, RecetaDetallePayload } from '@/types/costeoMuestras'

import { BiChartTooltip } from './BiChartTooltip'
import { BI_CHART, ingredientColor } from './chartTheme'

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`
}

type Props = {
  onError: (msg: string | null) => void
}

export function RecetasAnalisisTab({ onError }: Props) {
  const [loading, setLoading] = useState(true)
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [catalogo, setCatalogo] = useState<RecetaCatalogoItem[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState('')
  const [detalle, setDetalle] = useState<RecetaDetallePayload | null>(null)

  const loadCatalogo = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const { catalogo: items } = await fetchRecetasCatalogo()
      setCatalogo(items)
      if (items.length > 0) {
        setSeleccion((prev) => prev || items[0]!.receta_code)
      }
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  const loadDetalle = useCallback(async (code: string) => {
    if (!code) return
    setDetalleLoading(true)
    onError(null)
    try {
      const payload = await fetchRecetaDetalle(code)
      setDetalle(payload)
    } catch (e) {
      onError((e as Error).message)
      setDetalle(null)
    } finally {
      setDetalleLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void loadCatalogo()
  }, [loadCatalogo])

  useEffect(() => {
    if (seleccion) void loadDetalle(seleccion)
  }, [seleccion, loadDetalle])

  const catalogoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return catalogo
    return catalogo.filter(
      (r) =>
        r.receta_code.toLowerCase().includes(q) ||
        r.receta_nombre.toLowerCase().includes(q),
    )
  }, [catalogo, busqueda])

  const pieData = useMemo(() => {
    if (!detalle) return []
    return detalle.ingredientes.slice(0, 8).map((i, idx) => ({
      name: i.componente_nombre.length > 22 ? `${i.componente_nombre.slice(0, 20)}…` : i.componente_nombre,
      value: i.costo_linea,
      fullName: i.componente_nombre,
      fill: ingredientColor(idx),
    }))
  }, [detalle])

  const barData = useMemo(() => {
    if (!detalle) return []
    return detalle.ingredientes.slice(0, 12).map((i) => ({
      name: i.componente_nombre.length > 18 ? `${i.componente_nombre.slice(0, 16)}…` : i.componente_nombre,
      costo: i.costo_linea,
      fullName: i.componente_nombre,
    }))
  }, [detalle])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando catálogo de recetas…
      </div>
    )
  }

  const recetaSel = catalogo.find((r) => r.receta_code === seleccion)

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-[var(--lime)] bg-gradient-to-r from-[#EAF5D9]/80 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-5 text-[var(--lime)]" />
            Análisis de costo por receta — vista analista
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)]">
            Seleccione una receta para ver explosión BOM: ingredientes, cantidades y costo por línea.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="buscar-receta">Buscar receta</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                id="buscar-receta"
                className="pl-9"
                placeholder="Código o nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Receta</Label>
            <Select value={seleccion} onValueChange={setSeleccion}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccione receta" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {catalogoFiltrado.map((r) => (
                  <SelectItem key={r.receta_code} value={r.receta_code}>
                    <span className="font-mono text-xs text-[var(--text-muted)]">{r.receta_code}</span>
                    {' — '}
                    {r.receta_nombre || r.receta_code}
                    {' '}
                    <span className="text-[var(--lime)]">({formatLps(r.costo)})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {detalleLoading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Cargando ingredientes…
        </div>
      ) : detalle ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-t-4 border-t-[var(--navy)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--text-muted)]">Receta seleccionada</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">{detalle.receta.receta_nombre || detalle.receta.receta_code}</p>
                <p className="font-mono text-xs text-[var(--text-muted)]">{detalle.receta.receta_code}</p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.coral }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--text-muted)]">Costo teórico total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: BI_CHART.coral }}>
                  {formatLps(detalle.resumen.costo_total)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.purple }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--text-muted)]">Ingredientes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: BI_CHART.purple }}>
                  {detalle.resumen.total_ingredientes}
                </p>
              </CardContent>
            </Card>
            <Card className="border-t-4" style={{ borderTopColor: BI_CHART.teal }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-[var(--text-muted)]">Flag costo</CardTitle>
              </CardHeader>
              <CardContent>
                {detalle.receta.flag_costo ? (
                  <Badge className="bg-[var(--lime)] text-[var(--navy)]">{detalle.receta.flag_costo}</Badge>
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">—</span>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Composición del costo (top 8)</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {pieData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin ingredientes.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={entry.name} fill={entry.fill ?? ingredientColor(i)} />
                        ))}
                      </Pie>
                      <Tooltip content={<BiChartTooltip formatter={(v) => formatLps(v)} />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Costo por ingrediente</CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                {barData.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E0E4E8" />
                      <XAxis type="number" tickFormatter={(v) => formatLps(Number(v))} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                      <Tooltip
                        content={<BiChartTooltip />}
                        labelFormatter={(_, payload) => {
                          const p = payload?.[0]?.payload as { fullName?: string } | undefined
                          return p?.fullName ?? ''
                        }}
                      />
                      <Bar dataKey="costo" radius={[0, 6, 6, 0]}>
                        {barData.map((_, i) => (
                          <Cell key={i} fill={ingredientColor(i)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-4" />
                Detalle de ingredientes — {recetaSel?.receta_nombre ?? seleccion}
              </CardTitle>
              <p className="text-xs text-[var(--text-muted)]">Vista: {detalle.vista}</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead className="text-right">Nivel</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo unit.</TableHead>
                    <TableHead className="text-right">Costo línea</TableHead>
                    <TableHead className="text-right">% del total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.ingredientes.map((ing, i) => (
                    <TableRow key={`${ing.componente_code}-${i}`}>
                      <TableCell className="font-mono text-xs">{ing.componente_code || '—'}</TableCell>
                      <TableCell>{ing.componente_nombre}</TableCell>
                      <TableCell className="text-right">{ing.nivel || '—'}</TableCell>
                      <TableCell className="text-right">{ing.cantidad.toLocaleString('es-HN')}</TableCell>
                      <TableCell className="text-right">{formatLps(ing.costo_unitario)}</TableCell>
                      <TableCell className="text-right font-medium">{formatLps(ing.costo_linea)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: ingredientColor(i) }}
                        >
                          {formatPct(ing.pct_costo)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-[var(--gray-lt)] font-semibold">
                    <TableCell colSpan={5}>Total receta</TableCell>
                    <TableCell className="text-right">{formatLps(detalle.resumen.costo_total)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--text-muted)]">
            Seleccione una receta del listado para ver el análisis de costos.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

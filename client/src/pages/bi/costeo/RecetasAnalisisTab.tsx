import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, FileSpreadsheet, Layers, Loader2, Search } from 'lucide-react'
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
import { formatLps } from '@/lib/format'
import { exportRecetaDetalleExcel } from '@/lib/exportCosteoExcel'
import { useCosteoMuestrasStore } from '@/store/costeoMuestrasStore'

import { BiChartTooltip } from './BiChartTooltip'
import { BI_CHART, ingredientColor } from './chartTheme'
import { hasSelectValue, sentenceCase } from './selectHelpers'

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`
}

type Props = {
  onError: (msg: string | null) => void
}

export function RecetasAnalisisTab({ onError }: Props) {
  const catalogo = useCosteoMuestrasStore((s) => s.catalogoRecetas)
  const catalogoLoading = useCosteoMuestrasStore((s) => s.catalogoLoading)
  const seleccion = useCosteoMuestrasStore((s) => s.recetaSeleccion)
  const setRecetaSeleccion = useCosteoMuestrasStore((s) => s.setRecetaSeleccion)
  const loadCatalogoRecetas = useCosteoMuestrasStore((s) => s.loadCatalogoRecetas)
  const loadDetalleStore = useCosteoMuestrasStore((s) => s.loadDetalle)
  const detalles = useCosteoMuestrasStore((s) => s.detalles)
  const detalleLoadingCode = useCosteoMuestrasStore((s) => s.detalleLoadingCode)
  const cacheEpoch = useCosteoMuestrasStore((s) => s.cacheEpoch)

  const [busqueda, setBusqueda] = useState('')
  const detalle = seleccion ? detalles[seleccion] ?? null : null

  useEffect(() => {
    onError(null)
    void loadCatalogoRecetas().catch((e) => onError((e as Error).message))
  }, [loadCatalogoRecetas, onError, cacheEpoch])

  useEffect(() => {
    if (!seleccion) return
    if (detalles[seleccion]) return
    onError(null)
    void loadDetalleStore(seleccion).catch((e) => {
      onError((e as Error).message)
    })
  }, [seleccion, detalles, loadDetalleStore, onError, cacheEpoch])

  const loading = catalogoLoading && !catalogo
  const detalleLoading = Boolean(seleccion) && detalleLoadingCode === seleccion && !detalles[seleccion]

  const catalogoValido = useMemo(
    () => (catalogo ?? []).filter((r) => hasSelectValue(r.receta_code)),
    [catalogo],
  )

  const catalogoFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return catalogoValido
    return catalogoValido.filter(
      (r) =>
        r.receta_code.toLowerCase().includes(q) ||
        r.receta_nombre.toLowerCase().includes(q),
    )
  }, [catalogoValido, busqueda])

  const pieData = useMemo(() => {
    if (!detalle) return []
    return detalle.ingredientes.slice(0, 8).map((i, idx) => {
      const fullName = sentenceCase(i.componente_nombre)
      return {
        name: fullName.length > 22 ? `${fullName.slice(0, 20)}…` : fullName,
        value: i.costo_teorico,
        fullName,
        fill: ingredientColor(idx),
      }
    })
  }, [detalle])

  const barData = useMemo(() => {
    if (!detalle) return []
    return detalle.ingredientes.slice(0, 12).map((i) => {
      const fullName = sentenceCase(i.componente_nombre)
      return {
        name: fullName.length > 18 ? `${fullName.slice(0, 16)}…` : fullName,
        costo: i.costo_teorico,
        fullName,
      }
    })
  }, [detalle])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando catálogo de recetas…
      </div>
    )
  }

  const recetaSel = catalogoValido.find((r) => r.receta_code === seleccion)

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-[var(--lime)] bg-gradient-to-r from-[#EAF5D9]/80 to-white">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="size-5 text-[var(--lime)]" />
                Análisis de costo por receta — vista analista
              </CardTitle>
              <p className="text-xs text-[var(--text-muted)]">
                Seleccione una receta para ver costo teórico desde VW_BI_RECETA_COSTO (cantidad × costo unitario).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!detalle}
              onClick={() => {
                if (detalle) exportRecetaDetalleExcel(detalle)
              }}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5" />
              Exportar Excel
            </Button>
          </div>
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
            <Select
              value={hasSelectValue(seleccion) ? seleccion : undefined}
              onValueChange={setRecetaSeleccion}
            >
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bi-composicion-costo">
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
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead className="text-right">Costo unit.</TableHead>
                    <TableHead className="text-right">% del total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.ingredientes.map((ing, i) => (
                    <TableRow key={`${ing.componente_code}-${i}`}>
                      <TableCell className="font-mono text-xs">{ing.componente_code || '—'}</TableCell>
                      <TableCell>
                        <span className="bi-sentence-case">{ing.componente_nombre}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ing.cantidad.toLocaleString('es-HN', { maximumFractionDigits: 6 })}
                      </TableCell>
                      <TableCell className="text-xs text-[var(--text-muted)]">
                        {ing.unidad || '—'}
                      </TableCell>
                      <TableCell className="text-right">{formatLps(ing.costo_unitario)}</TableCell>
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
                    <TableCell colSpan={4}>Total receta</TableCell>
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

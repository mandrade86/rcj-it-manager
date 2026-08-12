import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, Layers, Loader2, Search, X } from 'lucide-react'

import { MaestroSortableHead } from '@/components/maestros/MaestroSortableHead'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PaginationBar } from '@/components/ui/PaginationBar'
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
import { usePagination } from '@/hooks/usePagination'
import { exportGeneralRecetasExcel } from '@/lib/exportCosteoExcel'
import { formatDateDMY, formatLps } from '@/lib/format'
import type { MaestroSortDir } from '@/lib/maestroList'
import { cn } from '@/lib/utils'
import { useCosteoMuestrasStore } from '@/store/costeoMuestrasStore'
import type { RecetaMatrizItem } from '@/types/costeoMuestras'

import { BI_CHART } from './chartTheme'

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`
}

type SortKey = 'codigo' | 'nombre' | 'ingredientes' | 'costo' | 'produccion' | 'variacion'

type Props = {
  onError: (msg: string | null) => void
}

export function GeneralRecetasTab({ onError }: Props) {
  const data = useCosteoMuestrasStore((s) => s.general)
  const generalLoading = useCosteoMuestrasStore((s) => s.generalLoading)
  const loadGeneral = useCosteoMuestrasStore((s) => s.loadGeneral)
  const cacheEpoch = useCosteoMuestrasStore((s) => s.cacheEpoch)

  const [busqueda, setBusqueda] = useState('')
  const [minCosto, setMinCosto] = useState('')
  const [maxCosto, setMaxCosto] = useState('')
  const [minIngredientes, setMinIngredientes] = useState('')
  const [filtroIngredientes, setFiltroIngredientes] = useState<'todas' | 'con' | 'sin'>('todas')
  const [sortKey, setSortKey] = useState<SortKey>('nombre')
  const [sortDir, setSortDir] = useState<MaestroSortDir>('asc')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    onError(null)
    void loadGeneral().catch((e) => onError((e as Error).message))
  }, [loadGeneral, onError, cacheEpoch])

  const loading = generalLoading && !data

  const hayFiltrosActivos =
    Boolean(busqueda.trim()) ||
    Boolean(minCosto.trim()) ||
    Boolean(maxCosto.trim()) ||
    Boolean(minIngredientes.trim()) ||
    filtroIngredientes !== 'todas'

  const limpiarFiltros = () => {
    setBusqueda('')
    setMinCosto('')
    setMaxCosto('')
    setMinIngredientes('')
    setFiltroIngredientes('todas')
  }

  const onSort = (key: string, dir: MaestroSortDir) => {
    setSortKey(key as SortKey)
    setSortDir(dir)
  }

  const recetasFiltradas = useMemo(() => {
    if (!data) return []
    const q = busqueda.trim().toLowerCase()
    const minC = minCosto.trim() ? Number(minCosto) : null
    const maxC = maxCosto.trim() ? Number(maxCosto) : null
    const minI = minIngredientes.trim() ? Number(minIngredientes) : null

    let rows = data.recetas.filter((r) => {
      if (q) {
        const hit =
          r.receta_code.toLowerCase().includes(q) ||
          r.receta_nombre.toLowerCase().includes(q)
        if (!hit) return false
      }
      if (minC != null && Number.isFinite(minC) && r.costo_total < minC) return false
      if (maxC != null && Number.isFinite(maxC) && r.costo_total > maxC) return false
      if (minI != null && Number.isFinite(minI) && r.total_ingredientes < minI) return false
      if (filtroIngredientes === 'con' && r.total_ingredientes <= 0) return false
      if (filtroIngredientes === 'sin' && r.total_ingredientes > 0) return false
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'codigo':
          return a.receta_code.localeCompare(b.receta_code, 'es') * dir
        case 'ingredientes':
          return (a.total_ingredientes - b.total_ingredientes) * dir
        case 'costo':
          return (a.costo_total - b.costo_total) * dir
        case 'produccion':
          return ((a.costo_produccion ?? 0) - (b.costo_produccion ?? 0)) * dir
        case 'variacion':
          return ((a.variacion ?? 0) - (b.variacion ?? 0)) * dir
        case 'nombre':
        default:
          return (
            (a.receta_nombre || a.receta_code).localeCompare(b.receta_nombre || b.receta_code, 'es') *
            dir
          )
      }
    })

    return rows
  }, [
    data,
    busqueda,
    minCosto,
    maxCosto,
    minIngredientes,
    filtroIngredientes,
    sortKey,
    sortDir,
  ])

  const pagination = usePagination(recetasFiltradas.length, {
    initialPageSize: 25,
    resetKey: `${busqueda}|${minCosto}|${maxCosto}|${minIngredientes}|${filtroIngredientes}|${sortKey}|${sortDir}|${recetasFiltradas.length}`,
  })
  const pageRows = pagination.slice(recetasFiltradas)

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Cargando matriz de recetas…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-l-4 border-l-[var(--navy)] bg-gradient-to-r from-[#DCE6F1]/70 to-white">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="size-5 text-[var(--navy)]" />
                General recetas — matriz de costos
              </CardTitle>
              <p className="text-xs text-[var(--text-muted)]">
                Cruce BOM teórico (VW_BI_RECETA_COSTO) vs producción real (VW_BI_PRODUCCION).
                Expanda la flecha para ver ingredientes y detalle de órdenes.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!recetasFiltradas.length}
              onClick={() =>
                exportGeneralRecetasExcel(recetasFiltradas, {
                  vista: data?.vista,
                  vista_produccion: data?.vista_produccion,
                })
              }
            >
              <FileSpreadsheet className="mr-1.5 size-3.5" />
              Exportar Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="buscar-general">Buscar</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  id="buscar-general"
                  className="pl-9"
                  placeholder="Código o nombre…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
            <div className="w-[130px]">
              <Label htmlFor="min-costo">Costo mín.</Label>
              <Input
                id="min-costo"
                className="mt-1"
                type="number"
                min={0}
                step="0.01"
                placeholder="0"
                value={minCosto}
                onChange={(e) => setMinCosto(e.target.value)}
              />
            </div>
            <div className="w-[130px]">
              <Label htmlFor="max-costo">Costo máx.</Label>
              <Input
                id="max-costo"
                className="mt-1"
                type="number"
                min={0}
                step="0.01"
                placeholder="Sin límite"
                value={maxCosto}
                onChange={(e) => setMaxCosto(e.target.value)}
              />
            </div>
            <div className="w-[120px]">
              <Label htmlFor="min-ing">Mín. ingredientes</Label>
              <Input
                id="min-ing"
                className="mt-1"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={minIngredientes}
                onChange={(e) => setMinIngredientes(e.target.value)}
              />
            </div>
            <div className="min-w-[160px]">
              <Label>Ingredientes</Label>
              <Select
                value={filtroIngredientes}
                onValueChange={(v) => setFiltroIngredientes(v as 'todas' | 'con' | 'sin')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="con">Con ingredientes</SelectItem>
                  <SelectItem value="sin">Sin ingredientes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hayFiltrosActivos ? (
              <Button type="button" variant="outline" size="sm" className="mb-0.5" onClick={limpiarFiltros}>
                <X className="mr-1 size-3.5" />
                Limpiar
              </Button>
            ) : null}
            <div className="flex gap-2 pb-1">
              <Badge variant="outline" className="bg-white">
                {recetasFiltradas.length} de {data?.total_recetas ?? 0}
              </Badge>
              {data?.vista ? (
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {data.vista}
                </Badge>
              ) : null}
            </div>
          </div>

          {data?.produccion_error ? (
            <p className="text-xs text-amber-800">
              No se pudo cruzar producción: {data.produccion_error}
            </p>
          ) : data?.produccion_ok && data.vista_produccion ? (
            <p className="text-xs text-[var(--text-muted)]">
              Producción: <span className="font-mono text-[10px]">{data.vista_produccion}</span>
              {data.campos_produccion
                ? ` · ${Object.entries(data.campos_produccion)
                    .map(([k, v]) => `${k}→${v}`)
                    .join(', ')}`
                : ''}
            </p>
          ) : null}

          {data?.cantidad_derivada ? (
            <p className="text-xs text-[var(--navy)]">
              La vista no trae columna de cantidad: se calcula como{' '}
              <span className="font-mono">CostoLinea ÷ CostoUnitario</span>
              {data.campos_mapeados?.unidad
                ? ` · Unidad: ${data.campos_mapeados.unidad}`
                : ''}
              .
            </p>
          ) : data?.campos_mapeados && (!data.campos_mapeados.cantidad || !data.campos_mapeados.unidad) ? (
            <p className="text-xs text-amber-800">
              {!data.campos_mapeados.cantidad
                ? 'No se detectó columna de cantidad en la vista. '
                : ''}
              {!data.campos_mapeados.unidad
                ? 'No se detectó columna de unidad de medida. '
                : ''}
              Columnas mapeadas:{' '}
              {Object.entries(data.campos_mapeados)
                .map(([k, v]) => `${k}→${v}`)
                .join(', ')}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {data?.resumen_produccion ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-t-4" style={{ borderTopColor: BI_CHART.amber }}>
            <CardHeader className="px-3 pb-1 pt-2">
              <CardTitle className="text-[11px] text-[var(--text-muted)]">Teórico × producción</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <p className="text-base font-bold" style={{ color: BI_CHART.amber }}>
                {formatLps(data.resumen_produccion.total_costo_teorico)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-t-4" style={{ borderTopColor: BI_CHART.coral }}>
            <CardHeader className="px-3 pb-1 pt-2">
              <CardTitle className="text-[11px] text-[var(--text-muted)]">Costo producción real</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <p className="text-base font-bold" style={{ color: BI_CHART.coral }}>
                {formatLps(data.resumen_produccion.total_costo_produccion)}
              </p>
            </CardContent>
          </Card>
          <Card
            className="border-t-4"
            style={{
              borderTopColor:
                data.resumen_produccion.total_variacion > 0 ? BI_CHART.red : BI_CHART.teal,
            }}
          >
            <CardHeader className="px-3 pb-1 pt-2">
              <CardTitle className="text-[11px] text-[var(--text-muted)]">Variación</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <p
                className="text-base font-bold"
                style={{
                  color:
                    data.resumen_produccion.total_variacion > 0 ? BI_CHART.red : BI_CHART.teal,
                }}
              >
                {formatLps(data.resumen_produccion.total_variacion)}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {formatPct(data.resumen_produccion.variacion_pct)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-t-4" style={{ borderTopColor: BI_CHART.navy }}>
            <CardHeader className="px-3 pb-1 pt-2">
              <CardTitle className="text-[11px] text-[var(--text-muted)]">Recetas con producción</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <p className="text-base font-bold" style={{ color: BI_CHART.navy }}>
                {data.resumen_produccion.recetas_con_produccion}
                <span className="ml-1 text-xs font-normal text-[var(--text-muted)]">
                  / {data.total_recetas}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--gray-lt)]">
                <TableHead className="w-10" />
                <MaestroSortableHead
                  column="codigo"
                  label="Código"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <MaestroSortableHead
                  column="nombre"
                  label="Nombre"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <MaestroSortableHead
                  column="ingredientes"
                  label="Ingredientes"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="text-right"
                />
                <MaestroSortableHead
                  column="costo"
                  label="Costo unit. teórico"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="text-right"
                />
                <MaestroSortableHead
                  column="produccion"
                  label="Costo producción"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="text-right"
                />
                <MaestroSortableHead
                  column="variacion"
                  label="Variación"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="text-right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-[var(--text-muted)]">
                    No hay recetas para mostrar con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <RecetaMatrizRows
                    key={r.receta_code}
                    receta={r}
                    open={expanded.has(r.receta_code)}
                    onToggle={() => toggle(r.receta_code)}
                  />
                ))
              )}
            </TableBody>
          </Table>
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            fromItem={pagination.fromItem}
            toItem={pagination.toItem}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function RecetaMatrizRows({
  receta,
  open,
  onToggle,
}: {
  receta: RecetaMatrizItem
  open: boolean
  onToggle: () => void
}) {
  const costoProd = receta.costo_produccion ?? 0
  const variacion = receta.variacion ?? 0
  const qtyProd = receta.cantidad_producida ?? 0
  const detalleProd = receta.produccion_detalle ?? []

  return (
    <>
      <TableRow
        className={cn('cursor-pointer', open && 'bg-[var(--blue-lt)]/40')}
        onClick={onToggle}
        aria-expanded={open}
      >
        <TableCell className="w-10 px-2">
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-md text-[var(--navy)] hover:bg-white"
            aria-label={open ? 'Ocultar detalle' : 'Ver detalle'}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        </TableCell>
        <TableCell className="font-mono text-xs">{receta.receta_code}</TableCell>
        <TableCell className="font-medium">{receta.receta_nombre}</TableCell>
        <TableCell className="text-right">
          <span
            className="inline-flex min-w-8 justify-center rounded-md px-2 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: BI_CHART.purple }}
          >
            {receta.total_ingredientes}
          </span>
        </TableCell>
        <TableCell className="text-right font-medium" style={{ color: BI_CHART.amber }}>
          {formatLps(receta.costo_total)}
        </TableCell>
        <TableCell className="text-right font-medium" style={{ color: BI_CHART.coral }}>
          {detalleProd.length ? formatLps(costoProd) : '—'}
          {qtyProd > 0 ? (
            <div className="text-[10px] font-normal text-[var(--text-muted)]">
              Qty {qtyProd.toLocaleString('es-HN', { maximumFractionDigits: 2 })}
            </div>
          ) : null}
        </TableCell>
        <TableCell
          className="text-right font-medium"
          style={{
            color: !detalleProd.length
              ? undefined
              : variacion > 0
                ? BI_CHART.red
                : BI_CHART.teal,
          }}
        >
          {detalleProd.length ? (
            <>
              {formatLps(variacion)}
              <div className="text-[10px] font-normal text-[var(--text-muted)]">
                {formatPct(receta.variacion_pct ?? 0)}
              </div>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
        </TableCell>
      </TableRow>

      {open ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="bg-[var(--gray-bg)] p-0">
            <div className="space-y-4 border-t border-[var(--border)] px-4 py-3">
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                  Ingredientes (BOM teórico) — {receta.receta_nombre}
                </p>
                {receta.ingredientes.length === 0 ? (
                  <p className="py-3 text-center text-sm text-[var(--text-muted)]">
                    Sin ingredientes en la vista de costo.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Costo unit.</TableHead>
                        <TableHead className="text-right">Costo teórico</TableHead>
                        <TableHead className="text-right">% del total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receta.ingredientes.map((ing, i) => (
                        <TableRow key={`${ing.componente_code}-${i}`}>
                          <TableCell className="font-mono text-xs">
                            {ing.componente_code || '—'}
                          </TableCell>
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
                          <TableCell className="text-right font-medium">
                            {formatLps(ing.costo_teorico)}
                          </TableCell>
                          <TableCell className="text-right text-xs">{formatPct(ing.pct_costo)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                  Detalle de producción
                  {receta.ordenes ? ` · ${receta.ordenes} orden(es)` : ''}
                  {qtyProd > 0
                    ? ` · Qty ${qtyProd.toLocaleString('es-HN', { maximumFractionDigits: 2 })}`
                    : ''}
                  {detalleProd.length
                    ? ` · Teórico proyectado ${formatLps(receta.costo_teorico_prod ?? 0)}`
                    : ''}
                </p>
                {detalleProd.length === 0 ? (
                  <p className="py-3 text-center text-sm text-[var(--text-muted)]">
                    Sin líneas de producción para esta receta en VW_BI_PRODUCCION.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Orden</TableHead>
                        <TableHead>Almacén</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Costo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalleProd.slice(0, 100).map((d, i) => (
                        <TableRow key={`${d.orden}-${d.fecha}-${i}`}>
                          <TableCell className="text-xs">
                            {d.fecha ? formatDateDMY(d.fecha) : d.periodo || '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{d.orden || '—'}</TableCell>
                          <TableCell className="text-xs">{d.almacen || '—'}</TableCell>
                          <TableCell className="text-xs">{d.estado || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {d.cantidad > 0
                              ? d.cantidad.toLocaleString('es-HN', { maximumFractionDigits: 4 })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatLps(d.costo)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FlaskConical, Loader2, Search } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchMuestrasPorMatriz } from '@/lib/api/costeoMuestras'
import { exportMuestrasPorMatrizExcel } from '@/lib/exportCosteoExcel'
import type { MuestrasPorMatrizPayload } from '@/types/costeoMuestras'

import { BiChartTooltip } from './BiChartTooltip'
import { BI_CHART } from './chartTheme'

type Props = {
  onError: (msg: string | null) => void
}

function isoToday(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function isoYearStart(): string {
  return `${new Date().getFullYear()}-01-01`
}

function formatQty(v: number): string {
  return v.toLocaleString('es-HN', { maximumFractionDigits: 1 })
}

function formatRango(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function MuestrasRecibidasTab({ onError }: Props) {
  const [desde, setDesde] = useState(isoYearStart)
  const [hasta, setHasta] = useState(isoToday)
  const [applied, setApplied] = useState({ desde: isoYearStart(), hasta: isoToday() })
  const [data, setData] = useState<MuestrasPorMatrizPayload | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (range: { desde: string; hasta: string }) => {
    onError(null)
    setLoading(true)
    try {
      const payload = await fetchMuestrasPorMatriz(range)
      setData(payload)
      setApplied(range)
    } catch (e) {
      setData(null)
      onError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void load({ desde: isoYearStart(), hasta: isoToday() })
  }, [load])

  const chart = useMemo(() => {
    const rows = (data?.filas ?? []).slice(0, 12)
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.matriz, (counts.get(r.matriz) ?? 0) + 1)
    return rows.map((r) => ({
      name: (counts.get(r.matriz) ?? 0) > 1 ? `${r.matriz} (${r.codigo})` : r.matriz,
      cantidad: r.cantidad,
    }))
  }, [data])

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-3">
          <div className="w-[150px]">
            <Label htmlFor="m-desde" className="text-[11px]">Desde</Label>
            <Input
              id="m-desde"
              type="date"
              className="mt-0.5 h-8 text-xs"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
            />
          </div>
          <div className="w-[150px]">
            <Label htmlFor="m-hasta" className="text-[11px]">Hasta</Label>
            <Input
              id="m-hasta"
              type="date"
              className="mt-0.5 h-8 text-xs"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={loading || !desde || !hasta}
            onClick={() => void load({ desde, hasta })}
          >
            {loading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Search className="mr-1.5 size-3.5" />}
            Consultar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!data?.filas.length}
            onClick={() => data && exportMuestrasPorMatrizExcel(data)}
          >
            <FileSpreadsheet className="mr-1.5 size-3.5" />
            Excel
          </Button>
          <p className="max-w-xl text-[11px] text-[var(--text-muted)]">
            Órdenes de producción de producto terminado de laboratorio. La matriz es la familia del código de la receta
            (el texto antes del guion).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-[11px] text-[var(--text-muted)]">Muestras recibidas</p>
            <p className="text-xl font-semibold text-[var(--navy)]">
              {data ? formatQty(data.total_muestras) : '—'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {applied.desde ? `${formatRango(applied.desde)} – ${formatRango(applied.hasta)}` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[11px] text-[var(--text-muted)]">Matrices</p>
            <p className="text-xl font-semibold">{data ? data.total_matrices : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[11px] text-[var(--text-muted)]">Órdenes</p>
            <p className="text-xl font-semibold">{data ? formatQty(data.total_ordenes) : '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FlaskConical className="size-4 text-[var(--navy)]" />
            Cantidad por matriz
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)]">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Consultando SAP…
            </div>
          ) : chart.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              No hay muestras de laboratorio en ese rango.
            </p>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip
                    content={(
                      <BiChartTooltip
                        formatter={(v) => v.toLocaleString('es-HN', { maximumFractionDigits: 1 })}
                      />
                    )}
                  />
                  <Bar dataKey="cantidad" name="Muestras" fill={BI_CHART.navy} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matriz</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Área</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">Muestras</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.filas ?? []).map((r) => (
                <TableRow key={r.codigo}>
                  <TableCell className="font-medium">{r.matriz}</TableCell>
                  <TableCell className="text-xs text-[var(--text-muted)]">{r.codigo}</TableCell>
                  <TableCell className="text-xs">{r.area}</TableCell>
                  <TableCell className="text-right text-xs">{formatQty(r.ordenes)}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{formatQty(r.cantidad)}</TableCell>
                  <TableCell className="text-right text-xs">{r.pct.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {data && data.filas.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatQty(data.total_ordenes)}</TableCell>
                  <TableCell className="text-right">{formatQty(data.total_muestras)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

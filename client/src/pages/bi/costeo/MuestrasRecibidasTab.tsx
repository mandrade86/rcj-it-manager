import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, FileSpreadsheet, Loader2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchMuestrasPorMatriz } from '@/lib/api/costeoMuestras'
import { exportMuestrasPorMatrizExcel } from '@/lib/exportCosteoExcel'
import { cn } from '@/lib/utils'
import type { MuestrasPorMatrizPayload } from '@/types/costeoMuestras'

import { BiChartTooltip } from './BiChartTooltip'
import { INGREDIENT_COLORS } from './chartTheme'

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

function isoMonthStart(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`
}

function isoMonthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function formatQty(v: number): string {
  return Math.round(v).toLocaleString('es-HN')
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
  const [detalleAbierto, setDetalleAbierto] = useState(false)

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

  function aplicarRango(nextDesde: string, nextHasta: string) {
    setDesde(nextDesde)
    setHasta(nextHasta)
    void load({ desde: nextDesde, hasta: nextHasta })
  }

  const resumen = data?.resumen ?? []
  const principal = resumen[0]
  const chart = useMemo(
    () => resumen.map((r) => ({ name: r.tipo, cantidad: r.cantidad })),
    [resumen],
  )

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-3 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--navy)]">
              Muestras que recibió el laboratorio
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              {data && principal
                ? `Del ${formatRango(applied.desde)} al ${formatRango(applied.hasta)} entraron ${formatQty(data.total_muestras)} muestras. La mayor parte fueron de ${principal.tipo.toLowerCase()} (${principal.pct.toFixed(0)}%).`
                : 'Elija el periodo y vea de qué tipo de muestra llegó más trabajo al laboratorio.'}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => aplicarRango(isoMonthStart(), isoToday())}>
              Este mes
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => aplicarRango(isoMonthsAgo(3), isoToday())}>
              Últimos 3 meses
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => aplicarRango(isoYearStart(), isoToday())}>
              Este año
            </Button>
            <div className="w-[148px]">
              <Label htmlFor="m-desde" className="text-[11px]">Desde</Label>
              <Input id="m-desde" type="date" className="mt-0.5 h-8 text-xs" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="w-[148px]">
              <Label htmlFor="m-hasta" className="text-[11px]">Hasta</Label>
              <Input id="m-hasta" type="date" className="mt-0.5 h-8 text-xs" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={loading || !desde || !hasta}
              onClick={() => void load({ desde, hasta })}
            >
              {loading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
              Ver periodo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={!resumen.length}
              onClick={() => data && exportMuestrasPorMatrizExcel(data)}
            >
              <FileSpreadsheet className="mr-1.5 size-3.5" />
              Descargar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)]">Muestras recibidas</p>
            <p className="text-2xl font-semibold text-[var(--navy)]">
              {data ? formatQty(data.total_muestras) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)]">Tipo con más volumen</p>
            <p className="text-2xl font-semibold">{principal?.tipo ?? '—'}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {principal ? `${principal.pct.toFixed(0)}% del total` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-[var(--text-muted)]">Tipos de muestra</p>
            <p className="text-2xl font-semibold">{data ? resumen.length : '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading && !data ? (
            <div className="flex items-center justify-center py-10 text-sm text-[var(--text-muted)]">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Preparando el resumen…
            </div>
          ) : chart.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">
              En ese periodo no hay muestras registradas.
            </p>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={(
                      <BiChartTooltip
                        formatter={(v) => `${Math.round(v).toLocaleString('es-HN')} muestras`}
                      />
                    )}
                  />
                  <Bar dataKey="cantidad" name="Muestras" radius={[0, 4, 4, 0]}>
                    {chart.map((row, i) => (
                      <Cell key={row.name} fill={INGREDIENT_COLORS[i % INGREDIENT_COLORS.length]} />
                    ))}
                  </Bar>
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
                <TableHead>Tipo de muestra</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="w-[42%]">Participación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumen.map((r) => (
                <TableRow key={r.tipo}>
                  <TableCell className="font-medium">{r.tipo}</TableCell>
                  <TableCell className="text-right">{formatQty(r.cantidad)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 min-w-0 flex-1 rounded-full bg-[var(--gray-lt)]">
                        <div
                          className="h-2 rounded-full bg-[var(--navy)]"
                          style={{ width: `${Math.min(100, r.pct)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs text-[var(--text-muted)]">
                        {r.pct.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data && data.filas.length > 0 && (
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            onClick={() => setDetalleAbierto((v) => !v)}
          >
            <ChevronDown className={cn('size-3.5 transition-transform', detalleAbierto && 'rotate-180')} />
            Ver el detalle por familia de análisis
          </button>
          {detalleAbierto && (
            <Card className="mt-2">
              <CardContent className="px-0 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Familia</TableHead>
                      <TableHead>Laboratorio</TableHead>
                      <TableHead className="text-right">Muestras</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.filas.map((r) => (
                      <TableRow key={r.codigo}>
                        <TableCell>{r.tipo}</TableCell>
                        <TableCell className="text-xs">{r.matriz}</TableCell>
                        <TableCell className="text-xs">{r.area}</TableCell>
                        <TableCell className="text-right text-xs">{formatQty(r.cantidad)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

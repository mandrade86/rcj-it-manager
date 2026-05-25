import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  fetchGastosDepartamentos,
  fetchGastosDiagnostico,
  fetchGastosFinanciero,
  fetchGastosOpex,
  fetchGastosUltimoSync,
  postGastosAnalizarOpexIA,
  postGastosSync,
  type GastosDiagnostico,
} from '@/lib/api/gastos'
import { formatDateDMY, formatLps } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import type {
  GastosDepartamentoOpcion,
  GastosFinancieroPayload,
  GastosOpexPayload,
} from '@/types/gastos'

import { GastosFinancieroPanel } from './GastosFinancieroPanel'

function formatSyncLabel(iso: string | null): string {
  if (!iso) return 'Sin lectura aún'
  return formatDateDMY(iso)
}

const emptyFin: GastosFinancieroPayload = {
  archivo: 'data/gastos.xlsx',
  archivoExiste: false,
  hoja: '',
  columnasDetectadas: { ano: null, mes: null, categoria: '—', tipo: '—', descripcion: null, monto: '—' },
  tieneMes: false,
  anos: [],
  categorias: [],
  totalCapex: 0,
  totalOpex: 0,
  porCategoria: [],
  porAno: [],
  porTipoCategoria: [],
  matriz: [],
  mensual: [],
  ahorroAnual: [],
  filas: [],
}

export function GastosPage() {
  const isAdmin = useAuthStore((s) => s.hasPermiso('*'))
  const user = useAuthStore((s) => s.user)

  const [departamentos, setDepartamentos] = useState<GastosDepartamentoOpcion[]>([])
  const [departamentoId, setDepartamentoId] = useState<string | null>(
    user?.departamento_id ?? null,
  )
  const [opex, setOpex] = useState<GastosOpexPayload | null>(null)
  const [financiero, setFinanciero] = useState<GastosFinancieroPayload | null>(null)
  const [diag, setDiag] = useState<GastosDiagnostico | null>(null)
  const [ultimo, setUltimo] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [iaAnalisis, setIaAnalisis] = useState<string | null>(null)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaError, setIaError] = useState<string | null>(null)

  // Cargar la lista de departamentos elegibles (1 si no eres admin, todos si lo eres).
  useEffect(() => {
    void (async () => {
      try {
        const opts = await fetchGastosDepartamentos()
        setDepartamentos(opts)
        if (!departamentoId && opts.length > 0) {
          setDepartamentoId(opts[0]._id)
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Error cargando departamentos')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [o, f, u, d] = await Promise.all([
        fetchGastosOpex(departamentoId),
        fetchGastosFinanciero(departamentoId),
        fetchGastosUltimoSync(departamentoId),
        fetchGastosDiagnostico(departamentoId),
      ])
      setOpex(o)
      setFinanciero(f)
      setUltimo(u.fecha)
      setDiag(d)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
    }
  }, [departamentoId])

  useEffect(() => {
    void load()
  }, [load])

  const contexto = opex?.contexto ?? financiero?.contexto ?? null
  const archivoActual = contexto?.archivoRelativo ?? opex?.archivo ?? 'data/gastos.xlsx'
  const deptActual = departamentos.find((d) => d._id === departamentoId) ?? null
  const deptNombre = contexto?.departamento_nombre ?? deptActual?.nombre ?? ''

  const chartData = useMemo(() => {
    if (!opex?.categorias.length) return []
    return opex.categorias.map((c) => ({
      nombre: c.nombre,
      actual: c.total,
      meta: c.meta20,
    }))
  }, [opex])

  const totalesMensuales = useMemo(() => {
    if (!opex?.periodos.length) return []
    return opex.periodos.map((p) =>
      opex.categorias.reduce((a, c) => a + (c.meses[p] ?? 0), 0),
    )
  }, [opex])

  const handleAnalizarIA = async () => {
    setIaLoading(true)
    setIaError(null)
    try {
      const result = await postGastosAnalizarOpexIA(
        departamentoId ? { departamento_id: departamentoId } : undefined,
      )
      setIaAnalisis(result.analisis)
    } catch (e) {
      setIaError(e instanceof Error ? e.message : 'Error al analizar')
    } finally {
      setIaLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--navy)]">
          Gastos — CAPEX y OPEX{deptNombre ? ` · ${deptNombre}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          Análisis financiero desde la hoja <strong>Query1</strong> (Power Query) y presupuesto OPEX mensual desde la
          hoja base del Excel del departamento.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm">
        <div className="flex flex-1 flex-wrap items-end gap-4">
          {isAdmin && departamentos.length > 1 && (
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Departamento
              </label>
              <select
                value={departamentoId ?? ''}
                onChange={(e) => setDepartamentoId(e.target.value || null)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {departamentos.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.codigo} — {d.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <p>
              <span className="text-muted-foreground">Leyendo:</span>{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{archivoActual}</code>
            </p>
            <p className="text-muted-foreground">
              Último sync: <strong className="text-foreground">{formatSyncLabel(ultimo)}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={iaLoading || !departamentoId || !opex?.archivoExiste}
            className="gap-1.5 border-[var(--navy)]/30 text-[var(--navy)]"
            onClick={() => void handleAnalizarIA()}
          >
            {iaLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {iaLoading ? 'Analizando…' : 'Analizar con IA'}
          </Button>
          <Button
            type="button"
            disabled={syncing || !departamentoId}
            className="bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            onClick={async () => {
              setSyncing(true)
              try {
                const [r, d] = await Promise.all([
                  postGastosSync(departamentoId),
                  fetchGastosDiagnostico(departamentoId),
                ])
                setOpex(r.opex)
                setFinanciero(r.financiero)
                setUltimo(r.syncAt)
                setDiag(d)
              } catch (e) {
                window.alert(e instanceof Error ? e.message : 'Error al sincronizar')
              } finally {
                setSyncing(false)
              }
            }}
          >
            {syncing ? 'Sincronizando…' : 'Sincronizar'}
          </Button>
        </div>
      </div>

      {(iaAnalisis || iaError) && (
        <Card className="border-[var(--navy)]/20 bg-gradient-to-br from-[var(--blue-lt)]/40 to-white shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-[var(--navy)]">
              <Sparkles className="size-4 text-[var(--lime)]" />
              Análisis de IA — Oportunidades de ahorro OPEX
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 text-muted-foreground"
              onClick={() => {
                setIaAnalisis(null)
                setIaError(null)
              }}
            >
              Cerrar
            </Button>
          </CardHeader>
          <CardContent>
            {iaError ? (
              <p className="text-sm text-destructive">{iaError}</p>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {iaAnalisis}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {err && (
        <p className="text-sm text-destructive">
          {err}{' '}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => void load()}>
            Reintentar
          </Button>
        </p>
      )}

      {opex && !opex.archivoExiste && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
          Coloca el archivo Excel de gastos del departamento{deptNombre ? ` ${deptNombre}` : ''} en{' '}
          <code className="mx-1 rounded bg-white/60 px-1">{archivoActual}</code> y haz clic en{' '}
          <strong>Sincronizar</strong>. Como alternativa puedes usar el archivo genérico{' '}
          <code className="rounded bg-white/60 px-1">data/gastos.xlsx</code>.
        </div>
      )}

      <Tabs defaultValue="financiero" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="financiero">Análisis CAPEX / OPEX</TabsTrigger>
          <TabsTrigger value="opex">OPEX mensual (base)</TabsTrigger>
        </TabsList>

        <TabsContent value="financiero" className="mt-6 space-y-4">
          {/* Diagnóstico de hojas — visible cuando Query1 no se detecta */}
          {diag?.archivoExiste && (financiero == null || (!financiero.totalCapex && !financiero.totalOpex && !financiero.filas.length)) && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-50 p-4 text-sm">
              <p className="mb-2 font-semibold text-amber-900">
                No se detectó la hoja Query1 automáticamente.
                Hojas encontradas en <code className="rounded bg-white/60 px-1">data/gastos.xlsx</code>:
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-amber-800">
                    <th className="pb-1 pr-4">Nombre de hoja</th>
                    <th className="pb-1 pr-4">Filas</th>
                    <th className="pb-1">Cabeceras detectadas</th>
                  </tr>
                </thead>
                <tbody>
                  {diag.hojas.map((h) => (
                    <tr key={h.nombre} className="border-t border-amber-200">
                      <td className="py-1 pr-4 font-medium text-amber-900">{h.nombre}</td>
                      <td className="py-1 pr-4 tabular-nums text-amber-700">{h.filas}</td>
                      <td className="py-1 text-amber-700">{h.cabeceras.slice(0, 6).join(' | ') || '(vacía)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-amber-800">
                Renombra la hoja con tus datos a <strong>Query1</strong> (o{' '}
                <strong>Consulta1</strong>) y haz clic en Sincronizar.
                {diag.hojas.length > 0 && (
                  <> Nombre actual detectado: <strong>{diag.hojas.map((h) => h.nombre).join(', ')}</strong>.</>
                )}
              </p>
            </div>
          )}
          <GastosFinancieroPanel data={financiero ?? emptyFin} />
        </TabsContent>

        <TabsContent value="opex" className="mt-6 space-y-6">
          {opex?.advertencia && <p className="text-sm text-amber-900">{opex.advertencia}</p>}

          {opex && opex.archivoExiste && opex.categorias.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      OPEX base (anual)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-[var(--navy)]">
                      {formatLps(opex.totalAnual)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Meta reducción (−20%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-[var(--navy)]">
                      {formatLps(opex.meta20)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Ahorro proyectado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-[var(--lime)]">
                      {formatLps(opex.ahorroProyectado)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actual vs. meta −20% por categoría</CardTitle>
                  <p className="text-sm text-muted-foreground">Hoja usada: {opex.hoja ?? '—'}</p>
                </CardHeader>
                <CardContent className="h-[min(420px,50vh)] min-h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatLps(Number(v))} />
                      <YAxis type="category" dataKey="nombre" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value, name) => [
                          formatLps(Number(value ?? 0)),
                          String(name),
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="actual" name="Actual" fill="#002060" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="meta" name="Meta −20%" fill="#70AD47" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desglose mensual</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 z-10 bg-card">Categoría</TableHead>
                        {opex.periodos.map((p) => (
                          <TableHead key={p} className="whitespace-nowrap text-right">
                            {p}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Meta −20%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opex.categorias.map((c) => (
                        <TableRow key={c.nombre}>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium">
                            {c.nombre}
                          </TableCell>
                          {opex.periodos.map((p) => (
                            <TableCell key={p} className="text-right text-sm tabular-nums">
                              {formatLps(c.meses[p] ?? 0)}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatLps(c.total)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {formatLps(c.meta20)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-[var(--gray-lt)] font-medium">
                        <TableCell className="sticky left-0 z-10 bg-[var(--gray-lt)]">Totales</TableCell>
                        {totalesMensuales.map((t, i) => (
                          <TableCell key={opex.periodos[i]} className="text-right tabular-nums">
                            {formatLps(t)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums">
                          {formatLps(opex.totalAnual)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatLps(opex.meta20)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {opex && opex.archivoExiste && opex.categorias.length === 0 && !opex.advertencia && (
            <p className="text-sm text-muted-foreground">
              El archivo existe pero no se encontraron filas de categorías OPEX con montos. Revisa el formato (primera
              columna categoría, encabezados de meses en una fila).
            </p>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Los datos se leen del archivo local{' '}
        <code className="rounded bg-muted px-1">{archivoActual}</code>. Para actualizar: reemplaza el archivo y haz
        clic en &quot;Sincronizar&quot;. La ruta del archivo se configura por departamento en{' '}
        <strong>Maestros → Departamentos</strong>.
      </p>
    </div>
  )
}

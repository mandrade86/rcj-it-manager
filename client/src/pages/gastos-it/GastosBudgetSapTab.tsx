import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { fetchBudgetItSap, fetchGastosPorCuenta } from '@/lib/api/costosIt'
import { formatDateDMY, formatMoney } from '@/lib/format'
import { GastosBudgetSapDashboard } from '@/pages/gastos-it/GastosBudgetSapDashboard'
import { usePagination } from '@/hooks/usePagination'
import type { BudgetItSap, GastoCuentaDetalle } from '@/types/budgetIt'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const MES_ALIASES: Array<{ label: string; aliases: string[] }> = [
  { label: 'Enero', aliases: ['enero', 'ene', 'jan', 'january'] },
  { label: 'Febrero', aliases: ['febrero', 'feb', 'february'] },
  { label: 'Marzo', aliases: ['marzo', 'mar', 'march'] },
  { label: 'Abril', aliases: ['abril', 'abr', 'apr', 'april'] },
  { label: 'Mayo', aliases: ['mayo', 'may'] },
  { label: 'Junio', aliases: ['junio', 'jun', 'june'] },
  { label: 'Julio', aliases: ['julio', 'jul', 'july'] },
  { label: 'Agosto', aliases: ['agosto', 'ago', 'aug', 'august'] },
  { label: 'Septiembre', aliases: ['septiembre', 'setiembre', 'sep', 'sept', 'september'] },
  { label: 'Octubre', aliases: ['octubre', 'oct', 'october'] },
  { label: 'Noviembre', aliases: ['noviembre', 'nov', 'november'] },
  { label: 'Diciembre', aliases: ['diciembre', 'dic', 'dec', 'december'] },
]

type ParMensual = {
  mes_label: string
  col_planificado: string
  col_ejecutado: string
}

function esColumnaEjecutado(name: string): boolean {
  return /^(ejecutado|real|actual)\b/i.test(name.trim())
}

function esColumnaPlanificado(name: string): boolean {
  return /^(planificado|presupuesto|budget)\b/i.test(name.trim())
}

function mesDeColumna(name: string): string | null {
  const low = name.toLowerCase()
  for (const m of MES_ALIASES) {
    if (m.aliases.some((a) => low.includes(a))) return m.label
  }
  return null
}

/** Pares planificado/ejecutado por mes — desde API o detectados en columnas. */
function paresPlanEjec(resumen: BudgetItSap['resumen'], columnas: string[]): ParMensual[] {
  if (resumen.pares_mensuales?.length) {
    return resumen.pares_mensuales.map((p) => ({
      mes_label: p.mes_label,
      col_planificado: p.col_planificado,
      col_ejecutado: p.col_ejecutado,
    }))
  }
  const pairs: ParMensual[] = []
  for (const m of MES_ALIASES) {
    const plan = columnas.find(
      (c) => esColumnaPlanificado(c) && m.aliases.some((a) => c.toLowerCase().includes(a)),
    )
    const ejec = columnas.find(
      (c) => esColumnaEjecutado(c) && m.aliases.some((a) => c.toLowerCase().includes(a)),
    )
    if (plan && ejec) {
      pairs.push({ mes_label: m.label, col_planificado: plan, col_ejecutado: ejec })
    }
  }
  return pairs
}

function isMontoColumn(name: string, resumen: BudgetItSap['resumen'], columnas: string[] = []): boolean {
  if (name === resumen.columna_planificado || name === resumen.columna_ejecutado || name === resumen.columna_monto) {
    return true
  }
  if (paresPlanEjec(resumen, columnas).some((p) => p.col_planificado === name || p.col_ejecutado === name)) {
    return true
  }
  return esColumnaPlanificado(name) || esColumnaEjecutado(name) || /monto|importe|amount/i.test(name)
}

function formatCell(
  value: unknown,
  column: string,
  resumen: BudgetItSap['resumen'],
  moneda: string = 'USD',
  columnas: string[] = [],
): string {
  if (value == null || value === '') return '—'
  if (isMontoColumn(column, resumen, columnas)) {
    const n = Number(value)
    if (Number.isFinite(n)) return formatMoney(n, moneda)
  }
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    const d = value instanceof Date ? value : new Date(value)
    if (!Number.isNaN(d.getTime())) return formatDateDMY(d.toISOString().slice(0, 10))
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  return String(value)
}

function toNum(value: unknown): number {
  if (value == null || value === '') return 0
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function filaTotalesPlanEjec(
  fila: Record<string, unknown>,
  resumen: BudgetItSap['resumen'],
  columnas: string[] = [],
): { planificado: number; ejecutado: number } {
  const pairs = paresPlanEjec(resumen, columnas)
  if (pairs.length) {
    let planificado = 0
    let ejecutado = 0
    for (const p of pairs) {
      planificado += toNum(fila[p.col_planificado])
      ejecutado += toNum(fila[p.col_ejecutado])
    }
    return { planificado, ejecutado }
  }
  return {
    planificado: resumen.columna_planificado ? toNum(fila[resumen.columna_planificado]) : 0,
    ejecutado: resumen.columna_ejecutado ? toNum(fila[resumen.columna_ejecutado]) : 0,
  }
}

function filaSobrePresupuesto(
  fila: Record<string, unknown>,
  resumen: BudgetItSap['resumen'],
  columnas: string[] = [],
): boolean {
  const pairs = paresPlanEjec(resumen, columnas)
  // Sobre si CUALQUIER mes ejecutado > planificado, o el total
  if (pairs.length) {
    return pairs.some((p) => toNum(fila[p.col_ejecutado]) > toNum(fila[p.col_planificado]))
  }
  const { planificado, ejecutado } = filaTotalesPlanEjec(fila, resumen, columnas)
  return ejecutado > planificado
}

/**
 * True solo para celdas de Ejecutado que superan su Planificado del mismo mes.
 * También funciona si no viene pares_mensuales del API (detecta por nombre de columna).
 */
function celdaEjecutadoRoja(
  fila: Record<string, unknown>,
  col: string,
  resumen: BudgetItSap['resumen'],
  columnas: string[] = [],
): boolean {
  if (!esColumnaEjecutado(col) && col !== resumen.columna_ejecutado) return false

  const pairs = paresPlanEjec(resumen, columnas)
  const pair = pairs.find((p) => p.col_ejecutado === col)
  if (pair) {
    return toNum(fila[col]) > toNum(fila[pair.col_planificado])
  }

  // Fallback: misma etiqueta de mes en una columna Planificado*
  const mes = mesDeColumna(col)
  if (mes) {
    const planCol = columnas.find(
      (c) => esColumnaPlanificado(c) && c.toLowerCase().includes(mes.toLowerCase()),
    )
    if (planCol) return toNum(fila[col]) > toNum(fila[planCol])
  }

  if (col === resumen.columna_ejecutado && resumen.columna_planificado) {
    return toNum(fila[col]) > toNum(fila[resumen.columna_planificado])
  }
  return false
}

function cuentaDeFila(fila: Record<string, unknown>, resumen: BudgetItSap['resumen']): string {
  if (resumen.columna_cuenta) return String(fila[resumen.columna_cuenta] ?? '').trim()
  for (const key of Object.keys(fila)) {
    if (/numero.?de.?cuenta|num.?cuenta|^cuenta$/i.test(key)) {
      return String(fila[key] ?? '').trim()
    }
  }
  return ''
}

export function GastosBudgetSapTab() {
  const now = new Date()
  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState('todos')
  const [empresa, setEmpresa] = useState('')
  const [empresasOpciones, setEmpresasOpciones] = useState<string[]>([])
  const [monedasEmpresa, setMonedasEmpresa] = useState<Record<string, string>>({})
  const [busqueda, setBusqueda] = useState('')
  const [data, setData] = useState<BudgetItSap | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [expandedCuenta, setExpandedCuenta] = useState<string | null>(null)
  const [gastosCache, setGastosCache] = useState<Record<string, GastoCuentaDetalle[]>>({})
  const [gastosLoading, setGastosLoading] = useState<string | null>(null)
  const [gastosErr, setGastosErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const payload = await fetchBudgetItSap({
        anio,
        mes: mes === 'todos' ? undefined : Number(mes),
        empresa: empresa || undefined,
      })
      setData(payload)
      if (payload.empresas?.length) {
        setEmpresasOpciones((prev) =>
          [...new Set([...prev, ...payload.empresas])].sort((a, b) => a.localeCompare(b, 'es')),
        )
      }
      if (payload.monedas_empresa) {
        setMonedasEmpresa((prev) => ({ ...prev, ...payload.monedas_empresa }))
      }
      if (!empresa && payload.empresas.length === 1) {
        setEmpresa(payload.empresas[0]!)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error cargando presupuesto SAP')
    } finally {
      setLoading(false)
    }
  }, [anio, mes, empresa])

  useEffect(() => {
    void load()
  }, [load])

  // Precargar empresas desde monedas configuradas (para que el filtro aparezca aunque SAP tarde)
  useEffect(() => {
    void (async () => {
      try {
        const { fetchEmpresasMoneda } = await import('@/lib/api/costosIt')
        const { items } = await fetchEmpresasMoneda()
        if (items.length) {
          setEmpresasOpciones((prev) =>
            [...new Set([...prev, ...items.map((i) => i.empresa)])].sort((a, b) =>
              a.localeCompare(b, 'es'),
            ),
          )
          setMonedasEmpresa((prev) => {
            const next = { ...prev }
            for (const i of items) next[i.empresa] = i.moneda
            return next
          })
        }
      } catch {
        /* opcional */
      }
    })()
  }, [])

  const filasBase = data?.filas ?? []
  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return filasBase
    return filasBase.filter((f) =>
      Object.values(f).some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [filasBase, busqueda])

  const columnas = data?.columnas ?? (filasBase[0] ? Object.keys(filasBase[0]) : [])
  const resumen = data?.resumen

  const filasSobrePresupuesto = useMemo(() => {
    if (!resumen) return 0
    return filas.filter((f) => filaSobrePresupuesto(f, resumen, columnas)).length
  }, [filas, resumen, columnas])

  const pagination = usePagination(filas.length, {
    resetKey: `${anio}|${mes}|${empresa}|${busqueda}|${filas.length}`,
  })
  const filasPagina = pagination.slice(filas)

  const toggleGastosCuenta = useCallback(
    async (cuenta: string) => {
      if (!cuenta || !empresa) return
      if (expandedCuenta === cuenta) {
        setExpandedCuenta(null)
        return
      }
      setExpandedCuenta(cuenta)
      setGastosErr(null)
      if (gastosCache[cuenta]) return
      setGastosLoading(cuenta)
      try {
        const res = await fetchGastosPorCuenta({
          anio,
          mes: mes === 'todos' ? undefined : Number(mes),
          empresa,
          cuenta,
        })
        setGastosCache((prev) => ({ ...prev, [cuenta]: res.gastos }))
      } catch (e) {
        setGastosErr(e instanceof Error ? e.message : 'Error cargando gastos de la cuenta')
      } finally {
        setGastosLoading(null)
      }
    },
    [anio, mes, empresa, expandedCuenta, gastosCache],
  )

  const anios = useMemo(
    () => Array.from({ length: 6 }, (_, i) => now.getFullYear() - i + 1),
    [now],
  )

  const periodoLabel =
    mes === 'todos'
      ? `Año ${anio} · todos los meses`
      : `${MESES[Number(mes) - 1]} ${anio}`

  const empresaLabel = empresa || 'Seleccione empresa'
  const moneda = data?.moneda ?? (empresa ? monedasEmpresa[empresa] : null) ?? 'USD'

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--text-muted)]">
        Presupuesto IT <strong>por empresa</strong> ({periodoLabel}).
        No hay presupuesto global: debe seleccionar una empresa. Moneda: <strong>{moneda}</strong>.
      </p>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Año</label>
            <Select value={String(anio)} onValueChange={(v) => setAnio(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anios.map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Mes</label>
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo el año</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Empresa</label>
            <Select
              value={empresa || '__none__'}
              onValueChange={(v) => setEmpresa(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Empresa (obligatorio)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Seleccione empresa —</SelectItem>
                {empresasOpciones.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                    {monedasEmpresa[e] ? ` (${monedasEmpresa[e]})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="text-xs font-medium text-[var(--text-muted)]">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-[var(--text-muted)]" />
              <Input
                placeholder="Buscar en la vista…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="mb-0.5">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            <span className="ml-2">Actualizar</span>
          </Button>
        </CardContent>
      </Card>

      {empresasOpciones.length === 0 && !loading && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No se detectaron empresas en la vista SAP. Configure monedas en la pestaña{' '}
          <strong>Monedas por empresa</strong> o verifique que la vista tenga columna Empresa.
        </div>
      )}

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-6 animate-spin" />
          Leyendo TS_VW_BUDGET_IT…
        </div>
      ) : data ? (
        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="detalle">Detalle SAP</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <GastosBudgetSapDashboard
              data={data}
              periodoLabel={`${periodoLabel} · ${empresaLabel}`}
              anio={anio}
              mes={mes === 'todos' ? null : Number(mes)}
              empresa={empresa || null}
            />
          </TabsContent>

          <TabsContent value="detalle" className="space-y-4">
            {!empresa ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Seleccione una empresa para ver el detalle SAP. No hay presupuesto global.
              </div>
            ) : (
            <>
            <div className="grid gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Filas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{filas.length.toLocaleString('es-HN')}</p>
                  <p className="text-xs text-[var(--text-muted)]">{periodoLabel}</p>
                </CardContent>
              </Card>
              <Card className={filasSobrePresupuesto > 0 ? 'border-red-200 bg-red-50/40' : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Sobre presupuesto</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${filasSobrePresupuesto > 0 ? 'text-red-700' : ''}`}>
                    {filasSobrePresupuesto.toLocaleString('es-HN')}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">Ejecutado &gt; planificado</p>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                    Totales ({moneda})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {resumen?.total_planificado != null && (
                      <span>
                        Planificado: <strong>{formatMoney(resumen.total_planificado, moneda)}</strong>
                      </span>
                    )}
                    {resumen?.total_ejecutado != null && (
                      <span className={resumen.variacion != null && resumen.variacion > 0 ? 'text-red-700' : undefined}>
                        Ejecutado: <strong>{formatMoney(resumen.total_ejecutado, moneda)}</strong>
                      </span>
                    )}
                    {resumen?.variacion != null && (
                      <span className={resumen.variacion > 0 ? 'font-medium text-red-700' : 'text-green-700'}>
                        Variación: <strong>{formatMoney(resumen.variacion, moneda)}</strong>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {data.vista} · {periodoLabel} · {empresaLabel}
                </CardTitle>
                <p className="text-sm text-[var(--text-muted)]">
                  Clic en la flecha para ver gastos de la cuenta. En rojo (fondo + texto): cada{' '}
                  <strong>Ejecutado</strong> de un mes que supera su <strong>Planificado</strong>.
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {filas.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                    Sin datos para los filtros seleccionados.
                  </p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 sticky left-0 bg-white z-10" />
                          {columnas.map((col) => (
                            <TableHead
                              key={col}
                              className={
                                isMontoColumn(col, resumen!, columnas)
                                  ? 'text-right whitespace-nowrap'
                                  : 'whitespace-nowrap'
                              }
                            >
                              {col}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filasPagina.map((fila, idx) => {
                          const sobre = filaSobrePresupuesto(fila, resumen!, columnas)
                          const cuenta = cuentaDeFila(fila, resumen!)
                          const isOpen = Boolean(cuenta && expandedCuenta === cuenta)
                          const gastos = cuenta ? gastosCache[cuenta] : undefined
                          return (
                            <Fragment key={`${cuenta || idx}-${idx}`}>
                              <TableRow
                                className={`cursor-pointer ${sobre ? 'bg-red-50/80 hover:bg-red-100/70' : 'hover:bg-[var(--gray-lt)]'}`}
                                onClick={() => void toggleGastosCuenta(cuenta)}
                              >
                                <TableCell className="sticky left-0 bg-inherit z-10 w-8">
                                  {!cuenta ? null : gastosLoading === cuenta ? (
                                    <Loader2 className="size-4 animate-spin text-[var(--text-muted)]" />
                                  ) : isOpen ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                </TableCell>
                                {columnas.map((col) => {
                                  const celdaRoja = celdaEjecutadoRoja(fila, col, resumen!, columnas)
                                  return (
                                    <TableCell
                                      key={col}
                                      className={
                                        isMontoColumn(col, resumen!, columnas)
                                          ? `text-right font-medium tabular-nums ${
                                              celdaRoja
                                                ? 'bg-red-100 font-bold text-red-700'
                                                : ''
                                            }`
                                          : 'max-w-[280px] truncate text-sm'
                                      }
                                      title={
                                        celdaRoja
                                          ? `Ejecutado supera planificado: ${formatCell(fila[col], col, resumen!, moneda, columnas)}`
                                          : formatCell(fila[col], col, resumen!, moneda, columnas)
                                      }
                                    >
                                      {formatCell(fila[col], col, resumen!, moneda, columnas)}
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                              {isOpen && (
                                <TableRow className="bg-[var(--gray-lt)]/70">
                                  <TableCell colSpan={columnas.length + 1} className="p-0">
                                    <div className="border-t border-[var(--border)] px-4 py-3">
                                      <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                                        Gastos de la cuenta <strong>{cuenta}</strong>
                                        {gastosLoading === cuenta ? ' — cargando…' : ''}
                                      </p>
                                      {gastosErr && expandedCuenta === cuenta && (
                                        <p className="mb-2 text-sm text-red-700">{gastosErr}</p>
                                      )}
                                      {!gastos?.length && gastosLoading !== cuenta ? (
                                        <p className="text-sm text-[var(--text-muted)]">
                                          Sin gastos en la vista de costos IT para esta cuenta/periodo.
                                          Verifique que la cuenta y empresa coincidan con los gastos reales.
                                        </p>
                                      ) : gastos?.length ? (
                                        <div className="max-h-80 overflow-auto rounded-md border border-[var(--border)] bg-white">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Nº Cuenta</TableHead>
                                                <TableHead>Proveedor</TableHead>
                                                <TableHead>Descripción</TableHead>
                                                <TableHead>Documento</TableHead>
                                                <TableHead className="text-right">Monto</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {gastos.map((g, i) => (
                                                <TableRow key={i}>
                                                  <TableCell className="whitespace-nowrap text-sm">
                                                    {g.fecha ? formatDateDMY(g.fecha) : '—'}
                                                  </TableCell>
                                                  <TableCell
                                                    className="font-mono text-xs whitespace-nowrap"
                                                    title={g.cuenta_nombre || g.cuenta}
                                                  >
                                                    {g.cuenta || '—'}
                                                  </TableCell>
                                                  <TableCell className="max-w-[160px] truncate text-sm">
                                                    {g.proveedor || '—'}
                                                  </TableCell>
                                                  <TableCell className="max-w-[280px] truncate text-sm">
                                                    {g.descripcion || '—'}
                                                  </TableCell>
                                                  <TableCell className="font-mono text-xs">
                                                    {g.documento || '—'}
                                                  </TableCell>
                                                  <TableCell className="text-right tabular-nums text-sm font-medium">
                                                    {formatMoney(g.monto, g.moneda)}
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                              <TableRow className="bg-[var(--gray-lt)] font-semibold">
                                                <TableCell colSpan={5}>
                                                  Total gastos ({gastos.length} movimientos)
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                  {formatMoney(
                                                    gastos.reduce((s, g) => s + g.monto, 0),
                                                    moneda,
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          )
                        })}
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
                      className="-mx-6 rounded-b-lg"
                    />
                    {data.aviso ? (
                      <p className="mt-3 text-xs text-[var(--text-muted)]">{data.aviso}</p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
            </>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}

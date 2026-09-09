import { useCallback, useMemo, useState, Fragment } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronDown, ChevronRight, Loader2, TrendingDown, TrendingUp, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { fetchGastosPorCuenta } from '@/lib/api/costosIt'
import { formatDateDMY, formatMoney } from '@/lib/format'
import {
  GastosDetalleTablaHeader,
  type GastosDetalleColumnaDef,
} from '@/pages/gastos-it/GastosDetalleTablaHeader'
import type {
  BudgetItSap,
  BudgetItSapDashboardCuenta,
  GastoCuentaDetalle,
  MonedaEmpresa,
} from '@/types/budgetIt'

const LINE_COLORS = ['#002060', '#70AD47', '#C00000', '#1F4E79', '#7F6000', '#4527A0', '#0F6E56', '#375623']
const CONSOL_PLAN = '#002060'
const CONSOL_EJEC = '#70AD47'
const CONSOL_EJEC_SOBRE = '#C00000'

function KpiCard({
  title,
  value,
  sub,
  trend,
  alert,
}: {
  title: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | null
  alert?: boolean
}) {
  return (
    <Card className={alert ? 'border-red-200 bg-red-50/40' : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-[var(--text-muted)]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <p className={`text-2xl font-semibold ${alert ? 'text-red-700' : ''}`}>{value}</p>
          {trend === 'up' && <TrendingUp className="size-4 text-red-500" />}
          {trend === 'down' && <TrendingDown className="size-4 text-green-600" />}
        </div>
        {sub && <p className="mt-1 text-xs text-[var(--text-muted)]">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function SemaforoEjecucion({ pct, variacion }: { pct: number | null; variacion: number }) {
  const sobre = variacion > 0
  const color = sobre ? 'bg-red-500' : pct != null && pct >= 85 ? 'bg-amber-400' : 'bg-green-500'
  const label = sobre ? 'Sobre presupuesto' : pct != null && pct >= 85 ? 'Atención' : 'Controlado'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${sobre ? 'font-medium text-red-700' : ''}`}>
      <span className={`size-2.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

/** Acumula gastos en orden cronológico y marca lo que ya pasó el planificado. */
function marcarGastosSobrePlan(
  gastos: GastoCuentaDetalle[],
  planificado: number,
): Array<GastoCuentaDetalle & { acumulado: number; pasa_presupuesto: boolean }> {
  const ordenados = [...gastos].sort((a, b) =>
    String(a.fecha ?? '').localeCompare(String(b.fecha ?? '')),
  )
  let acumulado = 0
  return ordenados.map((g) => {
    acumulado += g.monto
    return {
      ...g,
      acumulado,
      pasa_presupuesto: planificado > 0 ? acumulado > planificado : false,
    }
  })
}

const COLUMNAS_CUENTA: GastosDetalleColumnaDef[] = [
  { id: '_expand', label: '', className: 'w-8' },
  { id: 'cuenta', label: 'Cuenta', filter: 'select' },
  { id: 'cuenta_nombre', label: 'Nombre', filter: 'text', className: 'min-w-[180px]' },
  { id: 'planificado', label: 'Planificado', align: 'right' },
  { id: 'ejecutado', label: 'Ejecutado', align: 'right' },
  { id: 'variacion', label: 'Variación', align: 'right' },
  { id: 'ejecucion_pct', label: '% ejec.', align: 'right' },
  { id: 'estado', label: 'Estado', filter: 'select' },
]

type Props = {
  data: BudgetItSap
  periodoLabel: string
  anio: number
  mes: number | null
  empresa: string | null
}

export function GastosBudgetSapDashboard({ data, periodoLabel, anio, mes, empresa }: Props) {
  const { resumen, dashboard } = data
  const moneda: MonedaEmpresa = data.moneda ?? 'USD'
  const tieneComparacion =
    (resumen.pares_mensuales?.length ?? 0) > 0
    || (resumen.columna_planificado != null && resumen.columna_ejecutado != null)
  const sobrePresupuesto = (resumen.variacion ?? 0) > 0
  const requiereEmpresa = data.requiere_empresa || !empresa

  const resumenEmpresas = dashboard.por_empresa
  const cuentas = dashboard.por_cuenta

  const [expanded, setExpanded] = useState<string | null>(null)
  const [detalleCache, setDetalleCache] = useState<Record<string, GastoCuentaDetalle[]>>({})
  const [detalleLoading, setDetalleLoading] = useState<string | null>(null)
  const [detalleErr, setDetalleErr] = useState<string | null>(null)
  const [filtrosCuenta, setFiltrosCuenta] = useState<Record<string, string>>({})

  const chartConsolidado = dashboard.por_mes.map((m) => ({
    mes: m.mes_label.slice(0, 3),
    planificado: m.planificado,
    ejecutado: m.ejecutado,
    sobre: m.ejecutado > m.planificado,
  }))

  const topEmpresas = useMemo(
    () => resumenEmpresas.slice(0, 8).map((e, i) => ({ ...e, key: `emp_${i}` })),
    [resumenEmpresas],
  )

  const chartPorEmpresa = useMemo(() => {
    return dashboard.por_mes.map((m) => {
      const row: Record<string, string | number> = { mes: m.mes_label.slice(0, 3) }
      for (const { empresa: emp, key } of topEmpresas) {
        const pt = dashboard.por_empresa_mes.find((x) => x.empresa === emp && x.mes === m.mes)
        row[key] = pt?.ejecutado ?? 0
      }
      return row
    })
  }, [dashboard.por_mes, dashboard.por_empresa_mes, topEmpresas])

  const haySerieMensual = chartConsolidado.some((m) => m.planificado > 0 || m.ejecutado > 0)

  const opcionesCuenta = useMemo(() => {
    const cuentasOpts = [...new Set(cuentas.map((c) => c.cuenta).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
    return {
      cuenta: cuentasOpts,
      estado: ['Sobre presupuesto', 'Controlado'],
    }
  }, [cuentas])

  const cuentasFiltradas = useMemo(() => {
    return cuentas.filter((c) => {
      const cuentaF = filtrosCuenta.cuenta
      const nombreF = filtrosCuenta.cuenta_nombre?.trim().toLowerCase()
      const estadoF = filtrosCuenta.estado
      if (cuentaF && cuentaF !== 'todos' && c.cuenta !== cuentaF) return false
      if (nombreF && !c.cuenta_nombre.toLowerCase().includes(nombreF)) return false
      if (estadoF === 'Sobre presupuesto' && c.variacion <= 0) return false
      if (estadoF === 'Controlado' && c.variacion > 0) return false
      return true
    })
  }, [cuentas, filtrosCuenta])

  const hayFiltrosCuenta = Object.values(filtrosCuenta).some((v) => v && v !== 'todos')

  const setFiltroCuenta = useCallback((columna: string, valor: string) => {
    setFiltrosCuenta((prev) => ({ ...prev, [columna]: valor }))
  }, [])

  const toggleCuenta = useCallback(
    async (c: BudgetItSapDashboardCuenta) => {
      const key = `${c.empresa}|${c.cuenta}`
      if (expanded === key) {
        setExpanded(null)
        return
      }
      setExpanded(key)
      setDetalleErr(null)
      if (detalleCache[key]) return
      setDetalleLoading(key)
      try {
        const res = await fetchGastosPorCuenta({
          anio,
          mes: mes ?? undefined,
          empresa: c.empresa,
          cuenta: c.cuenta,
        })
        setDetalleCache((prev) => ({ ...prev, [key]: res.gastos }))
      } catch (e) {
        setDetalleErr(e instanceof Error ? e.message : 'Error cargando gastos de la cuenta')
      } finally {
        setDetalleLoading(null)
      }
    },
    [anio, mes, expanded, detalleCache],
  )

  if (requiereEmpresa) {
    return (
      <div className="space-y-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Seleccione una empresa</strong> para ver el presupuesto. No existe presupuesto global:
          cada empresa tiene su propia moneda y no se pueden sumar montos entre empresas.
        </div>
        {resumenEmpresas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Empresas disponibles (seleccione una arriba)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead className="text-right">Planificado*</TableHead>
                    <TableHead className="text-right">Ejecutado*</TableHead>
                    <TableHead className="text-right">Exceso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumenEmpresas.map((e) => {
                    const sobre = e.variacion > 0
                    return (
                      <TableRow
                        key={e.empresa}
                        className={sobre ? 'bg-red-50/80' : undefined}
                      >
                        <TableCell className={`font-medium ${sobre ? 'text-red-900' : ''}`}>
                          {e.empresa}
                        </TableCell>
                        <TableCell>
                          <span className="rounded bg-[var(--gray-lt)] px-2 py-0.5 text-xs font-medium">
                            {e.moneda}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(e.planificado, e.moneda)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-semibold ${sobre ? 'text-red-700' : ''}`}
                        >
                          {formatMoney(e.ejecutado, e.moneda)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-semibold ${sobre ? 'text-red-700' : 'text-[var(--text-muted)]'}`}
                        >
                          {sobre ? `+${formatMoney(e.variacion, e.moneda)}` : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                * Montos en la moneda de cada empresa; no sumar entre filas.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!tieneComparacion && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No se detectaron columnas <strong>Planificado</strong> y <strong>Ejecutado</strong> en la vista SAP.
          Revise los nombres en <code className="text-xs">TS_VW_BUDGET_IT</code>.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={`Planificado (${moneda})`}
          value={resumen.total_planificado != null ? formatMoney(resumen.total_planificado, moneda) : '—'}
          sub={periodoLabel}
        />
        <KpiCard
          title={`Ejecutado (${moneda})`}
          value={resumen.total_ejecutado != null ? formatMoney(resumen.total_ejecutado, moneda) : '—'}
          sub={
            resumen.ejecucion_pct != null
              ? `Ejecución: ${resumen.ejecucion_pct.toFixed(1)}%`
              : undefined
          }
          alert={sobrePresupuesto}
        />
        <KpiCard
          title="Variación"
          value={resumen.variacion != null ? formatMoney(resumen.variacion, moneda) : '—'}
          trend={sobrePresupuesto ? 'up' : resumen.variacion != null && resumen.variacion < 0 ? 'down' : null}
          alert={sobrePresupuesto}
        />
        <KpiCard
          title="Cuentas"
          value={String(cuentas.length)}
          sub={`${resumen.filas_sobre_presupuesto} sobre presupuesto`}
          alert={resumen.filas_sobre_presupuesto > 0}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              Detalle por cuenta — {empresa} ({moneda})
            </CardTitle>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Expanda una cuenta para ver los gastos. Use los filtros en los encabezados.
              En rojo: lo que se pasa del presupuesto.
            </p>
          </div>
          {hayFiltrosCuenta ? (
            <Button variant="ghost" size="sm" onClick={() => setFiltrosCuenta({})}>
              <X className="mr-1 size-3.5" />
              Limpiar filtros
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {cuentas.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--text-muted)]">
              Sin cuentas para los filtros seleccionados.
            </p>
          ) : (
            <Table>
              <GastosDetalleTablaHeader
                columnas={COLUMNAS_CUENTA}
                filtros={filtrosCuenta}
                opciones={opcionesCuenta}
                onFiltroChange={setFiltroCuenta}
              />
              <TableBody>
                {cuentasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-[var(--text-muted)]">
                      Sin cuentas para los filtros de columna.
                    </TableCell>
                  </TableRow>
                ) : (
                cuentasFiltradas.map((c) => {
                  const key = `${c.empresa}|${c.cuenta}`
                  const isOpen = expanded === key
                  const sobre = c.variacion > 0
                  const gastos = detalleCache[key]
                  const gastosMarcados = gastos
                    ? marcarGastosSobrePlan(gastos, c.planificado)
                    : []
                  return (
                    <Fragment key={key}>
                      <TableRow
                        className={`cursor-pointer ${sobre ? 'bg-red-50 hover:bg-red-100/80' : 'hover:bg-[var(--gray-lt)]'}`}
                        onClick={() => void toggleCuenta(c)}
                      >
                        <TableCell className="w-8">
                          {detalleLoading === key ? (
                            <Loader2 className="size-4 animate-spin text-[var(--text-muted)]" />
                          ) : isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </TableCell>
                        <TableCell className={`font-mono text-sm font-medium ${sobre ? 'text-red-900' : ''}`}>
                          {c.cuenta}
                        </TableCell>
                        <TableCell className={`max-w-[220px] truncate text-sm ${sobre ? 'text-red-900' : ''}`}>
                          {c.cuenta_nombre}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(c.planificado, c.moneda)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-semibold ${sobre ? 'text-red-700' : ''}`}
                        >
                          {formatMoney(c.ejecutado, c.moneda)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-semibold ${sobre ? 'text-red-700' : 'text-green-700'}`}
                        >
                          {c.variacion > 0 ? '+' : ''}
                          {formatMoney(c.variacion, c.moneda)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${sobre || (c.ejecucion_pct != null && c.ejecucion_pct > 100) ? 'text-red-700' : ''}`}
                        >
                          {c.ejecucion_pct != null ? `${c.ejecucion_pct.toFixed(1)}%` : '—'}
                        </TableCell>
                        <TableCell>
                          <SemaforoEjecucion pct={c.ejecucion_pct} variacion={c.variacion} />
                        </TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-[var(--gray-lt)]/60">
                          <TableCell colSpan={8} className="p-0">
                            <div className="border-t border-[var(--border)] px-4 py-3">
                              <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
                                Gastos de la cuenta {c.cuenta}
                                {c.planificado > 0
                                  ? ` · planificado ${formatMoney(c.planificado, c.moneda)}`
                                  : ''}
                                {detalleLoading === key ? ' — cargando…' : ''}
                              </p>
                              {detalleErr && expanded === key && (
                                <p className="mb-2 text-sm text-red-700">{detalleErr}</p>
                              )}
                              {!gastos?.length && detalleLoading !== key ? (
                                <p className="text-sm text-[var(--text-muted)]">
                                  Sin gastos registrados en la vista de costos IT para esta cuenta/periodo.
                                </p>
                              ) : gastosMarcados.length ? (
                                <div className="max-h-72 overflow-auto rounded-md border border-[var(--border)] bg-white">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Nº Cuenta</TableHead>
                                        <TableHead>Proveedor</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Documento</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                        <TableHead className="text-right">Acumulado</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {gastosMarcados.map((g, i) => (
                                        <TableRow
                                          key={i}
                                          className={g.pasa_presupuesto ? 'bg-red-50' : undefined}
                                        >
                                          <TableCell
                                            className={`whitespace-nowrap text-sm ${g.pasa_presupuesto ? 'text-red-900' : ''}`}
                                          >
                                            {g.fecha ? formatDateDMY(g.fecha) : '—'}
                                          </TableCell>
                                          <TableCell
                                            className={`font-mono text-xs whitespace-nowrap ${g.pasa_presupuesto ? 'text-red-800' : ''}`}
                                            title={g.cuenta_nombre || g.cuenta}
                                          >
                                            {g.cuenta || '—'}
                                          </TableCell>
                                          <TableCell
                                            className={`max-w-[140px] truncate text-sm ${g.pasa_presupuesto ? 'text-red-900' : ''}`}
                                          >
                                            {g.proveedor || '—'}
                                          </TableCell>
                                          <TableCell
                                            className={`max-w-[260px] truncate text-sm ${g.pasa_presupuesto ? 'text-red-900' : ''}`}
                                          >
                                            {g.descripcion || '—'}
                                          </TableCell>
                                          <TableCell
                                            className={`font-mono text-xs ${g.pasa_presupuesto ? 'text-red-800' : ''}`}
                                          >
                                            {g.documento || '—'}
                                          </TableCell>
                                          <TableCell
                                            className={`text-right tabular-nums text-sm font-medium ${g.pasa_presupuesto ? 'text-red-700' : ''}`}
                                          >
                                            {formatMoney(g.monto, g.moneda)}
                                          </TableCell>
                                          <TableCell
                                            className={`text-right tabular-nums text-sm font-semibold ${g.pasa_presupuesto ? 'text-red-700' : 'text-[var(--text-muted)]'}`}
                                          >
                                            {formatMoney(g.acumulado, g.moneda)}
                                            {g.pasa_presupuesto ? ' ⚠' : ''}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                      <TableRow
                                        className={`font-semibold ${sobre ? 'bg-red-100 text-red-800' : 'bg-[var(--gray-lt)]'}`}
                                      >
                                        <TableCell colSpan={5}>
                                          Total gastos cuenta
                                          {sobre
                                            ? ` · exceso ${formatMoney(c.variacion, c.moneda)}`
                                            : ''}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                          {formatMoney(
                                            gastosMarcados.reduce((s, g) => s + g.monto, 0),
                                            c.moneda,
                                          )}
                                        </TableCell>
                                        <TableCell />
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
                })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {haySerieMensual && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Evolución mensual — planificado vs ejecutado ({moneda})
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartConsolidado} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatMoney(Number(v), moneda)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="planificado"
                  name="Planificado"
                  stroke={CONSOL_PLAN}
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="ejecutado"
                  name={sobrePresupuesto ? 'Ejecutado (sobre presupuesto)' : 'Ejecutado'}
                  stroke={sobrePresupuesto ? CONSOL_EJEC_SOBRE : CONSOL_EJEC}
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload, index } = props as {
                      cx?: number
                      cy?: number
                      payload?: { sobre?: boolean }
                      index?: number
                    }
                    if (cx == null || cy == null) return <g key={index} />
                    const rojo = Boolean(payload?.sobre)
                    return (
                      <circle
                        key={index}
                        cx={cx}
                        cy={cy}
                        r={rojo ? 5 : 4}
                        fill={rojo ? CONSOL_EJEC_SOBRE : sobrePresupuesto ? CONSOL_EJEC_SOBRE : CONSOL_EJEC}
                        stroke={rojo ? '#7f0000' : 'none'}
                        strokeWidth={rojo ? 1.5 : 0}
                      />
                    )
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {topEmpresas.length > 1 && haySerieMensual && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ejecutado por empresa (líneas)</CardTitle>
            <p className="text-xs text-[var(--text-muted)]">
              Cada empresa puede tener moneda distinta; use el filtro de empresa para totales correctos.
            </p>
          </CardHeader>
          <CardContent className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPorEmpresa} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} width={52} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {topEmpresas.map(({ empresa: emp, key, moneda: mon }, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={`${emp.length > 18 ? `${emp.slice(0, 16)}…` : emp} (${mon})`}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/**
 * Dashboard de Análisis Financiero CAPEX / OPEX
 * Lee únicamente la hoja Query1 — sin modificar el Excel.
 *
 * Secciones:
 *  0. Columnas detectadas (diagnóstico)
 *  1. KPI cards  — totales, variación YoY, mix
 *  2. Comparativa anual — CAPEX vs OPEX por año
 *  3. Tendencia mensual — OPEX mes a mes por año (si hay columna Mes/Fecha)
 *  4. Ahorro OPEX YoY — barras de ahorro por categoría + waterfall
 *  5. Categorías — barras apiladas (filtro por año)
 *  6. Donut composición
 *  7. Tabla pivot  Categoría × Año
 *  8. Formulas de referencia
 *  9. Tabla detalle con filtros
 */
import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { TrendingDown, TrendingUp, Info } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { usePagination } from '@/hooks/usePagination'
import { formatLps } from '@/lib/format'
import type {
  AhorroAnual, GastosFinancieroPayload, ResumenDimension,
} from '@/types/gastos'

// ─── Paleta ───────────────────────────────────────────────────────────────────

const C_CAPEX  = '#002060'
const C_OPEX   = '#70AD47'
const C_AHORRO = '#0F6E56'
const C_PERDIDA= '#C00000'

const YEAR_COLORS = ['#002060','#1F4E79','#2E75B6','#9DC3E6','#BDD7EE','#DDEBF7']

function yearColor(i: number) { return YEAR_COLORS[i % YEAR_COLORS.length]! }

const CAT_COLORS = [
  '#1F4E79','#C00000','#375623','#7F6000','#4527A0','#0F6E56','#BF5700','#00695C',
]
function catColor(i: number) { return CAT_COLORS[i % CAT_COLORS.length]! }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctStr(part: number, total: number, dec = 1) {
  if (!total) return '0 %'
  return `${(Math.round((part / total) * Math.pow(10, dec + 2)) / Math.pow(10, dec)).toFixed(dec)} %`
}

function signPct(n: number, dec = 1): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(dec)} %`
}

// Tooltip compartido
function FmtTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; fill?: string; color?: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-white p-3 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.fill ?? p.color }}>{p.name}</span>
          <span className="tabular-nums font-medium">{formatLps(p.value)}</span>
        </p>
      ))}
      {payload.length > 1 && (
        <p className="mt-1 flex justify-between gap-4 border-t border-border pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatLps(payload.reduce((s, p) => s + (p.value || 0), 0))}</span>
        </p>
      )}
    </div>
  )
}

// ─── Sección: Ahorro anual ────────────────────────────────────────────────────

function SeccionAhorro({ ahorros }: { ahorros: AhorroAnual[] }) {
  const [idx, setIdx] = useState(ahorros.length - 1)
  const sel = ahorros[idx]
  if (!sel) return null

  const catData = sel.porCategoria
    .filter((c) => c.opexRef > 0 || c.opexActual > 0)
    .sort((a, b) => Math.abs(b.ahorro) - Math.abs(a.ahorro))

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Ahorro / Incremento OPEX por año</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fórmula: Ahorro = OPEX {sel.anoRef} − OPEX {sel.anoActual} · % = Ahorro ÷ OPEX {sel.anoRef} × 100
            </p>
          </div>
          <div className="flex gap-1">
            {ahorros.map((a, i) => (
              <Button
                key={`${a.anoRef}-${a.anoActual}`}
                type="button" size="sm"
                variant={i === idx ? 'default' : 'outline'}
                className={i === idx
                  ? 'h-7 text-xs px-3 bg-[var(--navy)] text-white'
                  : 'h-7 text-xs px-3'}
                onClick={() => setIdx(i)}
              >
                {a.anoRef} → {a.anoActual}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen global */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: `OPEX base (${sel.anoRef})`, val: sel.opexRef, color: C_CAPEX },
            { label: `OPEX actual (${sel.anoActual})`, val: sel.opexActual, color: '#7F6000' },
            {
              label: sel.ahorro >= 0 ? 'Ahorro logrado' : 'Incremento',
              val: Math.abs(sel.ahorro),
              color: sel.ahorro >= 0 ? C_AHORRO : C_PERDIDA,
              badge: `${signPct(sel.pctAhorro)} vs ${sel.anoRef}`,
            },
          ].map(({ label, val, color, badge }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color }}>
                {formatLps(val)}
              </p>
              {badge && (
                <p className={`mt-0.5 text-xs font-medium ${sel.ahorro >= 0 ? 'text-[var(--lime)]' : 'text-destructive'}`}>
                  {badge}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Barras por categoría */}
        <div
          className="w-full"
          style={{ height: `${Math.max(260, Math.min(catData.length * 44 + 60, 540))}px` }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={catData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
              <XAxis type="number" tickFormatter={(v) => formatLps(Number(v))} tick={{ fontSize: 9 }} />
              <YAxis type="category" dataKey="categoria" width={160} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v, n) => [formatLps(Number(v ?? 0)), String(n)]}
                labelFormatter={(l) => String(l)}
              />
              <Legend />
              <ReferenceLine x={0} stroke="#666" />
              <Bar dataKey="opexRef"    name={`OPEX ${sel.anoRef}`}    fill={C_CAPEX} radius={[0,0,0,0]} />
              <Bar dataKey="opexActual" name={`OPEX ${sel.anoActual}`} fill="#2E75B6" radius={[0,0,0,0]} />
              <Bar dataKey="ahorro"     name="Ahorro neto"
                radius={[0,4,4,0]}
              >
                {catData.map((d) => (
                  <Cell key={d.categoria} fill={d.ahorro >= 0 ? C_AHORRO : C_PERDIDA} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla comparativa */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">OPEX {sel.anoRef}</TableHead>
                <TableHead className="text-right">OPEX {sel.anoActual}</TableHead>
                <TableHead className="text-right">Ahorro</TableHead>
                <TableHead className="text-right">% Variación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catData.map((c) => (
                <TableRow key={c.categoria}>
                  <TableCell className="font-medium">{c.categoria}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatLps(c.opexRef)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatLps(c.opexActual)}</TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${c.ahorro >= 0 ? 'text-[var(--lime)]' : 'text-destructive'}`}>
                    {c.ahorro >= 0 ? '' : '-'}{formatLps(Math.abs(c.ahorro))}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${c.pctAhorro >= 0 ? 'text-[var(--lime)]' : 'text-destructive'}`}>
                    {signPct(c.pctAhorro)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableBody>
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{formatLps(sel.opexRef)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatLps(sel.opexActual)}</TableCell>
                <TableCell className={`text-right tabular-nums ${sel.ahorro >= 0 ? 'text-[var(--lime)]' : 'text-destructive'}`}>
                  {sel.ahorro >= 0 ? '' : '-'}{formatLps(Math.abs(sel.ahorro))}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${sel.pctAhorro >= 0 ? 'text-[var(--lime)]' : 'text-destructive'}`}>
                  {signPct(sel.pctAhorro)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GastosFinancieroPanel({ data }: { data: GastosFinancieroPayload }) {
  const [anoFiltro, setAnoFiltro]   = useState<string>('Todos')
  const [catFiltro, setCatFiltro]   = useState<string>('Todas')
  const [tipoFiltro, setTipoFiltro] = useState<'Todos' | 'CAPEX' | 'OPEX'>('Todos')

  const total    = data.totalCapex + data.totalOpex
  const pctCapex = total > 0 ? Math.round((data.totalCapex / total) * 1000) / 10 : 0
  const pctOpex  = 100 - pctCapex

  // Última variación YoY global
  const ultimaVar = data.ahorroAnual.at(-1)

  // ── Gráfica anual ──────────────────────────────────────────────────────────
  const chartAnos = useMemo(() =>
    data.porAno.map((r) => ({ ano: r.clave, CAPEX: r.capex, OPEX: r.opex })),
  [data.porAno])

  // ── Gráfica categorías (filtrada por año) ──────────────────────────────────
  const chartCats: ResumenDimension[] = useMemo(() => {
    if (anoFiltro === 'Todos') return data.porCategoria.slice(0, 14)
    const m = new Map<string, { capex: number; opex: number }>()
    for (const x of data.matriz) {
      if (x.ano !== anoFiltro) continue
      if (!m.has(x.categoria)) m.set(x.categoria, { capex: 0, opex: 0 })
      const e = m.get(x.categoria)!
      e.capex += x.capex; e.opex += x.opex
    }
    return [...m.entries()]
      .map(([clave, { capex, opex }]) => ({ clave, capex, opex, total: capex + opex }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 14)
  }, [anoFiltro, data.porCategoria, data.matriz])

  // ── Tendencia mensual OPEX ────────────────────────────────────────────────
  const chartMensual = useMemo(() => {
    if (!data.tieneMes || !data.mensual.length) return []
    return data.mensual.map((d) => {
      const row: Record<string, string | number> = { mes: d.mesNombre }
      for (const a of d.porAno) row[a.ano] = a.opex
      return row
    })
  }, [data.tieneMes, data.mensual])

  // ── Donut ──────────────────────────────────────────────────────────────────
  const donutData = useMemo(() => [
    { name: 'CAPEX', value: data.totalCapex },
    { name: 'OPEX',  value: data.totalOpex  },
  ], [data.totalCapex, data.totalOpex])

  // ── Pivot ─────────────────────────────────────────────────────────────────
  const pivotRows = useMemo(() =>
    data.categorias.map((cat) => {
      const byCat = data.matriz.filter((x) => x.categoria === cat)
      const porAno: Record<string, number> = {}
      let gTotal = 0, gCapex = 0, gOpex = 0
      for (const r of byCat) {
        porAno[r.ano] = (porAno[r.ano] ?? 0) + r.total
        gTotal += r.total; gCapex += r.capex; gOpex += r.opex
      }
      return { categoria: cat, porAno, gTotal, gCapex, gOpex }
    }),
  [data.categorias, data.matriz])

  // ── Detalle filtrado ───────────────────────────────────────────────────────
  const filasFiltradas = useMemo(() =>
    data.filas.filter((f) => {
      if (anoFiltro !== 'Todos' && String(f.ano ?? 'Sin año') !== anoFiltro) return false
      if (catFiltro !== 'Todas' && f.categoria !== catFiltro) return false
      if (tipoFiltro !== 'Todos' && f.tipo !== tipoFiltro) return false
      return true
    }),
  [data.filas, anoFiltro, catFiltro, tipoFiltro])

  const paginationDetalle = usePagination(filasFiltradas.length, {
    resetKey: `${anoFiltro}|${catFiltro}|${tipoFiltro}|${filasFiltradas.length}`,
  })
  const pageFilasDetalle = paginationDetalle.slice(filasFiltradas)

  const tieneDatos = total > 0 || data.filas.length > 0

  // ── Sin datos ──────────────────────────────────────────────────────────────
  if (!data.archivoExiste) {
    return (
      <p className="text-sm text-muted-foreground">
        Coloca tu archivo <code className="rounded bg-muted px-1">data/gastos.xlsx</code> y sincroniza.
      </p>
    )
  }

  if (!tieneDatos) {
    return (
      <div className="space-y-4">
        {data.advertencia && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {data.advertencia}
          </div>
        )}
        <ColsDetectadas data={data} />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* 0. Diagnóstico columnas + advertencias */}
      {data.advertencia && (
        <div className="rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {data.advertencia}
        </div>
      )}
      <ColsDetectadas data={data} />

      {/* 1. KPI cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Presupuesto total"   value={formatLps(total)}
          sub={`${data.filas.length} partidas · ${data.anos.join(' / ')}`} />
        <KpiCard label="CAPEX (inversión)"   value={formatLps(data.totalCapex)}
          color={C_CAPEX} sub={pctStr(data.totalCapex, total) + ' del total'}
          badge={ultimaVar && (
            <VariBadge val={ultimaVar.ahorro} label={`vs ${ultimaVar.anoRef}`} invert />
          )} />
        <KpiCard label="OPEX (operación)"    value={formatLps(data.totalOpex)}
          color={C_OPEX}  sub={pctStr(data.totalOpex, total) + ' del total'}
          badge={ultimaVar && (
            <VariBadge val={ultimaVar.ahorro} label={`Ahorro OPEX ${ultimaVar.anoRef}→${ultimaVar.anoActual}`} />
          )} />
        <KpiCard label="Mix CAPEX / OPEX"    value={`${pctCapex} % / ${pctOpex} %`}
          sub={ultimaVar
            ? `Reducción OPEX: ${signPct(ultimaVar.pctAhorro)} (${ultimaVar.anoRef}→${ultimaVar.anoActual})`
            : 'Sin comparativa interanual'} />
      </section>

      {/* Selector de año para gráficas 3/5 */}
      {data.anos.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtrar por año:</span>
          {['Todos', ...data.anos].map((a) => (
            <Button key={a} type="button" size="sm"
              variant={anoFiltro === a ? 'default' : 'outline'}
              className={anoFiltro === a
                ? 'h-7 text-xs px-3 bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90'
                : 'h-7 text-xs px-3'}
              onClick={() => setAnoFiltro(a)}>{a}</Button>
          ))}
        </div>
      )}

      {/* 2. CAPEX vs OPEX por año */}
      {chartAnos.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Comparativa anual — CAPEX vs OPEX</CardTitle>
            <p className="text-sm text-muted-foreground">Evolución del presupuesto IT por tipo de gasto</p>
          </CardHeader>
          <CardContent className="h-[min(320px,42vh)] min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartAnos} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatLps(Number(v))} width={90} tick={{ fontSize: 10 }} />
                <Tooltip content={<FmtTooltip />} />
                <Legend />
                <Bar dataKey="CAPEX" fill={C_CAPEX} radius={[4,4,0,0]} name="CAPEX" />
                <Bar dataKey="OPEX"  fill={C_OPEX}  radius={[4,4,0,0]} name="OPEX" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 3. Tendencia OPEX mensual */}
      {data.tieneMes && chartMensual.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Tendencia mensual OPEX por año</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comparación mes a mes entre años — útil para detectar estacionalidad y ahorro acumulado
            </p>
          </CardHeader>
          <CardContent className="h-[min(340px,44vh)] min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMensual} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatLps(Number(v))} width={90} tick={{ fontSize: 10 }} />
                <Tooltip content={<FmtTooltip />} />
                <Legend />
                {data.anos.map((ano, i) => (
                  <Line
                    key={ano}
                    type="monotone"
                    dataKey={ano}
                    name={`OPEX ${ano}`}
                    stroke={yearColor(i)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 4. Ahorro YoY */}
      {data.ahorroAnual.length > 0 && (
        <SeccionAhorro ahorros={data.ahorroAnual} />
      )}

      {/* 5 + 6. Categorías + Donut */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Por categoría{anoFiltro !== 'Todos' ? ` — ${anoFiltro}` : ' (todos los años)'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">Apilado CAPEX + OPEX · orden por total</p>
          </CardHeader>
          <CardContent
            style={{ height: `${Math.max(280, Math.min(chartCats.length * 40 + 60, 580))}px` }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCats} layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => formatLps(Number(v))} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="clave" width={162} tick={{ fontSize: 10 }} />
                <Tooltip content={<FmtTooltip />} />
                <Legend />
                <Bar dataKey="capex" stackId="s" fill={C_CAPEX} name="CAPEX" />
                <Bar dataKey="opex"  stackId="s" fill={C_OPEX}  name="OPEX" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Composición CAPEX / OPEX</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-2">
            <div className="h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={50} outerRadius={84} paddingAngle={3}>
                    {donutData.map((d) => (
                      <Cell key={d.name} fill={d.name === 'CAPEX' ? C_CAPEX : C_OPEX} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatLps(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 w-full space-y-2 text-sm">
              {[
                { label: 'CAPEX', val: data.totalCapex, pct: pctCapex, color: C_CAPEX },
                { label: 'OPEX',  val: data.totalOpex,  pct: pctOpex,  color: C_OPEX  },
              ].map(({ label, val, pct, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm" style={{ background: color }} />
                    <span className="text-muted-foreground">{label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium tabular-nums">{pct} %</span>
                    <span className="ml-2 text-xs text-muted-foreground">{formatLps(val)}</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span><span className="tabular-nums">{formatLps(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 7. Tabla pivot */}
      {data.anos.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Pivot — Categoría × Año</CardTitle>
            <p className="text-sm text-muted-foreground">
              Total (CAPEX + OPEX) por celda · columnas CAPEX y OPEX al final de cada categoría
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card min-w-[180px]">Categoría</TableHead>
                    {data.anos.map((a) => (
                      <TableHead key={a} className="whitespace-nowrap text-right">{a}</TableHead>
                    ))}
                    <TableHead className="text-right font-semibold">Total</TableHead>
                    <TableHead className="text-right" style={{ color: C_CAPEX }}>CAPEX</TableHead>
                    <TableHead className="text-right" style={{ color: C_OPEX }}>OPEX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivotRows.map((row, i) => (
                    <TableRow key={row.categoria}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium"
                        style={{ borderLeft: `3px solid ${catColor(i)}` }}>
                        {row.categoria}
                      </TableCell>
                      {data.anos.map((a) => (
                        <TableCell key={a} className="text-right tabular-nums text-sm">
                          {row.porAno[a] ? formatLps(row.porAno[a]!) : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums font-semibold">{formatLps(row.gTotal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs" style={{ color: C_CAPEX }}>{formatLps(row.gCapex)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs" style={{ color: C_OPEX }}>{formatLps(row.gOpex)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableBody>
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell className="sticky left-0 z-10 bg-muted/40">Total</TableCell>
                    {data.anos.map((a) => {
                      const tot = pivotRows.reduce((s, r) => s + (r.porAno[a] ?? 0), 0)
                      return <TableCell key={a} className="text-right tabular-nums">{formatLps(tot)}</TableCell>
                    })}
                    <TableCell className="text-right tabular-nums">{formatLps(total)}</TableCell>
                    <TableCell className="text-right tabular-nums" style={{ color: C_CAPEX }}>{formatLps(data.totalCapex)}</TableCell>
                    <TableCell className="text-right tabular-nums" style={{ color: C_OPEX }}>{formatLps(data.totalOpex)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 8. Formulas de referencia */}
      <Card className="border-[var(--navy)]/20 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-[var(--navy)]" />
            Fórmulas de referencia
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cálculos que usa este dashboard — úsalos también en tu Excel / Power BI
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                titulo: 'Ahorro OPEX',
                formula: 'Ahorro = OPEX_año_base − OPEX_año_actual',
                ejemplo: ultimaVar
                  ? `${formatLps(ultimaVar.opexRef)} − ${formatLps(ultimaVar.opexActual)} = ${formatLps(ultimaVar.ahorro)}`
                  : 'Requiere ≥ 2 años con datos',
              },
              {
                titulo: '% Reducción OPEX',
                formula: '% = Ahorro ÷ OPEX_año_base × 100',
                ejemplo: ultimaVar
                  ? `${signPct(ultimaVar.pctAhorro)} vs ${ultimaVar.anoRef}`
                  : 'Requiere ≥ 2 años con datos',
              },
              {
                titulo: 'Mix CAPEX / OPEX',
                formula: '% CAPEX = CAPEX_total ÷ (CAPEX + OPEX) × 100',
                ejemplo: `${formatLps(data.totalCapex)} ÷ ${formatLps(total)} = ${pctCapex} %`,
              },
              {
                titulo: 'Ahorro acumulado mensual',
                formula: 'Por mes: OPEX_mes_año_base − OPEX_mes_año_actual',
                ejemplo: data.tieneMes
                  ? 'Ver gráfica "Tendencia mensual" arriba'
                  : 'Agrega columna "Mes" (1-12) a Query1 para activarlo',
              },
            ].map(({ titulo, formula, ejemplo }) => (
              <div key={titulo} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold text-[var(--navy)]">{titulo}</p>
                <code className="mt-1 block text-xs text-muted-foreground">{formula}</code>
                <p className="mt-1.5 text-xs font-medium text-foreground">{ejemplo}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 9. Tabla detalle */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Detalle de partidas</CardTitle>
              <p className="text-sm text-muted-foreground">{filasFiltradas.length} registros</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['Todos','CAPEX','OPEX'] as const).map((t) => (
                <Button key={t} type="button" size="sm"
                  variant={tipoFiltro === t ? 'default' : 'outline'}
                  className={tipoFiltro === t
                    ? t === 'CAPEX' ? 'h-7 text-xs px-3 bg-[#002060] text-white'
                      : t === 'OPEX' ? 'h-7 text-xs px-3 bg-[#70AD47] text-[#002060]'
                      : 'h-7 text-xs px-3'
                    : 'h-7 text-xs px-3'}
                  onClick={() => setTipoFiltro(t)}>{t}</Button>
              ))}
              <select
                className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}
              >
                <option value="Todas">Todas las categorías</option>
                {data.categorias.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.anos.length > 0 && <TableHead className="w-[60px]">Año</TableHead>}
                  {data.tieneMes && <TableHead className="w-[56px]">Mes</TableHead>}
                  <TableHead>Categoría</TableHead>
                  <TableHead className="w-[76px]">Tipo</TableHead>
                  {data.columnasDetectadas.descripcion && <TableHead>Descripción</TableHead>}
                  <TableHead className="w-[140px] text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageFilasDetalle.map((f, i) => (
                  <TableRow key={i}>
                    {data.anos.length > 0 && (
                      <TableCell className="tabular-nums text-muted-foreground">{f.ano ?? '—'}</TableCell>
                    )}
                    {data.tieneMes && (
                      <TableCell className="tabular-nums text-muted-foreground">
                        {f.mes != null ? ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][f.mes-1] : '—'}
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{f.categoria}</TableCell>
                    <TableCell>
                      <Badge className="text-[10px] font-semibold" style={{
                        backgroundColor: f.tipo === 'CAPEX' ? C_CAPEX : C_OPEX,
                        color: f.tipo === 'CAPEX' ? '#fff' : '#002060',
                      }}>{f.tipo}</Badge>
                    </TableCell>
                    {data.columnasDetectadas.descripcion && (
                      <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                        {f.descripcion || '—'}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">{formatLps(f.monto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={paginationDetalle.page}
            totalPages={paginationDetalle.totalPages}
            pageSize={paginationDetalle.pageSize}
            totalItems={paginationDetalle.totalItems}
            fromItem={paginationDetalle.fromItem}
            toItem={paginationDetalle.toItem}
            onPageChange={paginationDetalle.setPage}
            onPageSizeChange={paginationDetalle.setPageSize}
          />
          </>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Mini-componentes ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, badge }: {
  label: string; value: string; sub?: string
  color?: string; badge?: React.ReactNode
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums" style={{ color: color ?? 'var(--navy)' }}>
          {value}
        </p>
        {badge}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function VariBadge({ val, label, invert }: { val: number; label: string; invert?: boolean }) {
  const positive = invert ? val < 0 : val >= 0
  return (
    <p className={`flex items-center gap-1 text-xs font-medium ${positive ? 'text-[var(--lime)]' : 'text-destructive'}`}>
      {positive
        ? <TrendingDown className="h-3 w-3" />
        : <TrendingUp   className="h-3 w-3" />}
      {signPct(val / 1)}
      <span className="font-normal text-muted-foreground">{label}</span>
    </p>
  )
}

function ColsDetectadas({ data }: { data: GastosFinancieroPayload }) {
  const cols = data.columnasDetectadas
  const detectadas = [
    cols.ano  && `Año → "${cols.ano}"`,
    cols.mes  && `Mes → "${cols.mes}"`,
    `Categoría → "${cols.categoria}"`,
    `Tipo → "${cols.tipo}"`,
    cols.descripcion && `Descripción → "${cols.descripcion}"`,
    `Monto → "${cols.monto}"`,
  ].filter(Boolean)

  if (!data.hoja) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Hoja: {data.hoja}</span>
      {detectadas.map((d) => (
        <span key={String(d)} className="rounded bg-muted px-1.5 py-0.5">{d}</span>
      ))}
      {!data.tieneMes && (
        <span className="italic text-amber-700">
          Sin columna Mes — agrega "Mes" (1-12) o "Fecha" para ver tendencia mensual
        </span>
      )}
    </div>
  )
}

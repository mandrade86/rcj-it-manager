import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Loader2, Save, X } from 'lucide-react'

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
import {
  fetchGastosPresupuestoCuentas,
  fetchGastosPresupuestos,
  saveGastosPresupuestos,
  type GastosItPresupuestoCuenta,
} from '@/lib/api/gastosDashboard'
import {
  fetchBudgetItSap,
  fetchEmpresasMoneda,
  saveEmpresasMoneda,
} from '@/lib/api/costosIt'
import { formatMoney } from '@/lib/format'
import { GastosBudgetSapTab } from '@/pages/gastos-it/GastosBudgetSapTab'
import {
  GastosDetalleTablaHeader,
  type GastosDetalleColumnaDef,
} from '@/pages/gastos-it/GastosDetalleTablaHeader'
import { useAuthStore } from '@/store/authStore'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

type PresupuestoRow = {
  cuenta: string
  cuenta_nombre: string
  monto: string
}

type MonedaRow = { empresa: string; moneda: 'USD' | 'HNL' }

function buildRows(
  cuentas: GastosItPresupuestoCuenta[],
  montos: Map<string, { monto: number; nombre?: string }>,
): PresupuestoRow[] {
  const seen = new Set<string>()
  const rows: PresupuestoRow[] = []

  for (const c of cuentas) {
    seen.add(c.cuenta)
    const saved = montos.get(c.cuenta)
    rows.push({
      cuenta: c.cuenta,
      cuenta_nombre: saved?.nombre || c.nombre || c.cuenta,
      monto: saved != null ? String(saved.monto) : '',
    })
  }

  for (const [cuenta, saved] of montos) {
    if (seen.has(cuenta)) continue
    rows.push({
      cuenta,
      cuenta_nombre: saved.nombre || cuenta,
      monto: String(saved.monto),
    })
  }

  return rows.sort((a, b) => a.cuenta.localeCompare(b.cuenta, 'es'))
}

const COLUMNAS_PRESUPUESTO: GastosDetalleColumnaDef[] = [
  { id: 'cuenta', label: 'Cuenta', filter: 'select' },
  { id: 'cuenta_nombre', label: 'Nombre cuenta', filter: 'text', className: 'min-w-[220px]' },
  { id: 'monto', label: 'Presupuesto', align: 'right', className: 'w-[180px]' },
]

export function GastosPresupuestoPage() {
  const now = new Date()
  const hasPermiso = useAuthStore((s) => s.hasPermiso)
  const canEdit = hasPermiso('it:gastos:config') || hasPermiso('*')

  const [anio, setAnio] = useState(now.getFullYear())
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [empresa, setEmpresa] = useState('')
  const [empresas, setEmpresas] = useState<string[]>([])
  const [moneda, setMoneda] = useState<'USD' | 'HNL'>('USD')
  const [rows, setRows] = useState<PresupuestoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [filtrosColumnas, setFiltrosColumnas] = useState<Record<string, string>>({})

  const [monedaRows, setMonedaRows] = useState<MonedaRow[]>([])
  const [nuevaEmpresa, setNuevaEmpresa] = useState('')
  const [savingMonedas, setSavingMonedas] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [budget, monedas] = await Promise.all([
          fetchBudgetItSap({ anio }),
          fetchEmpresasMoneda(),
        ])
        const fromSap = budget.empresas ?? []
        const fromCfg = monedas.items.map((i) => i.empresa)
        const all = [...new Set([...fromSap, ...fromCfg])].sort((a, b) => a.localeCompare(b, 'es'))
        setEmpresas(all)
        setMonedaRows(
          all.map((e) => ({
            empresa: e,
            moneda: (monedas.items.find((i) => i.empresa === e)?.moneda
              ?? budget.monedas_empresa?.[e]
              ?? 'USD') as 'USD' | 'HNL',
          })),
        )
        if (!empresa && all.length === 1) setEmpresa(all[0]!)
      } catch {
        /* empresas se cargan al fallar presupuesto */
      }
    })()
  }, [anio]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!empresa) {
      setRows([])
      setLoading(false)
      setErr(null)
      return
    }
    setLoading(true)
    setErr(null)
    setOkMsg(null)
    try {
      const [{ cuentas }, presupuestoRes] = await Promise.all([
        fetchGastosPresupuestoCuentas(anio),
        fetchGastosPresupuestos(anio, mes, empresa),
      ])
      setMoneda(presupuestoRes.moneda ?? 'USD')
      const montos = new Map<string, { monto: number; nombre?: string }>()
      for (const p of presupuestoRes.presupuestos) {
        if (!p.cuenta) continue
        montos.set(p.cuenta, {
          monto: p.monto ?? p.monto_usd ?? 0,
          nombre: p.cuenta_nombre,
        })
      }
      setRows(buildRows(cuentas, montos))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error cargando presupuestos')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [anio, mes, empresa])

  useEffect(() => {
    void load()
  }, [load])

  const total = useMemo(
    () => rows.reduce((s, r) => s + (Number(r.monto) || 0), 0),
    [rows],
  )

  const cuentasConPresupuesto = useMemo(
    () => rows.filter((r) => Number(r.monto) > 0).length,
    [rows],
  )

  const opcionesColumna = useMemo(() => {
    const cuentasOpts = [...new Set(rows.map((r) => r.cuenta).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
    const nombres = [...new Set(rows.map((r) => r.cuenta_nombre).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'es'),
    )
    return { cuenta: cuentasOpts, cuenta_nombre: nombres }
  }, [rows])

  const rowsFiltradas = useMemo(() => {
    return rows.filter((r) => {
      const cuentaF = filtrosColumnas.cuenta
      const nombreF = filtrosColumnas.cuenta_nombre?.trim().toLowerCase()
      if (cuentaF && cuentaF !== 'todos' && r.cuenta !== cuentaF) return false
      if (nombreF && !r.cuenta_nombre.toLowerCase().includes(nombreF)) return false
      return true
    })
  }, [rows, filtrosColumnas])

  const hayFiltrosColumna = Object.values(filtrosColumnas).some((v) => v && v !== 'todos')

  const setFiltroColumna = useCallback((columna: string, valor: string) => {
    setFiltrosColumnas((prev) => ({ ...prev, [columna]: valor }))
  }, [])

  const limpiarFiltrosColumna = useCallback(() => {
    setFiltrosColumnas({})
  }, [])

  function updateMonto(cuenta: string, value: string) {
    if (!canEdit) return
    setRows((prev) => prev.map((r) => (r.cuenta === cuenta ? { ...r, monto: value } : r)))
  }

  async function handleSave() {
    if (!canEdit || !empresa) return
    setSaving(true)
    setErr(null)
    setOkMsg(null)
    try {
      const items = rows
        .map((r) => ({
          cuenta: r.cuenta,
          cuenta_nombre: r.cuenta_nombre,
          monto: Number(r.monto) || 0,
        }))
        .filter((i) => i.monto > 0)

      await saveGastosPresupuestos({ anio, mes, empresa, items })
      setOkMsg(`Presupuesto de ${MESES[mes - 1]} ${anio} · ${empresa} guardado.`)
      void load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function copiarMesAnterior() {
    if (!canEdit || !empresa) return
    const prevMes = mes === 1 ? 12 : mes - 1
    const prevAnio = mes === 1 ? anio - 1 : anio
    try {
      const [{ cuentas }, { presupuestos }] = await Promise.all([
        fetchGastosPresupuestoCuentas(anio),
        fetchGastosPresupuestos(prevAnio, prevMes, empresa),
      ])
      if (!presupuestos.length) {
        setErr(`No hay presupuesto en ${MESES[prevMes - 1]} ${prevAnio} para ${empresa}.`)
        return
      }
      const montos = new Map<string, { monto: number; nombre?: string }>()
      for (const p of presupuestos) {
        if (!p.cuenta) continue
        montos.set(p.cuenta, { monto: p.monto ?? p.monto_usd ?? 0, nombre: p.cuenta_nombre })
      }
      setRows(buildRows(cuentas, montos))
      setOkMsg(`Valores copiados de ${MESES[prevMes - 1]} ${prevAnio} (${empresa}). Guarde para aplicar.`)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al copiar')
    }
  }

  async function handleSaveMonedas() {
    if (!canEdit) return
    setSavingMonedas(true)
    setErr(null)
    try {
      const saved = await saveEmpresasMoneda(monedaRows)
      setMonedaRows(saved.items)
      setOkMsg('Monedas por empresa guardadas.')
      if (empresa) {
        const m = saved.items.find((i) => i.empresa === empresa)?.moneda
        if (m) setMoneda(m)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar monedas')
    } finally {
      setSavingMonedas(false)
    }
  }

  function addEmpresaMoneda() {
    const e = nuevaEmpresa.trim()
    if (!e) return
    if (monedaRows.some((r) => r.empresa.toLowerCase() === e.toLowerCase())) {
      setErr('Esa empresa ya está en la lista.')
      return
    }
    setMonedaRows((prev) => [...prev, { empresa: e, moneda: 'USD' }].sort((a, b) =>
      a.empresa.localeCompare(b.empresa, 'es'),
    ))
    setEmpresas((prev) => [...new Set([...prev, e])].sort((a, b) => a.localeCompare(b, 'es')))
    setNuevaEmpresa('')
  }

  const anios = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i + 1)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/it/gastos-dashboard"
            className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--navy)]"
          >
            <ArrowLeft className="size-4" />
            Volver al Dashboard de Gastos
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Presupuesto mensual IT</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Presupuesto <strong>por empresa</strong> y cuenta contable. No hay presupuesto global
            (cada empresa usa su moneda).
          </p>
        </div>
      </div>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manual">Presupuesto por cuenta</TabsTrigger>
          <TabsTrigger value="sap">Vista SAP (TS_VW_BUDGET_IT)</TabsTrigger>
          <TabsTrigger value="monedas">Monedas por empresa</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={empresa || '__none__'}
              onValueChange={(v) => setEmpresa(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Empresa (obligatorio)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Seleccione empresa —</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {canEdit && empresa && (
              <>
                <Button variant="outline" onClick={() => void copiarMesAnterior()} disabled={loading}>
                  <Copy className="mr-1 size-4" />
                  Copiar mes anterior
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving || loading}>
                  {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                  Guardar
                </Button>
              </>
            )}
          </div>

          {!empresa && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Seleccione una <strong>empresa</strong> para capturar o consultar presupuesto.
              No existe presupuesto consolidado/global.
            </div>
          )}

          {!canEdit && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Solo lectura. Necesita permiso <code className="text-xs">it:gastos:config</code> para editar presupuestos.
            </div>
          )}

          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
          )}
          {okMsg && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{okMsg}</div>
          )}

          {empresa && (
            <>
              <div className="grid gap-4 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-[var(--text-muted)]">
                      Total presupuesto ({moneda})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">{formatMoney(total, moneda)}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {empresa} · {MESES[mes - 1]} {anio}
                    </p>
                  </CardContent>
                </Card>
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Resumen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span className="rounded-md bg-[var(--gray-lt)] px-2 py-1">
                        Cuentas en catálogo: <strong>{rows.length}</strong>
                      </span>
                      <span className="rounded-md bg-[var(--gray-lt)] px-2 py-1">
                        Con presupuesto: <strong>{cuentasConPresupuesto}</strong>
                      </span>
                      <span className="rounded-md bg-[var(--blue-lt)] px-2 py-1">
                        Moneda: <strong>{moneda}</strong>
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    Detalle por cuenta — {empresa}
                  </CardTitle>
                  {hayFiltrosColumna ? (
                    <Button variant="ghost" size="sm" onClick={limpiarFiltrosColumna}>
                      <X className="mr-1 size-3.5" />
                      Limpiar filtros
                    </Button>
                  ) : null}
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {loading ? (
                    <div className="flex justify-center py-12 text-[var(--text-muted)]">
                      <Loader2 className="mr-2 size-5 animate-spin" /> Cargando…
                    </div>
                  ) : (
                    <Table>
                      <GastosDetalleTablaHeader
                        columnas={COLUMNAS_PRESUPUESTO.map((c) =>
                          c.id === 'monto' ? { ...c, label: `Presupuesto ${moneda}` } : c,
                        )}
                        filtros={filtrosColumnas}
                        opciones={opcionesColumna}
                        onFiltroChange={setFiltroColumna}
                      />
                      <TableBody>
                        {rowsFiltradas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-[var(--text-muted)]">
                              Sin cuentas para los filtros seleccionados.
                            </TableCell>
                          </TableRow>
                        ) : (
                          rowsFiltradas.map((r) => (
                            <TableRow key={r.cuenta}>
                              <TableCell className="font-mono text-sm font-medium">{r.cuenta}</TableCell>
                              <TableCell className="text-sm">{r.cuenta_nombre}</TableCell>
                              <TableCell className="text-right">
                                {canEdit ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={r.monto}
                                    onChange={(e) => updateMonto(r.cuenta, e.target.value)}
                                    className="ml-auto w-[140px] text-right"
                                    placeholder="0.00"
                                  />
                                ) : (
                                  <span>{r.monto ? formatMoney(Number(r.monto), moneda) : '—'}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="sap">
          <GastosBudgetSapTab />
        </TabsContent>

        <TabsContent value="monedas" className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
            Defina la moneda de cada empresa (USD o Lempiras). Los montos de presupuesto y dashboard
            se mostrarán en esa moneda. No se suman empresas con monedas distintas.
          </p>
          {err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
          )}
          {okMsg && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{okMsg}</div>
          )}
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Configuración de moneda</CardTitle>
              {canEdit && (
                <Button onClick={() => void handleSaveMonedas()} disabled={savingMonedas}>
                  {savingMonedas ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
                  Guardar monedas
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Nueva empresa…"
                    value={nuevaEmpresa}
                    onChange={(e) => setNuevaEmpresa(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button variant="outline" onClick={addEmpresaMoneda}>Agregar</Button>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="w-[160px]">Moneda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monedaRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-[var(--text-muted)]">
                        Sin empresas. Agregue empresas o abra la vista SAP para detectarlas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    monedaRows.map((r) => (
                      <TableRow key={r.empresa}>
                        <TableCell className="font-medium">{r.empresa}</TableCell>
                        <TableCell>
                          {canEdit ? (
                            <Select
                              value={r.moneda}
                              onValueChange={(v) =>
                                setMonedaRows((prev) =>
                                  prev.map((x) =>
                                    x.empresa === r.empresa
                                      ? { ...x, moneda: v as 'USD' | 'HNL' }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD ($)</SelectItem>
                                <SelectItem value="HNL">HNL (Lps)</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span>{r.moneda}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

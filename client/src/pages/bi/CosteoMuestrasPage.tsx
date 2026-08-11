import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Cable,
  FlaskConical,
  Loader2,
  RefreshCw,
  Settings2,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  applyCosteoColumnMapping,
  fetchCosteoConfig,
  fetchCosteoDatos,
  fetchCosteoVistaColumnas,
  saveCosteoConfig,
  syncCosteoMuestras,
  testCosteoConnection,
} from '@/lib/api/costeoMuestras'
import { formatDateDMY, formatLps } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import type { CosteoMuestrasPayload, SapBiColumnMapping, SapBiCosteoConfig } from '@/types/costeoMuestras'

const DEFAULT_MAPPING: SapBiColumnMapping = {
  cliente: 'CardName',
  codigo_cliente: 'CardCode',
  muestra: 'RecetaCode',
  descripcion: 'RecetaNombre',
  costo: 'CostoReal',
  cantidad: 'Cantidad',
  fecha: 'Fecha',
  moneda: '',
}

const VISTAS_SAP_CATALOGO = [
  {
    grupo: 'Cliente y producción',
    items: [
      { vista: 'VW_BI_VENTA_COSTO', desc: 'Costo y margen real por cliente — vista principal del dashboard' },
      { vista: 'VW_BI_PRODUCCION', desc: 'Producción y costo real por orden' },
    ],
  },
  {
    grupo: 'Cadena de costo de receta',
    items: [
      { vista: 'VW_BI_RECETAS', desc: 'BOM nivel 1' },
      { vista: 'VW_BI_RECETAS_EXPLOSION', desc: 'Explosión 3 niveles' },
      { vista: 'VW_BI_RECETA_COSTO', desc: 'Costo teórico + FlagCosto' },
    ],
  },
  {
    grupo: 'Dimensiones',
    items: [
      { vista: 'VW_DIM_RECETA', desc: 'Artículos OITM' },
      { vista: 'VW_DIM_COMPONENTE', desc: 'Componentes únicos' },
      { vista: 'VW_DIM_ALMACEN', desc: 'Almacenes OWHS' },
      { vista: 'VW_DIM_CLIENTE', desc: 'Clientes OCRD' },
      { vista: 'VW_DIM_ORDEN_PROD', desc: 'Órdenes OWOR' },
    ],
  },
] as const

function formatSyncLabel(iso: string | null | undefined): string {
  if (!iso) return 'Sin lectura aún'
  return formatDateDMY(iso)
}

function formatMonto(value: number, moneda: string): string {
  if (moneda === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }
  return formatLps(value)
}

export function CosteoMuestrasPage() {
  const canConfig = useAuthStore((s) => s.hasPermiso('bi:costeo:config') || s.hasPermiso('*'))

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SapBiCosteoConfig | null>(null)
  const [datos, setDatos] = useState<CosteoMuestrasPayload | null>(null)

  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const [configOpen, setConfigOpen] = useState(false)
  const [configForm, setConfigForm] = useState({
    driver: 'hana' as 'mssql' | 'hana',
    host: '172.16.146.16',
    port: 30015,
    database: 'RCJ_BI',
    schema: 'RCJ_BI',
    viewName: 'VW_BI_VENTA_COSTO',
    username: 'B2User',
    password: '',
    encrypt: true,
    trustServerCertificate: true,
    columnMapping: { ...DEFAULT_MAPPING },
  })
  const [configSaving, setConfigSaving] = useState(false)
  const [configTesting, setConfigTesting] = useState(false)
  const [configDetecting, setConfigDetecting] = useState(false)
  const [vistaColumnas, setVistaColumnas] = useState<string[]>([])
  const [configMsg, setConfigMsg] = useState<string | null>(null)

  const loadDatos = useCallback(async (refresh = false) => {
    setError(null)
    try {
      const payload = await fetchCosteoDatos({
        cliente: filtroCliente || undefined,
        desde: filtroDesde || undefined,
        hasta: filtroHasta || undefined,
        refresh,
      })
      setDatos(payload)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [filtroCliente, filtroDesde, filtroHasta])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cfg = await fetchCosteoConfig()
      setConfig(cfg)
      if (cfg.configured) {
        await loadDatos(false)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [loadDatos])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const chartData = useMemo(() => {
    if (!datos) return []
    return datos.por_cliente.slice(0, 12).map((c) => ({
      name: c.cliente.length > 18 ? `${c.cliente.slice(0, 16)}…` : c.cliente,
      costo: c.costo,
      fullName: c.cliente,
    }))
  }, [datos])

  const openConfig = () => {
    if (config) {
      setConfigForm({
        driver: config.driver,
        host: config.host,
        port: config.port,
        database: config.database,
        schema: config.schema,
        viewName: config.viewName,
        username: config.username,
        password: '',
        encrypt: config.encrypt,
        trustServerCertificate: config.trustServerCertificate,
        columnMapping: { ...DEFAULT_MAPPING, ...config.columnMapping },
      })
    }
    setConfigMsg(null)
    setConfigOpen(true)
  }

  const handleSaveConfig = async () => {
    setConfigSaving(true)
    setConfigMsg(null)
    try {
      const saved = await saveCosteoConfig({
        ...configForm,
        password: configForm.password || undefined,
      })
      setConfig(saved)
      setConfigMsg('Configuración guardada.')
    } catch (e) {
      setConfigMsg((e as Error).message)
    } finally {
      setConfigSaving(false)
    }
  }

  const handleTestConfig = async () => {
    setConfigTesting(true)
    setConfigMsg(null)
    try {
      await saveCosteoConfig({
        ...configForm,
        password: configForm.password || undefined,
      })
      const result = await testCosteoConnection()
      setConfigMsg(result.message)
    } catch (e) {
      setConfigMsg((e as Error).message)
    } finally {
      setConfigTesting(false)
    }
  }

  const handleDetectColumns = async () => {
    setConfigDetecting(true)
    setConfigMsg(null)
    try {
      await saveCosteoConfig({
        ...configForm,
        password: configForm.password || undefined,
      })
      const { columnas, sugerido } = await fetchCosteoVistaColumnas()
      setVistaColumnas(columnas)
      setConfigForm((f) => ({
        ...f,
        columnMapping: { ...DEFAULT_MAPPING, ...sugerido },
      }))
      setConfigMsg(
        columnas.length
          ? `Detectadas ${columnas.length} columnas. Revise el mapeo y guarde.`
          : 'No se encontraron columnas.',
      )
    } catch (e) {
      setConfigMsg((e as Error).message)
    } finally {
      setConfigDetecting(false)
    }
  }

  const handleApplyDetectAndSave = async () => {
    setConfigDetecting(true)
    setConfigMsg(null)
    try {
      await saveCosteoConfig({
        ...configForm,
        password: configForm.password || undefined,
      })
      const saved = await applyCosteoColumnMapping()
      setConfig(saved)
      setConfigForm((f) => ({
        ...f,
        columnMapping: { ...DEFAULT_MAPPING, ...saved.columnMapping },
      }))
      setConfigMsg('Mapeo detectado y guardado. Pruebe la conexión.')
    } catch (e) {
      setConfigMsg((e as Error).message)
    } finally {
      setConfigDetecting(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      await syncCosteoMuestras()
      await loadAll()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const moneda = datos?.resumen.moneda ?? 'HNL'

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">BI — Costeo de muestras</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Análisis de costos de muestras por cliente desde vista SAP Business One.
            En producción (Ubuntu/Docker) la conexión sale del contenedor hacia el servidor SQL SAP.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canConfig && (
            <Button type="button" variant="outline" onClick={openConfig}>
              <Settings2 className="mr-2 size-4" />
              Configuración SAP
            </Button>
          )}
          <Button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing || !config?.configured}
          >
            {syncing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Sincronizar
          </Button>
        </div>
      </div>

      <Card className="border-[var(--border)] bg-[var(--blue-lt)]/40">
        <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
          <Cable className="size-4 text-[var(--navy)]" />
          {config?.configured ? (
            <>
              <span>
                Vista: <strong>{config.schema}.{config.viewName}</strong>
              </span>
              <span className="text-[var(--text-muted)]">|</span>
              <span>Último sync: {formatSyncLabel(datos?.ultimo_sync ?? config.ultimo_sync)}</span>
              <Badge variant="outline" className="bg-white">{config.driver.toUpperCase()}</Badge>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">
              Configure la conexión a SAP y el nombre de la vista de costeo para comenzar.
            </span>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-800">{error}</CardContent>
        </Card>
      )}

      {!config?.configured && !loading && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-[var(--text-muted)]">
            {canConfig
              ? 'Use el botón Configuración SAP para definir host, base de datos, credenciales y vista.'
              : 'El módulo aún no está configurado. Contacte al administrador de IT.'}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Cargando datos…
        </div>
      ) : datos ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                  <BarChart3 className="size-4" /> Costo total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatMonto(datos.resumen.total_costo, moneda)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                  <FlaskConical className="size-4" /> Muestras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{datos.resumen.total_muestras.toLocaleString('es-HN')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                  <Users className="size-4" /> Clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{datos.resumen.total_clientes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Registros</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{datos.resumen.total_registros.toLocaleString('es-HN')}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <div className="min-w-[200px] flex-1">
                <Label htmlFor="filtro-cliente">Cliente</Label>
                <Input
                  id="filtro-cliente"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  placeholder="Nombre o código"
                />
              </div>
              <div>
                <Label htmlFor="filtro-desde">Desde</Label>
                <Input
                  id="filtro-desde"
                  type="date"
                  value={filtroDesde}
                  onChange={(e) => setFiltroDesde(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filtro-hasta">Hasta</Label>
                <Input
                  id="filtro-hasta"
                  type="date"
                  value={filtroHasta}
                  onChange={(e) => setFiltroHasta(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={() => void loadDatos(true)}>
                  Aplicar filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Costo por cliente (top 12)</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin datos para graficar.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => formatMonto(Number(v), moneda)} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => formatMonto(Number(v ?? 0), moneda)}
                      labelFormatter={(_, payload) => {
                        const p = payload?.[0]?.payload as { fullName?: string } | undefined
                        return p?.fullName ?? ''
                      }}
                    />
                    <Bar dataKey="costo" fill="var(--navy)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen por cliente</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Muestras</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.por_cliente.map((c) => (
                    <TableRow key={c.codigo_cliente || c.cliente}>
                      <TableCell className="font-mono text-xs">{c.codigo_cliente || '—'}</TableCell>
                      <TableCell>{c.cliente}</TableCell>
                      <TableCell className="text-right">{c.cantidad_muestras}</TableCell>
                      <TableCell className="text-right">{c.registros}</TableCell>
                      <TableCell className="text-right font-medium">{formatMonto(c.costo, moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalle de muestras</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Muestra</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Costo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.detalle.slice(0, 200).map((d, i) => (
                    <TableRow key={`${d.muestra}-${d.cliente}-${i}`}>
                      <TableCell>{formatSyncLabel(d.fecha)}</TableCell>
                      <TableCell>{d.cliente}</TableCell>
                      <TableCell className="font-mono text-xs">{d.muestra || '—'}</TableCell>
                      <TableCell className="max-w-[240px] truncate">{d.descripcion || '—'}</TableCell>
                      <TableCell className="text-right">{d.cantidad || 1}</TableCell>
                      <TableCell className="text-right">{formatMonto(d.costo, moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {datos.detalle.length > 200 && (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Mostrando 200 de {datos.detalle.length} registros. Use filtros para acotar.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conexión SAP — Vista de costeo</DialogTitle>
            <p className="text-sm text-[var(--text-muted)]">
              En el servidor Ubuntu la app corre en Docker. El host SAP debe ser alcanzable desde el
              contenedor (IP/DNS interno, puerto {configForm.port} abierto en firewall).
            </p>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Driver</Label>
              <Select
                value={configForm.driver}
                onValueChange={(v) => setConfigForm((f) => ({ ...f, driver: v as 'mssql' | 'hana' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hana">SAP HANA (puerto 30015 — RCJ)</SelectItem>
                  <SelectItem value="mssql">SQL Server (puerto 1433)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Puerto</Label>
              <Input
                type="number"
                value={configForm.port}
                onChange={(e) => setConfigForm((f) => ({ ...f, port: Number(e.target.value) || 1433 }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Host / servidor</Label>
              <Input
                value={configForm.host}
                onChange={(e) => setConfigForm((f) => ({ ...f, host: e.target.value }))}
                placeholder="sap-sql.rcjcorp.local"
              />
            </div>
            <div>
              <Label>Base de datos</Label>
              <Input
                value={configForm.database}
                onChange={(e) => setConfigForm((f) => ({ ...f, database: e.target.value }))}
                placeholder="SBODemoHN"
              />
            </div>
            <div>
              <Label>Esquema compañía SAP B1 (HANA)</Label>
              <Input
                value={configForm.schema}
                onChange={(e) => setConfigForm((f) => ({ ...f, schema: e.target.value }))}
                placeholder="RCJ_BI"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Nombre de la vista SAP</Label>
              <Input
                value={configForm.viewName}
                onChange={(e) => setConfigForm((f) => ({ ...f, viewName: e.target.value }))}
                placeholder="VW_BI_VENTA_COSTO"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Recomendada: <strong>VW_BI_VENTA_COSTO</strong> (costo/margen real por cliente).
              </p>
            </div>
            <div>
              <Label>Usuario</Label>
              <Input
                value={configForm.username}
                onChange={(e) => setConfigForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div>
              <Label>Contraseña {config?.hasPassword && '(dejar vacío para mantener)'}</Label>
              <Input
                type="password"
                value={configForm.password}
                onChange={(e) => setConfigForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--gray-lt)] p-3">
            <p className="mb-2 text-sm font-medium">Vistas SAP disponibles</p>
            <div className="max-h-48 space-y-3 overflow-y-auto text-xs text-[var(--text-muted)]">
              {VISTAS_SAP_CATALOGO.map((g) => (
                <div key={g.grupo}>
                  <p className="font-semibold text-[var(--text)]">{g.grupo}</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {g.items.map((v) => (
                      <li key={v.vista}>
                        <span className="font-mono text-[11px]">{v.vista}</span>
                        {' — '}
                        {v.desc}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Mapeo de columnas de la vista</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={configDetecting}
                onClick={() => void handleDetectColumns()}
              >
                {configDetecting ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                Detectar columnas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={configDetecting}
                onClick={() => void handleApplyDetectAndSave()}
              >
                Detectar y guardar
              </Button>
            </div>
            {vistaColumnas.length > 0 && (
              <p className="mb-2 text-xs text-[var(--text-muted)]">
                Columnas en {configForm.viewName}: {vistaColumnas.join(', ')}
              </p>
            )}
            <p className="mb-2 text-xs text-amber-800">
              Si aparece «invalid column name: ItemCode», deje vacío muestra/descripcion o use Detectar columnas.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(DEFAULT_MAPPING) as (keyof SapBiColumnMapping)[]).map((key) => (
                <div key={key}>
                  <Label className="text-xs capitalize">{key.replace(/_/g, ' ')}</Label>
                  <Input
                    value={configForm.columnMapping[key] ?? ''}
                    onChange={(e) =>
                      setConfigForm((f) => ({
                        ...f,
                        columnMapping: { ...f.columnMapping, [key]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {configMsg && (
            <p className={`text-sm ${configMsg.includes('exitosa') ? 'text-green-700' : 'text-[var(--text-muted)]'}`}>
              {configMsg}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => void handleTestConfig()} disabled={configTesting}>
              {configTesting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Cable className="mr-2 size-4" />}
              Probar conexión
            </Button>
            <Button type="button" onClick={() => void handleSaveConfig()} disabled={configSaving}>
              {configSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

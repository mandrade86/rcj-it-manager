import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Cable,
  FlaskConical,
  Loader2,
  Percent,
  RefreshCw,
  Settings2,
  TrendingUp,
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  applyCosteoColumnMapping,
  fetchCosteoConfig,
  fetchCosteoVistaColumnas,
  fetchRecetasCosto,
  fetchVentasMargen,
  saveCosteoConfig,
  syncCosteoMuestras,
  testCosteoConnection,
} from '@/lib/api/costeoMuestras'
import { formatDateDMY, formatLps } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import type {
  RecetaCostoPayload,
  SapBiColumnMapping,
  SapBiCosteoConfig,
  VentaMargenPayload,
} from '@/types/costeoMuestras'

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
      { vista: 'VW_BI_VENTA_COSTO', desc: 'Venta, costo real y margen por cliente/receta' },
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

function formatMonto(value: number): string {
  return formatLps(value)
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function margenPct(venta: number, margen: number): string {
  if (venta <= 0) return '—'
  return formatPct((margen / venta) * 100)
}

export function CosteoMuestrasPage() {
  const canConfig = useAuthStore((s) => s.hasPermiso('bi:costeo:config') || s.hasPermiso('*'))

  const [activeTab, setActiveTab] = useState('recetas')
  const [loading, setLoading] = useState(true)
  const [tabLoading, setTabLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SapBiCosteoConfig | null>(null)
  const [recetas, setRecetas] = useState<RecetaCostoPayload | null>(null)
  const [ventas, setVentas] = useState<VentaMargenPayload | null>(null)

  const [filtroReceta, setFiltroReceta] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroRecetaVentas, setFiltroRecetaVentas] = useState('')
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

  const loadRecetas = useCallback(async () => {
    const payload = await fetchRecetasCosto({
      receta: filtroReceta || undefined,
    })
    setRecetas(payload)
  }, [filtroReceta])

  const loadVentas = useCallback(async () => {
    const payload = await fetchVentasMargen({
      cliente: filtroCliente || undefined,
      receta: filtroRecetaVentas || undefined,
      desde: filtroDesde || undefined,
      hasta: filtroHasta || undefined,
    })
    setVentas(payload)
  }, [filtroCliente, filtroRecetaVentas, filtroDesde, filtroHasta])

  const loadTabData = useCallback(async (tab: string) => {
    setTabLoading(true)
    setError(null)
    try {
      if (tab === 'recetas') await loadRecetas()
      else await loadVentas()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setTabLoading(false)
    }
  }, [loadRecetas, loadVentas])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cfg = await fetchCosteoConfig()
      setConfig(cfg)
      if (cfg.configured) {
        await Promise.all([loadRecetas(), loadVentas()])
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [loadRecetas, loadVentas])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const chartRecetas = useMemo(() => {
    if (!recetas) return []
    return recetas.detalle.slice(0, 15).map((r) => ({
      name: r.receta_nombre.length > 20 ? `${r.receta_nombre.slice(0, 18)}…` : r.receta_nombre,
      costo: r.costo,
      fullName: r.receta_nombre,
      code: r.receta_code,
    }))
  }, [recetas])

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

  const ultimoSync = recetas?.ultimo_sync ?? ventas?.ultimo_sync ?? config?.ultimo_sync

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">BI — Costeo de muestras</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Costos teóricos por receta y análisis de venta, costo y margen por cliente desde SAP HANA.
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
                Esquema: <strong>{config.schema}</strong>
              </span>
              <span className="text-[var(--text-muted)]">|</span>
              <span>Último sync: {formatSyncLabel(ultimoSync)}</span>
              <Badge variant="outline" className="bg-white">{config.driver.toUpperCase()}</Badge>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">
              Configure la conexión a SAP para comenzar.
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
              ? 'Use el botón Configuración SAP para definir host, credenciales y vistas.'
              : 'El módulo aún no está configurado. Contacte al administrador de IT.'}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
          <Loader2 className="mr-2 size-5 animate-spin" />
          Cargando datos…
        </div>
      ) : config?.configured ? (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v)
            void loadTabData(v)
          }}
        >
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="recetas">Costos por receta</TabsTrigger>
            <TabsTrigger value="ventas">Ventas y margen</TabsTrigger>
          </TabsList>

          <TabsContent value="recetas" className="mt-6 space-y-6">
            {tabLoading && !recetas ? (
              <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Cargando recetas…
              </div>
            ) : recetas ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                        <FlaskConical className="size-4" /> Recetas
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{recetas.resumen.total_recetas}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                        <BarChart3 className="size-4" /> Costo promedio
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatMonto(recetas.resumen.costo_promedio)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Costo máximo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatMonto(recetas.resumen.costo_max)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Costo mínimo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatMonto(recetas.resumen.costo_min)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Filtro</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-4">
                    <div className="min-w-[200px] flex-1">
                      <Label htmlFor="filtro-receta">Receta (código o nombre)</Label>
                      <Input
                        id="filtro-receta"
                        value={filtroReceta}
                        onChange={(e) => setFiltroReceta(e.target.value)}
                        placeholder="Ej. REC-001"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="secondary" onClick={() => void loadRecetas()}>
                        Aplicar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Costo teórico por receta (top 15)</CardTitle>
                    <p className="text-xs text-[var(--text-muted)]">Vista: {recetas.vista}</p>
                  </CardHeader>
                  <CardContent className="h-80">
                    {chartRecetas.length === 0 ? (
                      <p className="py-8 text-center text-sm text-[var(--text-muted)]">Sin datos para graficar.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartRecetas} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => formatMonto(Number(v))} />
                          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(v) => formatMonto(Number(v ?? 0))}
                            labelFormatter={(_, payload) => {
                              const p = payload?.[0]?.payload as { fullName?: string; code?: string } | undefined
                              return p?.code ? `${p.code} — ${p.fullName}` : p?.fullName ?? ''
                            }}
                          />
                          <Bar dataKey="costo" fill="var(--soft)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detalle de costos por receta</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Receta</TableHead>
                          <TableHead>Flag costo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Costo unit.</TableHead>
                          <TableHead className="text-right">Costo teórico</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recetas.detalle.map((r) => (
                          <TableRow key={r.receta_code || r.receta_nombre}>
                            <TableCell className="font-mono text-xs">{r.receta_code || '—'}</TableCell>
                            <TableCell>{r.receta_nombre || '—'}</TableCell>
                            <TableCell>
                              {r.flag_costo ? (
                                <Badge variant={r.flag_costo === 'OK' ? 'default' : 'outline'}>{r.flag_costo}</Badge>
                              ) : (
                                '—'
                              )}
                            </TableCell>
                            <TableCell className="text-right">{r.cantidad || '—'}</TableCell>
                            <TableCell className="text-right">{formatMonto(r.costo_unitario)}</TableCell>
                            <TableCell className="text-right font-medium">{formatMonto(r.costo)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {recetas.detalle.length === 0 && (
                      <p className="py-6 text-center text-sm text-[var(--text-muted)]">Sin registros.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="ventas" className="mt-6 space-y-6">
            {tabLoading && !ventas ? (
              <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Cargando ventas…
              </div>
            ) : ventas ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                        <TrendingUp className="size-4" /> Venta total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatMonto(ventas.resumen.total_venta)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                        <BarChart3 className="size-4" /> Costo total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{formatMonto(ventas.resumen.total_costo)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-medium text-[var(--text-muted)]">
                        <Percent className="size-4" /> Margen total
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold text-[var(--lime)]">
                        {formatMonto(ventas.resumen.total_margen)}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {formatPct(ventas.resumen.margen_pct)} sobre venta
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-[var(--text-muted)]">Registros</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold">{ventas.resumen.total_registros.toLocaleString('es-HN')}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Filtros</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-4">
                    <div className="min-w-[180px] flex-1">
                      <Label htmlFor="filtro-cliente-vm">Cliente</Label>
                      <Input
                        id="filtro-cliente-vm"
                        value={filtroCliente}
                        onChange={(e) => setFiltroCliente(e.target.value)}
                        placeholder="Nombre o código"
                      />
                    </div>
                    <div className="min-w-[180px] flex-1">
                      <Label htmlFor="filtro-receta-vm">Receta</Label>
                      <Input
                        id="filtro-receta-vm"
                        value={filtroRecetaVentas}
                        onChange={(e) => setFiltroRecetaVentas(e.target.value)}
                        placeholder="Código o nombre"
                      />
                    </div>
                    <div>
                      <Label htmlFor="filtro-desde-vm">Desde</Label>
                      <Input
                        id="filtro-desde-vm"
                        type="date"
                        value={filtroDesde}
                        onChange={(e) => setFiltroDesde(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="filtro-hasta-vm">Hasta</Label>
                      <Input
                        id="filtro-hasta-vm"
                        type="date"
                        value={filtroHasta}
                        onChange={(e) => setFiltroHasta(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="secondary" onClick={() => void loadVentas()}>
                        Aplicar filtros
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detalle venta / costo / margen por línea</CardTitle>
                    <p className="text-xs text-[var(--text-muted)]">Vista: {ventas.vista}</p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Receta</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">Venta</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead className="text-right">Margen</TableHead>
                          <TableHead className="text-right">Margen %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ventas.detalle.slice(0, 500).map((d, i) => (
                          <TableRow key={`${d.receta_code}-${d.codigo_cliente}-${d.fecha}-${i}`}>
                            <TableCell>{formatSyncLabel(d.fecha)}</TableCell>
                            <TableCell>
                              <div className="max-w-[160px] truncate" title={d.cliente}>{d.cliente}</div>
                              {d.codigo_cliente && (
                                <span className="font-mono text-[10px] text-[var(--text-muted)]">{d.codigo_cliente}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{d.receta_code || '—'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{d.receta_nombre || '—'}</TableCell>
                            <TableCell className="text-right">{d.cantidad || 1}</TableCell>
                            <TableCell className="text-right">{formatMonto(d.venta)}</TableCell>
                            <TableCell className="text-right">{formatMonto(d.costo)}</TableCell>
                            <TableCell className={`text-right font-medium ${d.margen >= 0 ? 'text-[var(--lime)]' : 'text-red-600'}`}>
                              {formatMonto(d.margen)}
                            </TableCell>
                            <TableCell className="text-right text-xs">{margenPct(d.venta, d.margen)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      {ventas.detalle.length > 0 && (
                        <TableFooter>
                          <TableRow className="bg-[var(--gray-lt)] font-semibold">
                            <TableCell colSpan={5}>Total ({ventas.resumen.total_registros} líneas)</TableCell>
                            <TableCell className="text-right">{formatMonto(ventas.resumen.total_venta)}</TableCell>
                            <TableCell className="text-right">{formatMonto(ventas.resumen.total_costo)}</TableCell>
                            <TableCell className="text-right text-[var(--lime)]">
                              {formatMonto(ventas.resumen.total_margen)}
                            </TableCell>
                            <TableCell className="text-right">{formatPct(ventas.resumen.margen_pct)}</TableCell>
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                    {ventas.detalle.length === 0 && (
                      <p className="py-6 text-center text-sm text-[var(--text-muted)]">Sin registros con los filtros actuales.</p>
                    )}
                    {ventas.detalle.length > 500 && (
                      <p className="mt-3 text-xs text-[var(--text-muted)]">
                        Mostrando 500 de {ventas.detalle.length} registros. Acote con filtros para ver todo el detalle.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        </Tabs>
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
              <Label>Nombre de la vista SAP (sync legacy)</Label>
              <Input
                value={configForm.viewName}
                onChange={(e) => setConfigForm((f) => ({ ...f, viewName: e.target.value }))}
                placeholder="VW_BI_VENTA_COSTO"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Los tabs usan <strong>VW_BI_RECETA_COSTO</strong> y <strong>VW_BI_VENTA_COSTO</strong> automáticamente.
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

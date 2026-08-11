import { useCallback, useEffect, useState } from 'react'
import { Cable, Loader2, RefreshCw, Settings2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  applyCosteoColumnMapping,
  fetchCosteoConfig,
  fetchCosteoVistaColumnas,
  saveCosteoConfig,
  syncCosteoMuestras,
  testCosteoConnection,
} from '@/lib/api/costeoMuestras'
import { formatDateDMY } from '@/lib/format'
import { useAuthStore } from '@/store/authStore'
import type { SapBiColumnMapping, SapBiCosteoConfig } from '@/types/costeoMuestras'

import { RecetasAnalisisTab } from './costeo/RecetasAnalisisTab'
import { VentasAnalisisTab } from './costeo/VentasAnalisisTab'

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
      { vista: 'VW_BI_RECETAS_EXPLOSION', desc: 'Explosión 3 niveles — ingredientes' },
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

export function CosteoMuestrasPage() {
  const canConfig = useAuthStore((s) => s.hasPermiso('bi:costeo:config') || s.hasPermiso('*'))

  const [activeTab, setActiveTab] = useState('recetas')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<SapBiCosteoConfig | null>(null)

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

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cfg = await fetchCosteoConfig()
      setConfig(cfg)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

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
      await loadConfig()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">BI — Costeo de muestras</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Análisis de costos por receta (BOM) y cruce teórico vs producción con margen para decisiones.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canConfig && (
            <Button type="button" variant="outline" onClick={openConfig}>
              <Settings2 className="mr-2 size-4" />
              Configuración SAP
            </Button>
          )}
          <Button type="button" onClick={() => void handleSync()} disabled={syncing || !config?.configured}>
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
              <span>Esquema: <strong>{config.schema}</strong></span>
              <span className="text-[var(--text-muted)]">|</span>
              <span>Último sync: {formatSyncLabel(config.ultimo_sync)}</span>
              <Badge variant="outline" className="bg-white">{config.driver.toUpperCase()}</Badge>
            </>
          ) : (
            <span className="text-[var(--text-muted)]">Configure la conexión a SAP para comenzar.</span>
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
          Cargando…
        </div>
      ) : config?.configured ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-2">
            <TabsTrigger value="recetas">Costos por receta</TabsTrigger>
            <TabsTrigger value="ventas">Ventas y margen</TabsTrigger>
          </TabsList>

          <TabsContent value="recetas" className="mt-6">
            <RecetasAnalisisTab onError={setError} />
          </TabsContent>

          <TabsContent value="ventas" className="mt-6">
            <VentasAnalisisTab onError={setError} />
          </TabsContent>
        </Tabs>
      ) : null}

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conexión SAP — Vista de costeo</DialogTitle>
            <p className="text-sm text-[var(--text-muted)]">
              Host SAP alcanzable desde Docker/Ubuntu (puerto {configForm.port}).
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
                  <SelectItem value="hana">SAP HANA (puerto 30015)</SelectItem>
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
              />
            </div>
            <div>
              <Label>Base de datos</Label>
              <Input
                value={configForm.database}
                onChange={(e) => setConfigForm((f) => ({ ...f, database: e.target.value }))}
              />
            </div>
            <div>
              <Label>Esquema (HANA)</Label>
              <Input
                value={configForm.schema}
                onChange={(e) => setConfigForm((f) => ({ ...f, schema: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Vista legacy (sync)</Label>
              <Input
                value={configForm.viewName}
                onChange={(e) => setConfigForm((f) => ({ ...f, viewName: e.target.value }))}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Tabs usan VW_BI_RECETA_COSTO, VW_BI_RECETAS_EXPLOSION y VW_BI_VENTA_COSTO.
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
              <Label>Contraseña {config?.hasPassword && '(vacío = mantener)'}</Label>
              <Input
                type="password"
                value={configForm.password}
                onChange={(e) => setConfigForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-[var(--border)] bg-[var(--gray-lt)] p-3">
            <p className="mb-2 text-sm font-medium">Vistas SAP</p>
            <div className="max-h-40 space-y-2 overflow-y-auto text-xs text-[var(--text-muted)]">
              {VISTAS_SAP_CATALOGO.map((g) => (
                <div key={g.grupo}>
                  <p className="font-semibold text-[var(--text)]">{g.grupo}</p>
                  <ul className="mt-1 list-inside list-disc">
                    {g.items.map((v) => (
                      <li key={v.vista}>
                        <span className="font-mono">{v.vista}</span> — {v.desc}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={configDetecting} onClick={() => void handleDetectColumns()}>
                {configDetecting ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                Detectar columnas
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={configDetecting} onClick={() => void handleApplyDetectAndSave()}>
                Detectar y guardar
              </Button>
            </div>
            {vistaColumnas.length > 0 && (
              <p className="mb-2 text-xs text-[var(--text-muted)]">Columnas: {vistaColumnas.join(', ')}</p>
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

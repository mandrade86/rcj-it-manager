import { Config } from '../db/models/Config.js'

export const SAP_BI_COSTEO_CONFIG_KEY = 'sap_bi_costeo_muestras_config'
export const SAP_BI_COSTEO_SYNC_KEY = 'sap_bi_costeo_muestras_ultimo_sync'

export type SapBiDriver = 'mssql' | 'hana'

export type SapBiColumnMapping = {
  cliente: string
  codigo_cliente?: string
  muestra?: string
  descripcion?: string
  costo: string
  cantidad?: string
  fecha?: string
  moneda?: string
}

export type SapBiCosteoConfig = {
  driver: SapBiDriver
  host: string
  port: number
  database: string
  schema: string
  viewName: string
  username: string
  password?: string
  encrypt: boolean
  trustServerCertificate: boolean
  columnMapping: SapBiColumnMapping
}

export type SapBiCosteoConfigPublic = Omit<SapBiCosteoConfig, 'password'> & {
  hasPassword: boolean
  configured: boolean
}

export const VW_BI_VENTA_COSTO_MAPPING: SapBiColumnMapping = {
  cliente: 'CardName',
  codigo_cliente: 'CardCode',
  muestra: 'RecetaCode',
  descripcion: 'RecetaNombre',
  costo: 'CostoReal',
  cantidad: 'Cantidad',
  fecha: 'Fecha',
  moneda: '',
}

export const DEFAULT_COLUMN_MAPPING: SapBiColumnMapping = { ...VW_BI_VENTA_COSTO_MAPPING }

/** Vistas SAP BI creadas en la BD de compañía (referencia para configuración). */
export const SAP_BI_VISTAS_CATALOGO = [
  {
    grupo: 'Cliente y producción',
    vistas: [
      {
        nombre: 'VW_BI_VENTA_COSTO',
        uso: 'Principal — costo y margen real por cliente (dashboard costeo muestras)',
        recomendada: true,
      },
      {
        nombre: 'VW_BI_PRODUCCION',
        uso: 'Producción y costo real por orden (OWOR); análisis por OP',
        recomendada: false,
      },
    ],
  },
  {
    grupo: 'Cadena de costo de receta',
    vistas: [
      { nombre: 'VW_BI_RECETAS', uso: 'BOM nivel 1 normalizado', recomendada: false },
      { nombre: 'VW_BI_RECETAS_EXPLOSION', uso: 'Explosión multinivel (3 niveles)', recomendada: false },
      { nombre: 'VW_BI_RECETA_COSTO', uso: 'Costo teórico actual (FlagCosto)', recomendada: false },
    ],
  },
  {
    grupo: 'Dimensiones',
    vistas: [
      { nombre: 'VW_DIM_RECETA', uso: 'Catálogo artículos/recetas (OITM)', recomendada: false },
      { nombre: 'VW_DIM_COMPONENTE', uso: 'Componentes únicos desde explosión', recomendada: false },
      { nombre: 'VW_DIM_ALMACEN', uso: 'Almacenes (OWHS)', recomendada: false },
      { nombre: 'VW_DIM_CLIENTE', uso: 'Clientes OCRD + grupo', recomendada: false },
      { nombre: 'VW_DIM_ORDEN_PROD', uso: 'Órdenes de producción (OWOR)', recomendada: false },
    ],
  },
] as const

export const DEFAULT_SAP_BI_COSTEO_CONFIG: SapBiCosteoConfig = {
  driver: 'hana',
  host: '172.16.146.16',
  port: 30015,
  database: 'RCJ_BI',
  schema: 'RCJ_BI',
  viewName: 'VW_BI_VENTA_COSTO',
  username: 'B2User',
  password: '',
  encrypt: true,
  trustServerCertificate: true,
  columnMapping: { ...DEFAULT_COLUMN_MAPPING },
}

function parseConfigJson(raw: string | undefined | null): SapBiCosteoConfig {
  if (!raw?.trim()) return { ...DEFAULT_SAP_BI_COSTEO_CONFIG }
  try {
    const parsed = JSON.parse(raw) as Partial<SapBiCosteoConfig>
    return {
      ...DEFAULT_SAP_BI_COSTEO_CONFIG,
      ...parsed,
      columnMapping: {
        ...DEFAULT_COLUMN_MAPPING,
        ...(parsed.columnMapping ?? {}),
      },
    }
  } catch {
    return { ...DEFAULT_SAP_BI_COSTEO_CONFIG }
  }
}

export function isSapBiConfigured(cfg: SapBiCosteoConfig): boolean {
  const schemaOk = cfg.driver === 'hana'
    ? Boolean(cfg.schema?.trim() || cfg.database?.trim())
    : Boolean(cfg.schema?.trim() && cfg.database?.trim())
  return Boolean(
    cfg.host?.trim()
    && schemaOk
    && cfg.viewName?.trim()
    && cfg.username?.trim()
    && cfg.columnMapping.costo?.trim()
    && cfg.columnMapping.cliente?.trim(),
  )
}

export function toPublicConfig(cfg: SapBiCosteoConfig): SapBiCosteoConfigPublic {
  const { password: _p, ...rest } = cfg
  return {
    ...rest,
    hasPassword: Boolean(cfg.password?.trim()),
    configured: isSapBiConfigured(cfg),
  }
}

export async function loadSapBiCosteoConfig(): Promise<SapBiCosteoConfig> {
  const doc = await Config.findOne({ clave: SAP_BI_COSTEO_CONFIG_KEY }).lean()
  const cfg = parseConfigJson(doc?.valor)
  return mergeSapBiEnv(cfg)
}

/** Aplica variables de entorno (.env / Docker) sin sobrescribir MongoDB. */
export function mergeSapBiEnv(cfg: SapBiCosteoConfig): SapBiCosteoConfig {
  const env = process.env
  const pick = (key: string, current: string) => {
    const v = env[key]?.trim()
    return v || current
  }
  const pickBool = (key: string, current: boolean) => {
    const v = env[key]?.trim().toLowerCase()
    if (v === 'true' || v === '1') return true
    if (v === 'false' || v === '0') return false
    return current
  }
  const driver = env.SAP_BI_DRIVER?.trim()
  const portRaw = env.SAP_BI_PORT?.trim()

  return {
    ...cfg,
    driver: driver === 'hana' || driver === 'mssql' ? driver : cfg.driver,
    host: pick('SAP_BI_HOST', cfg.host),
    port: portRaw ? Number(portRaw) || cfg.port : cfg.port,
    database: pick('SAP_BI_DATABASE', cfg.database),
    schema: pick('SAP_BI_SCHEMA', cfg.schema),
    viewName: pick('SAP_BI_VIEW', cfg.viewName),
    username: pick('SAP_BI_USERNAME', cfg.username),
    password: pick('SAP_BI_PASSWORD', cfg.password ?? '') || cfg.password,
    encrypt: pickBool('SAP_BI_ENCRYPT', cfg.encrypt),
    trustServerCertificate: pickBool('SAP_BI_TRUST_CERT', cfg.trustServerCertificate),
  }
}

/** Precarga config desde .env si MongoDB aún no tiene datos (despliegue Ubuntu). */
export async function ensureSapBiCosteoConfigFromEnv(): Promise<void> {
  const doc = await Config.findOne({ clave: SAP_BI_COSTEO_CONFIG_KEY }).lean()
  if (doc?.valor?.trim()) return

  const merged = mergeSapBiEnv({ ...DEFAULT_SAP_BI_COSTEO_CONFIG })
  if (!isSapBiConfigured(merged) && !merged.password?.trim()) return

  await Config.findOneAndUpdate(
    { clave: SAP_BI_COSTEO_CONFIG_KEY },
    { valor: JSON.stringify(merged) },
    { upsert: true },
  )
  console.log('SAP BI costeo: configuración inicial cargada desde variables de entorno.')
}

const LEGACY_BI_COLUMNS = new Set(['ItemCode', 'ItemName', 'Quantity', 'DocDate', 'DocCur'])

function mappingUsesLegacyColumns(m: SapBiColumnMapping): boolean {
  return [
    m.muestra, m.descripcion, m.cantidad, m.fecha, m.moneda,
  ].some((col) => col?.trim() && LEGACY_BI_COLUMNS.has(col.trim()))
}

/** Corrige mapeo guardado con columnas SAP B1 genéricas → VW_BI_VENTA_COSTO real. */
export async function ensureSapBiCosteoColumnMapping(): Promise<void> {
  const doc = await Config.findOne({ clave: SAP_BI_COSTEO_CONFIG_KEY }).lean()
  if (!doc?.valor?.trim()) return

  const cfg = parseConfigJson(doc.valor)
  if (cfg.viewName !== 'VW_BI_VENTA_COSTO') return
  if (!mappingUsesLegacyColumns(cfg.columnMapping)) return

  const next: SapBiCosteoConfig = {
    ...cfg,
    columnMapping: { ...VW_BI_VENTA_COSTO_MAPPING },
  }
  await Config.findOneAndUpdate(
    { clave: SAP_BI_COSTEO_CONFIG_KEY },
    { valor: JSON.stringify(next) },
  )
  console.log('SAP BI: mapeo migrado a columnas VW_BI_VENTA_COSTO (RecetaCode, RecetaNombre, …).')
}

export async function saveSapBiCosteoConfig(
  input: Partial<SapBiCosteoConfig>,
): Promise<SapBiCosteoConfigPublic> {
  const current = await loadSapBiCosteoConfig()
  const next: SapBiCosteoConfig = {
    ...current,
    ...input,
    columnMapping: {
      ...current.columnMapping,
      ...(input.columnMapping ?? {}),
    },
  }
  if (input.password === undefined || input.password === '') {
    next.password = current.password
  }
  await Config.findOneAndUpdate(
    { clave: SAP_BI_COSTEO_CONFIG_KEY },
    { valor: JSON.stringify(next) },
    { upsert: true },
  )
  return toPublicConfig(next)
}

export async function getUltimoSyncCosteo(): Promise<string | null> {
  const doc = await Config.findOne({ clave: SAP_BI_COSTEO_SYNC_KEY }).lean()
  return doc?.valor?.trim() || null
}

export async function setUltimoSyncCosteo(iso: string): Promise<void> {
  await Config.findOneAndUpdate(
    { clave: SAP_BI_COSTEO_SYNC_KEY },
    { valor: iso },
    { upsert: true },
  )
}

/** Valida identificadores SQL (vista, esquema, columnas). */
export function sanitizeSqlIdentifier(name: string, label: string): string {
  const trimmed = name.trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
    throw new Error(`Identificador inválido para ${label}: ${name}`)
  }
  return trimmed
}

export function qualifiedViewName(schema: string, viewName: string, driver: SapBiDriver = 'mssql'): string {
  const v = sanitizeSqlIdentifier(viewName, 'vista')
  const s = (schema?.trim() || '').length > 0 ? sanitizeSqlIdentifier(schema, 'esquema') : ''
  if (driver === 'hana') {
    return s ? `"${s}"."${v}"` : `"${v}"`
  }
  return s ? `[${s}].[${v}]` : `[${v}]`
}

export function quoteColumn(name: string, label: string, driver: SapBiDriver): string {
  const id = sanitizeSqlIdentifier(name, label)
  return driver === 'hana' ? `"${id}"` : `[${id}]`
}

export function quoteAlias(name: string, driver: SapBiDriver): string {
  const id = sanitizeSqlIdentifier(name, 'alias')
  return driver === 'hana' ? `"${id}"` : `[${id}]`
}

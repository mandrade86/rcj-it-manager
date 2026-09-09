import { Config } from '../db/models/Config.js'
import { loadSapBiCosteoConfig, type SapBiCosteoConfig } from './sapBiCosteoConfig.js'
import { listHanaViews, listViewColumns } from './sapBiQuery.js'
import {
  costosItFieldsValid,
  suggestCostosItFields,
  VISTA_COSTOS_IT,
  type CostosItFieldMap,
} from './sapCostosItFields.js'

export const COSTOS_IT_CONFIG_KEY = 'costos_it_sap_config'
export const COSTOS_IT_SYNC_KEY = 'costos_it_ultimo_sync'

export type CostosItConfig = {
  viewName: string
  schema?: string
  fields: CostosItFieldMap
}

export type CostosItResolved = {
  sapCfg: SapBiCosteoConfig
  itCfg: CostosItConfig
}

const DEFAULT_CONFIG: CostosItConfig = {
  viewName: VISTA_COSTOS_IT,
  fields: {},
}

const PREFERRED_VIEW_NAMES = ['VW_COSTOS_IT', 'VW_BI_COSTOS_IT', 'VW_IT_COSTOS']

function parseConfigJson(raw: string | undefined | null): CostosItConfig {
  if (!raw?.trim()) return { ...DEFAULT_CONFIG, fields: { ...DEFAULT_CONFIG.fields } }
  try {
    const parsed = JSON.parse(raw) as Partial<CostosItConfig>
    return {
      viewName: parsed.viewName?.trim() || VISTA_COSTOS_IT,
      schema: parsed.schema?.trim() || undefined,
      fields: { ...(parsed.fields ?? {}) },
    }
  } catch {
    return { ...DEFAULT_CONFIG, fields: {} }
  }
}

function applyEnvOverrides(itCfg: CostosItConfig, sapCfg: SapBiCosteoConfig): CostosItResolved {
  const viewName = process.env.SAP_COSTOS_IT_VIEW?.trim() || itCfg.viewName
  const schema =
    process.env.SAP_COSTOS_IT_SCHEMA?.trim()
    || itCfg.schema?.trim()
    || sapCfg.schema?.trim()
    || sapCfg.database?.trim()
    || ''
  return {
    itCfg: { ...itCfg, viewName, schema: schema || undefined },
    sapCfg: { ...sapCfg, schema },
  }
}

function sapCfgForItView(sapBase: SapBiCosteoConfig, itCfg: CostosItConfig): SapBiCosteoConfig {
  const schema =
    itCfg.schema?.trim()
    || sapBase.schema?.trim()
    || sapBase.database?.trim()
    || ''
  return { ...sapBase, schema }
}

export async function loadCostosItConfig(): Promise<CostosItConfig> {
  const doc = await Config.findOne({ clave: COSTOS_IT_CONFIG_KEY }).lean()
  return parseConfigJson(doc?.valor)
}

export async function saveCostosItConfig(input: Partial<CostosItConfig>): Promise<CostosItConfig> {
  const current = await loadCostosItConfig()
  const next: CostosItConfig = {
    viewName: input.viewName?.trim() || current.viewName,
    schema: input.schema?.trim() || current.schema,
    fields: input.fields !== undefined ? { ...input.fields } : { ...current.fields },
  }
  await Config.findOneAndUpdate(
    { clave: COSTOS_IT_CONFIG_KEY },
    { valor: JSON.stringify(next) },
    { upsert: true },
  )
  clearCostosItFieldsCache()
  return next
}

let cachedFields: CostosItFieldMap | null = null
let cachedFieldsKey = ''

export function clearCostosItFieldsCache(): void {
  cachedFields = null
  cachedFieldsKey = ''
}

async function discoverCostosItView(sapCfg: SapBiCosteoConfig): Promise<{ schema: string; viewName: string } | null> {
  const views = await listHanaViews(sapCfg, { nameLike: '%COSTOS%', limit: 100 })
  if (!views.length) return null

  for (const preferred of PREFERRED_VIEW_NAMES) {
    const hit = views.find((v) => v.viewName.toUpperCase() === preferred)
    if (hit) return hit
  }

  const itCostos = views.find((v) => /COSTOS.*IT|IT.*COSTOS/i.test(v.viewName))
  return itCostos ?? views[0] ?? null
}

async function viewExists(sapCfg: SapBiCosteoConfig, viewName: string): Promise<boolean> {
  try {
    const cols = await listViewColumns(sapCfg, viewName)
    return cols.length > 0
  } catch {
    return false
  }
}

export async function resolveCostosItConnection(): Promise<CostosItResolved> {
  const sapBase = await getSapConnectionForCostosIt()
  let { sapCfg, itCfg } = applyEnvOverrides(await loadCostosItConfig(), sapBase)
  sapCfg = sapCfgForItView(sapBase, itCfg)

  if (await viewExists(sapCfg, itCfg.viewName)) {
    return { sapCfg, itCfg }
  }

  const discovered = await discoverCostosItView(sapBase)
  if (discovered) {
    sapCfg = { ...sapBase, schema: discovered.schema }
    itCfg = { ...itCfg, viewName: discovered.viewName, schema: discovered.schema }
    await saveCostosItConfig({
      viewName: discovered.viewName,
      schema: discovered.schema,
      fields: {},
    })
    return { sapCfg, itCfg }
  }

  const candidates = await listHanaViews(sapBase, { nameLike: '%COSTOS%', limit: 20 }).catch(() => [])
  const hint = candidates.length
    ? ` Vistas con "COSTOS" en HANA: ${candidates.map((v) => `${v.schema}.${v.viewName}`).join(', ')}.`
    : ' No hay vistas con "COSTOS" en HANA.'
  throw new Error(
    `Vista ${itCfg.viewName} no existe en esquema ${sapCfg.schema}.${hint} `
    + 'Configure SAP_COSTOS_IT_VIEW y SAP_COSTOS_IT_SCHEMA en .env, o cree la vista (scripts/sql/VW_COSTOS_IT.sql).',
  )
}

export async function getCostosItFields(
  sapCfg: SapBiCosteoConfig,
  itCfg?: CostosItConfig,
): Promise<CostosItFieldMap> {
  const cfg = itCfg ?? (await loadCostosItConfig())
  const key = `${sapCfg.host}:${sapCfg.port}:${sapCfg.schema}:${cfg.viewName}`
  if (cachedFields && cachedFieldsKey === key && costosItFieldsValid(cachedFields)) {
    return cachedFields
  }

  const saved = cfg.fields
  if (costosItFieldsValid(saved)) {
    const columnas = await listViewColumns(sapCfg, cfg.viewName)
    const sugerido = suggestCostosItFields(columnas)
    const fields = {
      ...saved,
      proveedor: sugerido.proveedor ?? saved.proveedor,
      categoria_origen: sugerido.categoria_origen ?? saved.categoria_origen,
    }
    if (fields.proveedor !== saved.proveedor || fields.categoria_origen !== saved.categoria_origen) {
      await saveCostosItConfig({ fields })
    }
    cachedFields = fields
    cachedFieldsKey = key
    return fields
  }

  const columnas = await listViewColumns(sapCfg, cfg.viewName)
  const sugerido = suggestCostosItFields(columnas)
  if (!costosItFieldsValid(sugerido)) {
    throw new Error(
      `No se detectaron columnas mínimas en ${cfg.viewName}. Columnas: ${columnas.join(', ')}`,
    )
  }
  cachedFields = sugerido
  cachedFieldsKey = key
  await saveCostosItConfig({ fields: sugerido })
  return sugerido
}

export async function refreshCostosItFields(
  resolved: CostosItResolved,
): Promise<{ columnas: string[]; fields: CostosItFieldMap }> {
  const { sapCfg, itCfg } = resolved
  const columnas = await listViewColumns(sapCfg, itCfg.viewName)
  const fields = suggestCostosItFields(columnas)
  cachedFields = fields
  cachedFieldsKey = `${sapCfg.host}:${sapCfg.port}:${sapCfg.schema}:${itCfg.viewName}`
  await saveCostosItConfig({ fields })
  return { columnas, fields }
}

export async function listCostosItVistasCandidatas(): Promise<Array<{ schema: string; viewName: string }>> {
  const sapCfg = await getSapConnectionForCostosIt()
  return listHanaViews(sapCfg, { nameLike: '%COSTOS%', limit: 100 })
}

export async function getUltimoSyncCostosIt(): Promise<string | null> {
  const doc = await Config.findOne({ clave: COSTOS_IT_SYNC_KEY }).lean()
  return doc?.valor?.trim() || null
}

export async function setUltimoSyncCostosIt(iso: string): Promise<void> {
  await Config.findOneAndUpdate(
    { clave: COSTOS_IT_SYNC_KEY },
    { valor: iso },
    { upsert: true },
  )
}

export async function getSapConnectionForCostosIt(): Promise<SapBiCosteoConfig> {
  const cfg = await loadSapBiCosteoConfig()
  if (!cfg.host?.trim() || !cfg.username?.trim()) {
    throw new Error('Conexión SAP no configurada. Configure SAP en BI Costeo o variables SAP_BI_*.')
  }
  if (!cfg.password?.trim()) {
    throw new Error('Contraseña SAP no configurada.')
  }
  return cfg
}

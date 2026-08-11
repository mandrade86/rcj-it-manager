import { Router } from 'express'

import { requirePermiso } from '../middleware/requireAuth.js'
import {
  aggregateCosteoMuestras,
  aggregateRecetasCosto,
  aggregateVentasMargen,
  aggregateVentaAnalisis,
  buildClienteCatalogo,
  buildRecetaCatalogo,
  buildRecetaDetallePayload,
  buildRecetaVentaCatalogo,
  mapIngredienteRows,
  mapRecetaCostoRows,
  mapVentaMargenRows,
  type RecetaCatalogoItem,
} from '../utils/costeoMuestrasBi.js'
import { querySapBiGeneric } from '../utils/sapBiGenericQuery.js'
import {
  CAMPOS_VENTA_COSTO,
  clearExplosionFieldsCache,
  clearRecetaCostoFieldsCache,
  getExplosionFields,
  getRecetaCostoFields,
  suggestExplosionFields,
  VISTA_RECETA_COSTO,
  VISTA_RECETAS,
  VISTA_RECETAS_EXPLOSION,
  VISTA_VENTA_COSTO,
} from '../utils/sapBiVistas.js'
import { listViewColumns } from '../utils/sapBiQuery.js'
import {
  getUltimoSyncCosteo,
  isSapBiConfigured,
  loadSapBiCosteoConfig,
  saveSapBiCosteoConfig,
  setUltimoSyncCosteo,
  toPublicConfig,
  type SapBiCosteoConfig,
} from '../utils/sapBiCosteoConfig.js'
import { querySapBiView, testSapBiConnection, detectViewColumnMapping } from '../utils/sapBiQuery.js'

export const costeoMuestrasRouter = Router()

const canView = requirePermiso('bi:costeo:ver')
const canConfig = requirePermiso('bi:costeo:config')

let cachedRows: import('../utils/sapBiQuery.js').CosteoMuestraRow[] | null = null

costeoMuestrasRouter.get('/config', canView, async (_req, res, next) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    const ultimo_sync = await getUltimoSyncCosteo()
    res.json({ ...toPublicConfig(cfg), ultimo_sync })
  } catch (err) {
    next(err)
  }
})

costeoMuestrasRouter.put('/config', canConfig, async (req, res, next) => {
  try {
    const body = req.body as Partial<SapBiCosteoConfig>
    const saved = await saveSapBiCosteoConfig(body)
    cachedRows = null
    res.json(saved)
  } catch (err) {
    next(err)
  }
})

costeoMuestrasRouter.post('/test', canConfig, async (_req, res, next) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg)) {
      res.status(400).json({ error: 'Complete host, base de datos, vista, usuario y mapeo de columnas.' })
      return
    }
    if (!cfg.password?.trim()) {
      res.status(400).json({ error: 'Configure la contraseña de conexión SAP.' })
      return
    }
    const result = await testSapBiConnection(cfg)
    if (!result.ok) {
      res.status(502).json({ error: result.message })
      return
    }
    res.json(result)
  } catch (err) {
    next(err)
  }
})

costeoMuestrasRouter.post('/sync', canView, async (_req, res, next) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg)) {
      res.status(400).json({ error: 'Conexión SAP no configurada. Configure la vista en Ajustes.' })
      return
    }
    if (!cfg.password?.trim()) {
      res.status(400).json({ error: 'Contraseña SAP no configurada.' })
      return
    }
    const rows = await querySapBiView(cfg, {})
    cachedRows = rows
    const now = new Date().toISOString()
    await setUltimoSyncCosteo(now)
    res.json({
      ok: true,
      filas: rows.length,
      ultimo_sync: now,
      vista: `${cfg.schema}.${cfg.viewName}`,
    })
  } catch (err) {
    res.status(502).json({ error: `Error al leer la vista SAP: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.get('/datos', canView, async (req, res, next) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg)) {
      res.status(400).json({
        error: 'Conexión SAP no configurada. Abra Configuración y defina la vista de costeo.',
      })
      return
    }

    const cliente = typeof req.query.cliente === 'string' ? req.query.cliente : undefined
    const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined
    const refresh = req.query.refresh === 'true'

    let rows = cachedRows
    const hasFilters = Boolean(cliente?.trim() || desde?.trim() || hasta?.trim())

    if (refresh || !rows || hasFilters) {
      if (!cfg.password?.trim()) {
        res.status(400).json({ error: 'Contraseña SAP no configurada.' })
        return
      }
      rows = await querySapBiView(cfg, { cliente, desde, hasta })
      if (!hasFilters) {
        cachedRows = rows
        const now = new Date().toISOString()
        await setUltimoSyncCosteo(now)
      }
    }

    const ultimo_sync = await getUltimoSyncCosteo()
    const payload = aggregateCosteoMuestras(rows ?? [], {
      vista: `${cfg.schema}.${cfg.viewName}`,
      ultimo_sync,
    })
    res.json(payload)
  } catch (err) {
    res.status(502).json({ error: `Error al consultar SAP: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.get('/vista-columnas', canConfig, async (_req, res, next) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg)) {
      res.status(400).json({ error: 'Complete conexión SAP y nombre de vista.' })
      return
    }
    if (!cfg.password?.trim()) {
      res.status(400).json({ error: 'Contraseña SAP no configurada.' })
      return
    }
    const result = await detectViewColumnMapping(cfg)
    res.json(result)
  } catch (err) {
    res.status(502).json({ error: `No se pudieron leer columnas: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.post('/vista-columnas/aplicar', canConfig, async (_req, res, next) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!cfg.password?.trim()) {
      res.status(400).json({ error: 'Contraseña SAP no configurada.' })
      return
    }
    const { sugerido } = await detectViewColumnMapping(cfg)
    if (!sugerido.cliente || !sugerido.costo) {
      res.status(400).json({
        error: 'No se detectaron columnas de cliente y costo. Revise el mapeo manualmente.',
        sugerido,
      })
      return
    }
    const saved = await saveSapBiCosteoConfig({ columnMapping: sugerido })
    cachedRows = null
    res.json(saved)
  } catch (err) {
    res.status(502).json({ error: (err as Error).message })
  }
})

function parseQueryFilters(req: import('express').Request) {
  const receta = typeof req.query.receta === 'string' ? req.query.receta : undefined
  return {
    cliente: typeof req.query.cliente === 'string' ? req.query.cliente : undefined,
    codigo_cliente: typeof req.query.codigo_cliente === 'string' ? req.query.codigo_cliente : undefined,
    receta,
    recetaExact: req.query.recetaExact !== 'false' && Boolean(receta?.trim()),
    desde: typeof req.query.desde === 'string' ? req.query.desde : undefined,
    hasta: typeof req.query.hasta === 'string' ? req.query.hasta : undefined,
    refresh: req.query.refresh === 'true',
  }
}

function buildVentaSapFilters(f: ReturnType<typeof parseQueryFilters>) {
  const filters: import('../utils/sapBiGenericQuery.js').SapBiGenericFilters = {
    desde: f.desde,
    hasta: f.hasta,
  }
  if (f.codigo_cliente?.trim()) {
    filters.codigo_cliente = f.codigo_cliente.trim()
  } else if (f.cliente?.trim()) {
    filters.cliente = f.cliente.trim()
  }
  if (f.receta?.trim()) {
    filters.receta = f.receta.trim()
    filters.recetaExact = f.recetaExact
  }
  return filters
}

costeoMuestrasRouter.get('/ventas/catalogo', canView, async (req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg) || !cfg.password?.trim()) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }

    const f = parseQueryFilters(req)
    const dateFilters = { desde: f.desde, hasta: f.hasta }

    const rawRecetas = await querySapBiGeneric(cfg, VISTA_VENTA_COSTO, CAMPOS_VENTA_COSTO, dateFilters)
    const recetas = buildRecetaVentaCatalogo(mapVentaMargenRows(rawRecetas))

    const rawClientes = await querySapBiGeneric(
      cfg,
      VISTA_VENTA_COSTO,
      CAMPOS_VENTA_COSTO,
      buildVentaSapFilters({ ...f, codigo_cliente: undefined, cliente: undefined }),
    )
    const clientes = buildClienteCatalogo(mapVentaMargenRows(rawClientes))

    res.json({ clientes, recetas } satisfies import('../utils/costeoMuestrasBi.js').VentaCatalogoPayload)
  } catch (err) {
    res.status(502).json({ error: `Error al cargar catálogo ventas: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.get('/ventas-margen', canView, async (req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg)) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }
    if (!cfg.password?.trim()) {
      res.status(400).json({ error: 'Contraseña SAP no configurada.' })
      return
    }

    const f = parseQueryFilters(req)
    const raw = await querySapBiGeneric(cfg, VISTA_VENTA_COSTO, CAMPOS_VENTA_COSTO, buildVentaSapFilters(f))
    const rows = mapVentaMargenRows(raw)
    const ultimo_sync = await getUltimoSyncCosteo()
    const payload = aggregateVentasMargen(rows, {
      vista: `${cfg.schema}.${VISTA_VENTA_COSTO}`,
      ultimo_sync,
    })
    res.json(payload)
  } catch (err) {
    res.status(502).json({ error: `Error al consultar ventas/margen: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.get('/recetas/catalogo', canView, async (_req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg) || !cfg.password?.trim()) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }
    const fields = await getRecetaCostoFields(cfg)
    const raw = await querySapBiGeneric(cfg, VISTA_RECETA_COSTO, fields, {})
    const catalogo = buildRecetaCatalogo(mapRecetaCostoRows(raw))
    res.json({ catalogo, total: catalogo.length })
  } catch (err) {
    res.status(502).json({ error: `Error al cargar catálogo de recetas: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.get('/recetas/explosion-columnas', canView, async (_req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg) || !cfg.password?.trim()) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }
    clearExplosionFieldsCache()
    const vistas = [VISTA_RECETAS_EXPLOSION, VISTA_RECETAS] as const
    const resultado: Record<string, { columnas: string[]; sugerido: Record<string, string> | null; error?: string }> = {}
    for (const vista of vistas) {
      try {
        const columnas = await listViewColumns(cfg, vista)
        let sugerido: Record<string, string> | null = null
        try {
          sugerido = columnas.length ? suggestExplosionFields(columnas) : null
        } catch (e) {
          resultado[vista] = { columnas, sugerido: null, error: (e as Error).message }
          continue
        }
        resultado[vista] = { columnas, sugerido }
      } catch (e) {
        resultado[vista] = { columnas: [], sugerido: null, error: (e as Error).message }
      }
    }
    res.json(resultado)
  } catch (err) {
    res.status(502).json({ error: (err as Error).message })
  }
})

costeoMuestrasRouter.get('/recetas/detalle', canView, async (req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg) || !cfg.password?.trim()) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }

    const recetaCode = typeof req.query.receta === 'string' ? req.query.receta.trim() : ''
    if (!recetaCode) {
      res.status(400).json({ error: 'Seleccione una receta (parámetro receta).' })
      return
    }

    const costoFields = await getRecetaCostoFields(cfg)
    const [costoRaw, explosion] = await Promise.all([
      querySapBiGeneric(cfg, VISTA_RECETA_COSTO, costoFields, { receta: recetaCode, recetaExact: true }),
      getExplosionFields(cfg),
    ])

    const recetas = buildRecetaCatalogo(mapRecetaCostoRows(costoRaw))
    const receta: RecetaCatalogoItem = recetas[0] ?? {
      receta_code: recetaCode,
      receta_nombre: recetaCode,
      costo: 0,
      flag_costo: '',
    }

    const rawIng = await querySapBiGeneric(cfg, explosion.vista, explosion.fields, {
      receta: recetaCode,
      recetaExact: true,
    })
    const ingredientes = mapIngredienteRows(rawIng)
    const payload = buildRecetaDetallePayload(receta, ingredientes, {
      vista: `${cfg.schema}.${explosion.vista}`,
    })
    res.json(payload)
  } catch (err) {
    const msg = (err as Error).message
    clearExplosionFieldsCache()
    res.status(502).json({ error: `Error al consultar detalle de receta: ${msg}` })
  }
})

costeoMuestrasRouter.get('/ventas-analisis', canView, async (req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg) || !cfg.password?.trim()) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }

    const f = parseQueryFilters(req)
    const recetaFields = await getRecetaCostoFields(cfg)

    const [ventasRaw, recetasRaw] = await Promise.all([
      querySapBiGeneric(cfg, VISTA_VENTA_COSTO, CAMPOS_VENTA_COSTO, buildVentaSapFilters(f)),
      querySapBiGeneric(cfg, VISTA_RECETA_COSTO, recetaFields, {}),
    ])

    const ventas = mapVentaMargenRows(ventasRaw)
    const recetasMap = new Map(
      mapRecetaCostoRows(recetasRaw).map((r) => [r.receta_code, r] as const),
    )
    const ultimo_sync = await getUltimoSyncCosteo()
    const payload = aggregateVentaAnalisis(ventas, recetasMap, {
      vista: `${cfg.schema}.${VISTA_VENTA_COSTO} + ${VISTA_RECETA_COSTO}`,
      ultimo_sync,
    })
    res.json(payload)
  } catch (err) {
    res.status(502).json({ error: `Error en análisis ventas/costos: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.get('/recetas', canView, async (req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg)) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }
    if (!cfg.password?.trim()) {
      res.status(400).json({ error: 'Contraseña SAP no configurada.' })
      return
    }

    const { receta } = parseQueryFilters(req)
    const fields = await getRecetaCostoFields(cfg)
    const raw = await querySapBiGeneric(cfg, VISTA_RECETA_COSTO, fields, { receta })
    const rows = mapRecetaCostoRows(raw)
    const ultimo_sync = await getUltimoSyncCosteo()
    const payload = aggregateRecetasCosto(rows, {
      vista: `${cfg.schema}.${VISTA_RECETA_COSTO}`,
      ultimo_sync,
    })
    res.json(payload)
  } catch (err) {
    const msg = (err as Error).message
    if (/invalid column name/i.test(msg)) {
      clearRecetaCostoFieldsCache()
      try {
        const cfg = await loadSapBiCosteoConfig()
        const columnas = await listViewColumns(cfg, VISTA_RECETA_COSTO)
        res.status(502).json({
          error:
            `Error al consultar costos por receta: ${msg}. `
            + `Columnas en ${VISTA_RECETA_COSTO}: ${columnas.join(', ')}.`,
        })
        return
      } catch {
        // fall through
      }
    }
    res.status(502).json({ error: `Error al consultar costos por receta: ${msg}` })
  }
})

costeoMuestrasRouter.get('/ultimo-sync', canView, async (_req, res, next) => {
  try {
    const fecha = await getUltimoSyncCosteo()
    const cfg = await loadSapBiCosteoConfig()
    res.json({
      fecha,
      vista: cfg.viewName ? `${cfg.schema}.${cfg.viewName}` : '',
      configured: isSapBiConfigured(cfg),
    })
  } catch (err) {
    next(err)
  }
})

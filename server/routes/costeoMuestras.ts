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
  buildRecetasMatriz,
  buildRecetaVentaCatalogo,
  mapIngredienteRows,
  mapProduccionRows,
  mapRecetaCostoIngredienteRows,
  mapRecetaCostoRows,
  mapVentaMargenRows,
  mergeProduccionIntoMatriz,
  type IngredienteRow,
  type RecetaCatalogoItem,
} from '../utils/costeoMuestrasBi.js'
import { querySapBiGeneric } from '../utils/sapBiGenericQuery.js'
import {
  clearExplosionFieldsCache,
  clearProduccionFieldsCache,
  clearRecetaCostoFieldsCache,
  clearVentaCostoFieldsCache,
  getExplosionFields,
  getProduccionFields,
  getRecetaCostoFields,
  getVentaCostoFields,
  refreshProduccionFields,
  refreshRecetaCostoFields,
  suggestExplosionFields,
  suggestRecetaCostoFields,
  VISTA_PRODUCCION,
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
    clearRecetaCostoFieldsCache()
    clearExplosionFieldsCache()
    clearProduccionFieldsCache()
    clearVentaCostoFieldsCache()
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

    const ventaFields = await getVentaCostoFields(cfg)
    const rawRecetas = await querySapBiGeneric(cfg, VISTA_VENTA_COSTO, ventaFields, dateFilters)
    const recetas = buildRecetaVentaCatalogo(mapVentaMargenRows(rawRecetas))

    const rawClientes = await querySapBiGeneric(
      cfg,
      VISTA_VENTA_COSTO,
      ventaFields,
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
    const ventaFields = await getVentaCostoFields(cfg)
    const raw = await querySapBiGeneric(cfg, VISTA_VENTA_COSTO, ventaFields, buildVentaSapFilters(f))
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

costeoMuestrasRouter.get('/recetas/general', canView, async (_req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg) || !cfg.password?.trim()) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }
    // Refresca mapeo para no quedarnos con cache sin cantidad/unidad
    const { campos } = await refreshRecetaCostoFields(cfg)
    const raw = await querySapBiGeneric(cfg, VISTA_RECETA_COSTO, campos, {})
    let payload = buildRecetasMatriz(raw, {
      vista: `${cfg.schema}.${VISTA_RECETA_COSTO}`,
      campos_mapeados: campos,
    })

    try {
      const { campos: camposProd } = await refreshProduccionFields(cfg)
      const prodRaw = await querySapBiGeneric(cfg, VISTA_PRODUCCION, camposProd, {})
      payload = mergeProduccionIntoMatriz(payload, prodRaw, {
        vista_produccion: `${cfg.schema}.${VISTA_PRODUCCION}`,
        campos_produccion: camposProd,
      })
    } catch (prodErr) {
      clearProduccionFieldsCache()
      payload = {
        ...payload,
        produccion_ok: false,
        produccion_error: (prodErr as Error).message,
      }
    }

    res.json(payload)
  } catch (err) {
    clearRecetaCostoFieldsCache()
    res.status(502).json({ error: `Error al cargar matriz de recetas: ${(err as Error).message}` })
  }
})

costeoMuestrasRouter.get('/recetas/costo-columnas', canView, async (_req, res) => {
  try {
    const cfg = await loadSapBiCosteoConfig()
    if (!isSapBiConfigured(cfg) || !cfg.password?.trim()) {
      res.status(400).json({ error: 'Conexión SAP no configurada.' })
      return
    }
    const { columnas, campos } = await refreshRecetaCostoFields(cfg)
    res.json({
      vista: VISTA_RECETA_COSTO,
      columnas,
      sugerido: campos,
      falta_cantidad: !campos.cantidad,
      falta_unidad: !campos.unidad,
    })
  } catch (err) {
    res.status(502).json({ error: (err as Error).message })
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

    const { campos: costoFields } = await refreshRecetaCostoFields(cfg)
    const costoRaw = await querySapBiGeneric(cfg, VISTA_RECETA_COSTO, costoFields, {
      receta: recetaCode,
      recetaExact: true,
    })

    const recetas = buildRecetaCatalogo(mapRecetaCostoRows(costoRaw))
    const receta: RecetaCatalogoItem = recetas[0] ?? {
      receta_code: recetaCode,
      receta_nombre: recetaCode,
      costo: 0,
      flag_costo: '',
    }

    const ingredientes = mapRecetaCostoIngredienteRows(costoRaw)
    const payload = buildRecetaDetallePayload(receta, ingredientes, {
      vista: `${cfg.schema}.${VISTA_RECETA_COSTO}`,
    })
    res.json(payload)
  } catch (err) {
    const msg = (err as Error).message
    clearRecetaCostoFieldsCache()
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
    const [ventaFields, recetaFields] = await Promise.all([
      getVentaCostoFields(cfg),
      getRecetaCostoFields(cfg),
    ])

    const [ventasRaw, recetasRaw] = await Promise.all([
      querySapBiGeneric(cfg, VISTA_VENTA_COSTO, ventaFields, buildVentaSapFilters(f)),
      querySapBiGeneric(cfg, VISTA_RECETA_COSTO, recetaFields, {}),
    ])

    const ventas = mapVentaMargenRows(ventasRaw)
    const recetasMap = new Map(
      buildRecetaCatalogo(mapRecetaCostoRows(recetasRaw)).map((r) => [
        r.receta_code,
        {
          receta_code: r.receta_code,
          receta_nombre: r.receta_nombre,
          costo: r.costo,
          costo_unitario: r.costo,
          flag_costo: r.flag_costo,
          cantidad: 1,
        },
      ] as const),
    )

    const ingredientesPorReceta = new Map<string, IngredienteRow[]>()
    const byCode = new Map<string, Record<string, unknown>[]>()
    for (const row of recetasRaw) {
      const code = String(row.receta_code ?? '').trim()
      if (!code) continue
      const list = byCode.get(code) ?? []
      list.push(row)
      byCode.set(code, list)
    }
    for (const [code, lines] of byCode) {
      ingredientesPorReceta.set(code, mapRecetaCostoIngredienteRows(lines))
    }

    let produccion = mapProduccionRows([])
    let produccion_ok = false
    let produccion_error: string | null = null
    try {
      const prodFields = await getProduccionFields(cfg)
      const prodRaw = await querySapBiGeneric(cfg, VISTA_PRODUCCION, prodFields, {
        receta: f.receta,
        recetaExact: f.recetaExact,
        desde: f.desde,
        hasta: f.hasta,
      })
      produccion = mapProduccionRows(prodRaw)
      produccion_ok = true
    } catch (e) {
      clearProduccionFieldsCache()
      produccion_error = (e as Error).message
    }

    const ultimo_sync = await getUltimoSyncCosteo()
    const payload = aggregateVentaAnalisis(ventas, recetasMap, {
      vista: `${cfg.schema}.${VISTA_VENTA_COSTO} + ${VISTA_RECETA_COSTO}`
        + (produccion_ok ? ` + ${VISTA_PRODUCCION}` : ''),
      ultimo_sync,
      ingredientesPorReceta,
      produccion,
      campos_venta: ventaFields,
      produccion_ok,
      produccion_error,
    })
    res.json(payload)
  } catch (err) {
    clearVentaCostoFieldsCache()
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

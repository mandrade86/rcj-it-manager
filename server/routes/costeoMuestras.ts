import { Router } from 'express'

import { requirePermiso } from '../middleware/requireAuth.js'
import { aggregateCosteoMuestras } from '../utils/costeoMuestrasBi.js'
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

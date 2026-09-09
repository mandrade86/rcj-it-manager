import type { NextFunction, Response } from 'express'
import { Router } from 'express'

import { CostosItClasificacion } from '../db/models/CostosItClasificacion.js'
import { requirePermiso } from '../middleware/requireAuth.js'
import { isSapViewNotFoundError } from '../utils/sapBiQuery.js'
import { CATEGORIAS_IT } from '../utils/costosItCategorize.js'
import { fetchCostosItDashboard } from '../utils/sapCostosItBi.js'
import { fetchCostosItAnalisisCategoria } from '../utils/costosItAnalisisCategoria.js'
import { buildGastosDashboard } from '../utils/gastosItDashboardMensual.js'
import { fetchBudgetItSap } from '../utils/sapBudgetItBi.js'
import { loadGastosItCategorias, ensureGastosItCategorias } from '../utils/gastosItCategorias.js'
import { GastosItCategoriaConfig } from '../db/models/GastosItCategoriaConfig.js'
import { GastosItPresupuesto } from '../db/models/GastosItPresupuesto.js'
import {
  listEmpresasMoneda,
  saveEmpresasMoneda,
  monedaDeEmpresa,
  loadEmpresasMonedaMap,
} from '../utils/gastosItEmpresaMoneda.js'
import { fetchGastosPorCuenta } from '../utils/gastosItCuentaDetalle.js'
import {
  getUltimoSyncCostosIt,
  listCostosItVistasCandidatas,
  loadCostosItConfig,
  refreshCostosItFields,
  resolveCostosItConnection,
  saveCostosItConfig,
  type CostosItConfig,
} from '../utils/sapCostosItConfig.js'
import { costosItFieldsValid } from '../utils/sapCostosItFields.js'

export const costosItRouter = Router()

const canView = requirePermiso('it:gastos:ver')
const canConfig = requirePermiso('it:gastos:config')

function respondCostosItError(err: unknown, res: Response, next: NextFunction): void {
  const msg = err instanceof Error ? err.message : String(err)
  if (isSapViewNotFoundError(err) || /no existe en esquema/i.test(msg)) {
    res.status(502).json({ error: msg })
    return
  }
  if (/Contraseña SAP|Conexión SAP|GEMINI_API_KEY|Ollama|Gemini:|columnas mínimas/i.test(msg)) {
    res.status(400).json({ error: msg })
    return
  }
  next(err)
}

costosItRouter.get('/config', canView, async (_req, res, next) => {
  try {
    const cfg = await loadCostosItConfig()
    const ultimo_sync = await getUltimoSyncCostosIt()
    res.json({ ...cfg, ultimo_sync, categorias: CATEGORIAS_IT })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.put('/config', canConfig, async (req, res, next) => {
  try {
    const body = req.body as Partial<CostosItConfig>
    const saved = await saveCostosItConfig(body)
    res.json(saved)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/vistas', canView, async (_req, res, next) => {
  try {
    const vistas = await listCostosItVistasCandidatas()
    res.json({ vistas })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/vista-columnas', canConfig, async (_req, res, next) => {
  try {
    const resolved = await resolveCostosItConnection()
    const { columnas, fields } = await refreshCostosItFields(resolved)
    res.json({
      columnas,
      fields,
      valido: costosItFieldsValid(fields),
      vista: `${resolved.sapCfg.schema}.${resolved.itCfg.viewName}`,
    })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/dashboard', canView, async (req, res, next) => {
  try {
    const anioBase = typeof req.query.anio_base === 'string' ? Number(req.query.anio_base) : undefined
    const anioComp = typeof req.query.anio_comp === 'string' ? Number(req.query.anio_comp) : undefined
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : undefined
    const empresa = typeof req.query.empresa === 'string' ? req.query.empresa : undefined

    const data = await fetchCostosItDashboard({
      anio_base: Number.isFinite(anioBase) ? anioBase : undefined,
      anio_comp: Number.isFinite(anioComp) ? anioComp : undefined,
      categoria,
      empresa,
    })
    res.json(data)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/analisis-categoria', canView, async (req, res, next) => {
  try {
    const anio = typeof req.query.anio === 'string' ? Number(req.query.anio) : undefined
    const mes = typeof req.query.mes === 'string' ? Number(req.query.mes) : undefined
    const empresa = typeof req.query.empresa === 'string' ? req.query.empresa : undefined
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : undefined

    const data = await fetchCostosItAnalisisCategoria({
      anio: Number.isFinite(anio) ? anio : undefined,
      mes: Number.isFinite(mes) ? mes : undefined,
      empresa,
      categoria,
    })
    res.json(data)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.post('/categorizar-ia', canView, async (_req, res) => {
  res.status(503).json({
    error: 'Categorización con IA desactivada. Se usan reglas automáticas.',
  })
})

costosItRouter.put('/clasificacion/:hash', canView, async (req, res, next) => {
  try {
    const { hash } = req.params
    const categoriaId = typeof req.body?.categoria_id === 'string' ? req.body.categoria_id.trim() : ''
    const subcategoriaId = typeof req.body?.subcategoria_id === 'string' ? req.body.subcategoria_id.trim() : ''
    const categoriaLegacy = typeof req.body?.categoria === 'string' ? req.body.categoria.trim() : ''
    const tipoGasto = typeof req.body?.tipo_gasto === 'string' ? req.body.tipo_gasto : ''

    const categoria = categoriaId && subcategoriaId
      ? `${categoriaId}|${subcategoriaId}`
      : categoriaLegacy

    if (!categoria) {
      res.status(400).json({ error: 'Categoría requerida' })
      return
    }

    const doc = await CostosItClasificacion.findOneAndUpdate(
      { row_hash: hash },
      {
        $set: {
          categoria,
          subcategoria: subcategoriaId || undefined,
          tipo_gasto: tipoGasto || '',
          fuente: 'manual',
          confianza: 1,
          notas: typeof req.body?.notas === 'string' ? req.body.notas : '',
        },
      },
      { upsert: true, new: true },
    ).lean()
    res.json(doc)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/dashboard-gastos', canView, async (req, res, next) => {
  try {
    const anio = typeof req.query.anio === 'string' ? Number(req.query.anio) : undefined
    const mes = typeof req.query.mes === 'string' ? Number(req.query.mes) : undefined
    const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined
    const empresa = typeof req.query.empresa === 'string' ? req.query.empresa : undefined
    const categoria_id = typeof req.query.categoria_id === 'string' ? req.query.categoria_id : undefined
    const comparar_mes_anterior = req.query.comparar_mes_anterior !== 'false'
    const comparar_presupuesto = req.query.comparar_presupuesto !== 'false'

    const data = await buildGastosDashboard({
      anio: Number.isFinite(anio) ? anio : undefined,
      mes: Number.isFinite(mes) ? mes : undefined,
      desde,
      hasta,
      empresa,
      categoria_id,
      comparar_mes_anterior,
      comparar_presupuesto,
    })
    res.json(data)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/categorias-gastos', canView, async (_req, res, next) => {
  try {
    await ensureGastosItCategorias()
    const categorias = await loadGastosItCategorias()
    res.json({ categorias })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.put('/categorias-gastos', canConfig, async (req, res, next) => {
  try {
    const categorias = req.body?.categorias
    if (!Array.isArray(categorias)) {
      res.status(400).json({ error: 'categorias[] requerido' })
      return
    }
    const doc = await GastosItCategoriaConfig.findOneAndUpdate(
      { clave: 'gastos_it_categorias' },
      { $set: { categorias } },
      { upsert: true, new: true },
    ).lean()
    res.json(doc)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/budget-sap', canView, async (req, res, next) => {
  try {
    const anio = typeof req.query.anio === 'string' ? Number(req.query.anio) : undefined
    const mes = typeof req.query.mes === 'string' ? Number(req.query.mes) : undefined
    const busqueda = typeof req.query.busqueda === 'string' ? req.query.busqueda : undefined
    const empresa = typeof req.query.empresa === 'string' ? req.query.empresa : undefined
    const data = await fetchBudgetItSap({
      anio: Number.isFinite(anio) ? anio : undefined,
      mes: Number.isFinite(mes) ? mes : undefined,
      busqueda,
      empresa: empresa && empresa !== 'todas' ? empresa : undefined,
    })
    res.json(data)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/gastos-por-cuenta', canView, async (req, res, next) => {
  try {
    const anio = Number(req.query.anio)
    const mes = req.query.mes != null ? Number(req.query.mes) : undefined
    const empresa = typeof req.query.empresa === 'string' ? req.query.empresa.trim() : ''
    const cuenta = typeof req.query.cuenta === 'string' ? req.query.cuenta.trim() : ''
    if (!Number.isFinite(anio) || !empresa || !cuenta) {
      res.status(400).json({ error: 'anio, empresa y cuenta son requeridos (no hay presupuesto global)' })
      return
    }
    const data = await fetchGastosPorCuenta({
      anio,
      mes: Number.isFinite(mes) ? mes : undefined,
      empresa,
      cuenta,
    })
    res.json(data)
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/empresas-moneda', canView, async (_req, res, next) => {
  try {
    const items = await listEmpresasMoneda()
    res.json({ items })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.put('/empresas-moneda', canConfig, async (req, res, next) => {
  try {
    const { items } = req.body as { items?: Array<{ empresa: string; moneda: string }> }
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items[] requerido' })
      return
    }
    const saved = await saveEmpresasMoneda(items)
    res.json({ items: saved })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/presupuestos/cuentas', canView, async (req, res, next) => {
  try {
    const anio = req.query.anio != null ? Number(req.query.anio) : undefined
    const { listCuentasItDesdeSap } = await import('../utils/gastosItPresupuestoCuentas.js')
    const cuentas = await listCuentasItDesdeSap({ anio: Number.isFinite(anio) ? anio : undefined })
    res.json({ cuentas })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.get('/presupuestos', canView, async (req, res, next) => {
  try {
    const anio = Number(req.query.anio)
    const mes = Number(req.query.mes)
    const empresa = typeof req.query.empresa === 'string' ? req.query.empresa.trim() : ''
    if (!Number.isFinite(anio) || !Number.isFinite(mes)) {
      res.status(400).json({ error: 'anio y mes requeridos' })
      return
    }
    if (!empresa) {
      res.status(400).json({ error: 'empresa requerida (no hay presupuesto global)' })
      return
    }
    const rows = await GastosItPresupuesto.find({
      anio,
      mes,
      empresa,
      cuenta: { $exists: true, $ne: '' },
    }).lean()
    const monedas = await loadEmpresasMonedaMap()
    const moneda = monedaDeEmpresa(monedas, empresa)
    res.json({
      presupuestos: rows.map((r) => ({
        ...r,
        monto: r.monto ?? r.monto_usd ?? 0,
        moneda: r.moneda || moneda,
      })),
      moneda,
      empresa,
    })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

costosItRouter.put('/presupuestos', canConfig, async (req, res, next) => {
  try {
    const { anio, mes, empresa, items } = req.body as {
      anio: number
      mes: number
      empresa: string
      items: Array<{ cuenta: string; cuenta_nombre?: string; monto?: number; monto_usd?: number }>
    }
    const emp = String(empresa ?? '').trim()
    if (!Number.isFinite(anio) || !Number.isFinite(mes) || !Array.isArray(items)) {
      res.status(400).json({ error: 'anio, mes e items requeridos' })
      return
    }
    if (!emp) {
      res.status(400).json({ error: 'empresa requerida (no hay presupuesto global)' })
      return
    }
    const monedas = await loadEmpresasMonedaMap()
    const moneda = monedaDeEmpresa(monedas, emp)
    const ops = items
      .map((item) => {
        const cuenta = String(item.cuenta ?? '').trim()
        if (!cuenta) return null
        const monto = Number(item.monto ?? item.monto_usd) || 0
        return {
          updateOne: {
            filter: { anio, mes, empresa: emp, cuenta },
            update: {
              $set: {
                monto,
                monto_usd: monto,
                moneda,
                cuenta_nombre: String(item.cuenta_nombre ?? '').trim(),
              },
            },
            upsert: true,
          },
        }
      })
      .filter(Boolean)
    if (ops.length) await GastosItPresupuesto.bulkWrite(ops)
    // Eliminar cuentas de esta empresa/mes que ya no vienen (monto 0 no se envía)
    const cuentasKeep = new Set(
      items.map((i) => String(i.cuenta ?? '').trim()).filter(Boolean),
    )
    await GastosItPresupuesto.deleteMany({
      anio,
      mes,
      empresa: emp,
      cuenta: { $nin: [...cuentasKeep] },
    })
    const rows = await GastosItPresupuesto.find({
      anio,
      mes,
      empresa: emp,
      cuenta: { $exists: true, $ne: '' },
    }).lean()
    res.json({
      presupuestos: rows.map((r) => ({
        ...r,
        monto: r.monto ?? r.monto_usd ?? 0,
        moneda: r.moneda || moneda,
      })),
      moneda,
      empresa: emp,
    })
  } catch (err) {
    respondCostosItError(err, res, next)
  }
})

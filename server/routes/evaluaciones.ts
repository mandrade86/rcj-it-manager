import { Router } from 'express'
import mongoose from 'mongoose'

import { Colaborador } from '../db/models/Colaborador.js'
import { Config } from '../db/models/Config.js'
import { Evaluacion } from '../db/models/Evaluacion.js'
import { PerfilPuesto } from '../db/models/PerfilPuesto.js'
import { calcularResultadoGlobal } from '../utils/resultadoEvaluacion.js'

export const evaluacionesRouter = Router()

const RUBRICA_CLAVE = 'rubrica_desarrolladores_json'

const PUESTOS_DESARROLLO = ['IT-04A', 'IT-04B', 'IT-04C']

function rubricaClaveParaPuesto(codigo_puesto: string): string {
  if (PUESTOS_DESARROLLO.includes(codigo_puesto)) return RUBRICA_CLAVE
  const clave = `rubrica_${codigo_puesto.replace(/[^a-zA-Z0-9]/g, '_')}_json`
  return clave
}

type RubricaItem = { categoria: string; criterio: string; descripcion?: string }

/** Lee la rúbrica legacy guardada en Config por código de puesto. */
async function rubricaLegacyPorPuesto(codigo_puesto: string): Promise<RubricaItem[] | null> {
  const clave = rubricaClaveParaPuesto(codigo_puesto)
  let doc = await Config.findOne({ clave }).lean()
  if (!doc?.valor) doc = await Config.findOne({ clave: RUBRICA_CLAVE }).lean()
  if (!doc?.valor) return null
  try {
    return JSON.parse(doc.valor) as RubricaItem[]
  } catch {
    return null
  }
}

/**
 * Resuelve la rúbrica aplicable a un colaborador.
 * Orden de búsqueda:
 *   1. Rúbrica embebida en su `perfil_puesto_id` (PerfilPuesto.rubrica_criterios).
 *   2. Rúbrica legacy por `codigo_puesto` (Config).
 *   3. Rúbrica de desarrolladores por defecto.
 */
evaluacionesRouter.get('/rubrica-colaborador/:colaborador_id', async (req, res, next) => {
  try {
    const { colaborador_id } = req.params
    if (!mongoose.isValidObjectId(colaborador_id)) {
      res.status(400).json({ error: 'colaborador_id inválido' })
      return
    }
    const col = await Colaborador.findById(colaborador_id)
      .select('codigo_puesto perfil_puesto_id nombre')
      .lean()
    if (!col) { res.status(404).json({ error: 'Colaborador no encontrado' }); return }

    // 1. Perfil de puesto vinculado
    if (col.perfil_puesto_id) {
      const perfil = await PerfilPuesto.findById(col.perfil_puesto_id)
        .select('codigo titulo rubrica_criterios')
        .lean()
      if (perfil && Array.isArray(perfil.rubrica_criterios) && perfil.rubrica_criterios.length > 0) {
        res.json({
          fuente: 'perfil',
          perfil_id: perfil._id,
          perfil_codigo: perfil.codigo,
          perfil_titulo: perfil.titulo,
          criterios: perfil.rubrica_criterios,
        })
        return
      }
    }

    // 2. Legacy por codigo_puesto
    const legacy = await rubricaLegacyPorPuesto(col.codigo_puesto)
    if (legacy && legacy.length > 0) {
      res.json({
        fuente: 'legacy_puesto',
        codigo_puesto: col.codigo_puesto,
        criterios: legacy,
      })
      return
    }

    res.status(404).json({ error: 'No hay rúbrica configurada para este colaborador' })
  } catch (err) {
    next(err)
  }
})

evaluacionesRouter.get('/rubrica-desarrollo', async (_req, res, next) => {
  try {
    const doc = await Config.findOne({ clave: RUBRICA_CLAVE }).lean()
    if (!doc?.valor) {
      res.status(404).json({ error: 'Rúbrica no configurada en el sistema' })
      return
    }
    const rows = JSON.parse(doc.valor) as { categoria: string; criterio: string }[]
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

/** GET /api/evaluaciones/rubrica/:codigo_puesto — rúbrica para un puesto específico */
evaluacionesRouter.get('/rubrica/:codigo_puesto', async (req, res, next) => {
  try {
    const { codigo_puesto } = req.params
    const clave = rubricaClaveParaPuesto(codigo_puesto)
    let doc = await Config.findOne({ clave }).lean()
    if (!doc?.valor) {
      doc = await Config.findOne({ clave: RUBRICA_CLAVE }).lean()
    }
    if (!doc?.valor) {
      res.status(404).json({ error: 'Rúbrica no configurada para este puesto' })
      return
    }
    const rows = JSON.parse(doc.valor) as { categoria: string; criterio: string }[]
    res.json({ codigo_puesto, clave, criterios: rows })
  } catch (err) {
    next(err)
  }
})

/** PUT /api/evaluaciones/rubrica/:codigo_puesto — guardar/actualizar rúbrica de un puesto */
evaluacionesRouter.put('/rubrica/:codigo_puesto', async (req, res, next) => {
  try {
    const { codigo_puesto } = req.params
    const { criterios } = req.body as { criterios?: { categoria: string; criterio: string }[] }
    if (!Array.isArray(criterios) || criterios.length === 0) {
      res.status(400).json({ error: 'criterios debe ser un arreglo no vacío' })
      return
    }
    const clave = rubricaClaveParaPuesto(codigo_puesto)
    await Config.findOneAndUpdate(
      { clave },
      { clave, valor: JSON.stringify(criterios) },
      { upsert: true },
    )
    res.json({ codigo_puesto, clave, criterios })
  } catch (err) {
    next(err)
  }
})

evaluacionesRouter.get('/', async (req, res, next) => {
  try {
    const { colaborador_id, tipo } = req.query
    if (typeof colaborador_id !== 'string' || !mongoose.isValidObjectId(colaborador_id)) {
      res.status(400).json({ error: 'Query colaborador_id inválido o ausente' })
      return
    }
    const filter: Record<string, unknown> = { colaborador_id }
    if (tipo === 'autoevaluacion' || tipo === 'jefe') filter.tipo = tipo
    const rows = await Evaluacion.find(filter)
      .sort({ fecha: -1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

evaluacionesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await Evaluacion.findById(id).lean()
    if (!doc) {
      res.status(404).json({ error: 'Evaluación no encontrada' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

const CALIFS_VALIDAS = ['No cumple', 'En desarrollo', 'Cumple', 'Supera'] as const

/**
 * Normalizes the criteria array from the request body.
 * Uses embedded categoria/criterio from each row (not from template) so
 * evaluations remain valid even when the rubric template changes later.
 */
function normalizarCriterios(
  body: { criterios?: unknown[] },
): Array<{
  categoria: string
  criterio: string
  calificacion: string
  comentario?: string
  accion_mejora?: string
}> {
  const incoming = Array.isArray(body.criterios) ? body.criterios : []
  if (incoming.length === 0) {
    const err = new Error('Se requiere al menos un criterio')
    ;(err as { status?: number }).status = 400
    throw err
  }
  return incoming.map((item, i) => {
    const row = item as Record<string, unknown>
    const cal = row?.calificacion
    if (typeof cal !== 'string' || !CALIFS_VALIDAS.includes(cal as (typeof CALIFS_VALIDAS)[number])) {
      const err = new Error(`Calificación inválida en criterio ${i + 1}`)
      ;(err as { status?: number }).status = 400
      throw err
    }
    return {
      categoria: typeof row?.categoria === 'string' ? row.categoria : '',
      criterio: typeof row?.criterio === 'string' ? row.criterio : '',
      calificacion: cal,
      comentario: typeof row?.comentario === 'string' ? row.comentario : '',
      accion_mejora: typeof row?.accion_mejora === 'string' ? row.accion_mejora : '',
    }
  })
}

evaluacionesRouter.post('/', async (req, res, next) => {
  try {
    if (!req.body?.colaborador_id || !mongoose.isValidObjectId(req.body.colaborador_id)) {
      res.status(400).json({ error: 'colaborador_id inválido' })
      return
    }
    const criterios = normalizarCriterios(req.body)
    const resultado_global = calcularResultadoGlobal(criterios)
    const f = req.body.firmas as Record<string, boolean> | undefined
    const tipoIn = typeof req.body.tipo === 'string' ? req.body.tipo : ''
    const tipo = tipoIn === 'autoevaluacion' ? 'autoevaluacion' : 'jefe'
    const doc = await Evaluacion.create({
      colaborador_id: req.body.colaborador_id,
      tipo,
      fecha: req.body.fecha ? new Date(String(req.body.fecha)) : new Date(),
      evaluado_por: req.body.evaluado_por,
      nivel_actual: req.body.nivel_actual,
      decision: req.body.decision,
      comentarios: req.body.comentarios,
      firmas: {
        colaborador: Boolean(f?.colaborador),
        coordinador: Boolean(f?.coordinador),
        jefe: Boolean(f?.jefe),
        rrhh: Boolean(f?.rrhh),
      },
      criterios,
      resultado_global,
    })
    res.status(201).json(doc)
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 400) {
      res.status(400).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

evaluacionesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const exists = await Evaluacion.findById(id).select('_id').lean()
    if (!exists) {
      res.status(404).json({ error: 'Evaluación no encontrada' })
      return
    }
    const criterios = normalizarCriterios(req.body)
    const resultado_global = calcularResultadoGlobal(criterios)
    const f = req.body.firmas as Record<string, boolean> | undefined
    const payload: Record<string, unknown> = {
      fecha: req.body.fecha ? new Date(String(req.body.fecha)) : undefined,
      evaluado_por: req.body.evaluado_por,
      nivel_actual: req.body.nivel_actual,
      decision: req.body.decision,
      comentarios: req.body.comentarios,
      criterios,
      resultado_global,
    }
    if (req.body.tipo === 'autoevaluacion' || req.body.tipo === 'jefe') {
      payload.tipo = req.body.tipo
    }
    if (f) {
      payload.firmas = {
        colaborador: Boolean(f.colaborador),
        coordinador: Boolean(f.coordinador),
        jefe: Boolean(f.jefe),
        rrhh: Boolean(f.rrhh),
      }
    }
    for (const k of Object.keys(payload)) {
      if (payload[k] === undefined) delete payload[k]
    }
    const doc = await Evaluacion.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    }).lean()
    res.json(doc)
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 400) {
      res.status(400).json({ error: (err as Error).message })
      return
    }
    next(err)
  }
})

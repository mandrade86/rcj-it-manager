import { Router } from 'express'
import mongoose from 'mongoose'

import { Colaborador } from '../db/models/Colaborador.js'
import { EvaluacionKPI } from '../db/models/EvaluacionKPI.js'
import { KPI } from '../db/models/KPI.js'
import { PerfilPuesto } from '../db/models/PerfilPuesto.js'
import { calcPct, ultimoRegistro } from '../utils/kpiPct.js'

export const evaluacionesKpiRouter = Router()

function nivelDeScore(score: number): 'No cumple' | 'Parcial' | 'Cumple' | 'Supera' {
  if (score >= 110) return 'Supera'
  if (score >= 85) return 'Cumple'
  if (score >= 60) return 'Parcial'
  return 'No cumple'
}

/**
 * GET /api/evaluaciones-kpi/template/:colaborador_id
 *
 * Devuelve el "esqueleto" de la evaluación basado en el PerfilPuesto del
 * colaborador. Para cada KPI configurado por el admin trae:
 *   - meta, unidad, nombre, eje, peso
 *   - último valor registrado
 *   - cumplimiento sugerido (calculado del último registro)
 */
evaluacionesKpiRouter.get('/template/:colaborador_id', async (req, res, next) => {
  try {
    const { colaborador_id } = req.params
    if (!mongoose.isValidObjectId(colaborador_id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const colab = await Colaborador.findById(colaborador_id)
      .select('_id nombre puesto codigo_puesto perfil_puesto_id')
      .lean()
    if (!colab) {
      res.status(404).json({ error: 'Colaborador no encontrado' })
      return
    }
    if (!colab.perfil_puesto_id) {
      res.status(400).json({
        error: 'El colaborador no tiene un perfil de puesto asignado. Asígnalo en su ficha antes de evaluarlo por KPIs.',
      })
      return
    }
    const perfil = await PerfilPuesto.findById(colab.perfil_puesto_id)
      .select('_id codigo titulo kpis_evaluacion')
      .lean()
    if (!perfil) {
      res.status(404).json({ error: 'Perfil de puesto del colaborador no encontrado' })
      return
    }
    const lista = perfil.kpis_evaluacion ?? []
    if (lista.length === 0) {
      res.status(400).json({
        error: 'El administrador no ha configurado KPIs de evaluación para este perfil de puesto.',
        perfil: { _id: perfil._id, codigo: perfil.codigo, titulo: perfil.titulo },
      })
      return
    }
    const kpiIds = lista.map((it: { kpi_id: unknown }) => it.kpi_id as mongoose.Types.ObjectId)
    const kpis = await KPI.find({ _id: { $in: kpiIds } }).lean()
    const byId = new Map(kpis.map((k) => [String(k._id), k]))

    const items = lista.map((it: { kpi_id: unknown; peso: number; descripcion?: string }) => {
      const kpi = byId.get(String(it.kpi_id))
      const ult = kpi ? ultimoRegistro(kpi as Parameters<typeof ultimoRegistro>[0]) : null
      const valor = ult?.valor ?? null
      const pct = valor != null
        ? calcPct(Number(valor), kpi?.meta as string | undefined, kpi?.unidad as string | undefined, kpi?.nombre as string | undefined)
        : 0
      return {
        kpi_id: String(it.kpi_id),
        kpi_nombre: kpi?.nombre ?? '(KPI eliminado)',
        kpi_eje: kpi?.eje ?? '',
        kpi_meta: kpi?.meta ?? '',
        kpi_unidad: kpi?.unidad ?? '',
        kpi_frecuencia: kpi?.frecuencia ?? '',
        kpi_descripcion: kpi?.descripcion ?? '',
        descripcion: it.descripcion ?? '',
        peso: it.peso,
        ultimo_valor: valor,
        ultimo_fecha: ult?.fecha ?? null,
        valor_observado_sugerido: valor,
        cumplimiento_sugerido: pct,
        comentario: '',
      }
    })

    const totalPeso = items.reduce((acc, it) => acc + (Number(it.peso) || 0), 0)
    const scoreSugerido = totalPeso > 0
      ? Math.round(items.reduce((acc, it) => acc + it.cumplimiento_sugerido * it.peso, 0) / totalPeso)
      : 0

    res.json({
      colaborador: {
        _id: colab._id,
        nombre: colab.nombre,
        puesto: colab.puesto,
        codigo_puesto: colab.codigo_puesto,
      },
      perfil: {
        _id: perfil._id,
        codigo: perfil.codigo,
        titulo: perfil.titulo,
      },
      items,
      total_peso: totalPeso,
      score_sugerido: scoreSugerido,
      nivel_sugerido: nivelDeScore(scoreSugerido),
    })
  } catch (err) {
    next(err)
  }
})

/** GET /api/evaluaciones-kpi/colaborador/:colaborador_id?tipo=autoevaluacion|jefe — historial */
evaluacionesKpiRouter.get('/colaborador/:colaborador_id', async (req, res, next) => {
  try {
    const { colaborador_id } = req.params
    if (!mongoose.isValidObjectId(colaborador_id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const { tipo } = req.query
    const filter: Record<string, unknown> = { colaborador_id }
    if (tipo === 'autoevaluacion' || tipo === 'jefe') filter.tipo = tipo
    const rows = await EvaluacionKPI.find(filter)
      .sort({ fecha: -1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

evaluacionesKpiRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await EvaluacionKPI.findById(id).lean()
    if (!doc) {
      res.status(404).json({ error: 'Evaluación no encontrada' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/evaluaciones-kpi
 * Body: {
 *   colaborador_id, fecha, periodo?, evaluado_por?,
 *   items: [{ kpi_id, kpi_nombre, kpi_eje?, kpi_meta?, kpi_unidad?,
 *             peso, valor_observado?, cumplimiento_pct, comentario? }],
 *   decision?, comentarios?, firmas?
 * }
 * Recalcula score_global = Σ(cumplimiento_pct * peso) / Σ(peso)
 */
evaluacionesKpiRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>
    const colaborador_id = typeof body.colaborador_id === 'string' ? body.colaborador_id : ''
    if (!mongoose.isValidObjectId(colaborador_id)) {
      res.status(400).json({ error: 'colaborador_id inválido' })
      return
    }
    if (!body.fecha) {
      res.status(400).json({ error: 'fecha es obligatoria' })
      return
    }
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Debes incluir al menos un item' })
      return
    }
    const items = rawItems.map((it) => {
      const r = it as Record<string, unknown>
      return {
        kpi_id: typeof r.kpi_id === 'string' && mongoose.isValidObjectId(r.kpi_id)
          ? new mongoose.Types.ObjectId(r.kpi_id) : undefined,
        kpi_nombre: typeof r.kpi_nombre === 'string' ? r.kpi_nombre : '',
        kpi_eje: typeof r.kpi_eje === 'string' ? r.kpi_eje : '',
        kpi_meta: typeof r.kpi_meta === 'string' ? r.kpi_meta : '',
        kpi_unidad: typeof r.kpi_unidad === 'string' ? r.kpi_unidad : '',
        peso: Number(r.peso) || 0,
        valor_observado: r.valor_observado === null || r.valor_observado === undefined || r.valor_observado === ''
          ? null
          : Number(r.valor_observado),
        cumplimiento_pct: Number(r.cumplimiento_pct) || 0,
        comentario: typeof r.comentario === 'string' ? r.comentario : '',
      }
    })

    const totalPeso = items.reduce((acc, it) => acc + it.peso, 0)
    const score = totalPeso > 0
      ? Math.round((items.reduce((acc, it) => acc + it.cumplimiento_pct * it.peso, 0) / totalPeso) * 100) / 100
      : 0

    const colab = await Colaborador.findById(colaborador_id).select('perfil_puesto_id').lean()

    const fecha = new Date(String(body.fecha))
    if (Number.isNaN(fecha.getTime())) {
      res.status(400).json({ error: 'Fecha inválida' })
      return
    }

    const firmas = body.firmas && typeof body.firmas === 'object' ? body.firmas as Record<string, unknown> : {}
    const tipo = body.tipo === 'autoevaluacion' ? 'autoevaluacion' : 'jefe'
    const doc = await EvaluacionKPI.create({
      colaborador_id,
      perfil_puesto_id: colab?.perfil_puesto_id ?? null,
      tipo,
      fecha,
      periodo: typeof body.periodo === 'string' ? body.periodo : '',
      evaluado_por: typeof body.evaluado_por === 'string' ? body.evaluado_por : '',
      items,
      score_global: score,
      nivel_cumplimiento: nivelDeScore(score),
      decision: typeof body.decision === 'string' ? body.decision : 'Continuar',
      comentarios: typeof body.comentarios === 'string' ? body.comentarios : '',
      firmas: {
        colaborador: Boolean(firmas.colaborador),
        coordinador: Boolean(firmas.coordinador),
        jefe: Boolean(firmas.jefe),
        rrhh: Boolean(firmas.rrhh),
      },
    })
    res.status(201).json(doc.toObject())
  } catch (err) {
    next(err)
  }
})

evaluacionesKpiRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const body = req.body as Record<string, unknown>
    const $set: Record<string, unknown> = {}
    if (body.fecha) {
      const f = new Date(String(body.fecha))
      if (!Number.isNaN(f.getTime())) $set.fecha = f
    }
    if (typeof body.periodo === 'string') $set.periodo = body.periodo
    if (typeof body.evaluado_por === 'string') $set.evaluado_por = body.evaluado_por
    if (typeof body.decision === 'string') $set.decision = body.decision
    if (typeof body.comentarios === 'string') $set.comentarios = body.comentarios
    if (body.tipo === 'autoevaluacion' || body.tipo === 'jefe') $set.tipo = body.tipo
    if (body.firmas && typeof body.firmas === 'object') {
      const f = body.firmas as Record<string, unknown>
      $set.firmas = {
        colaborador: Boolean(f.colaborador),
        coordinador: Boolean(f.coordinador),
        jefe: Boolean(f.jefe),
        rrhh: Boolean(f.rrhh),
      }
    }
    if (Array.isArray(body.items)) {
      const items = body.items.map((it) => {
        const r = it as Record<string, unknown>
        return {
          kpi_id: typeof r.kpi_id === 'string' && mongoose.isValidObjectId(r.kpi_id)
            ? new mongoose.Types.ObjectId(r.kpi_id) : undefined,
          kpi_nombre: typeof r.kpi_nombre === 'string' ? r.kpi_nombre : '',
          kpi_eje: typeof r.kpi_eje === 'string' ? r.kpi_eje : '',
          kpi_meta: typeof r.kpi_meta === 'string' ? r.kpi_meta : '',
          kpi_unidad: typeof r.kpi_unidad === 'string' ? r.kpi_unidad : '',
          peso: Number(r.peso) || 0,
          valor_observado: r.valor_observado == null || r.valor_observado === ''
            ? null
            : Number(r.valor_observado),
          cumplimiento_pct: Number(r.cumplimiento_pct) || 0,
          comentario: typeof r.comentario === 'string' ? r.comentario : '',
        }
      })
      const total = items.reduce((acc, it) => acc + it.peso, 0)
      const score = total > 0
        ? Math.round((items.reduce((acc, it) => acc + it.cumplimiento_pct * it.peso, 0) / total) * 100) / 100
        : 0
      $set.items = items
      $set.score_global = score
      $set.nivel_cumplimiento = nivelDeScore(score)
    }
    const doc = await EvaluacionKPI.findByIdAndUpdate(id, { $set }, { new: true }).lean()
    if (!doc) {
      res.status(404).json({ error: 'Evaluación no encontrada' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

evaluacionesKpiRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const doc = await EvaluacionKPI.findByIdAndDelete(id).lean()
    if (!doc) {
      res.status(404).json({ error: 'Evaluación no encontrada' })
      return
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

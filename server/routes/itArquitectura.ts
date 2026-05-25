import { Router } from 'express'
import mongoose from 'mongoose'

import { ApiEndpointIT } from '../db/models/ApiEndpointIT.js'
import { ChecklistItemIT } from '../db/models/ChecklistItemIT.js'
import { DeudaTecnica } from '../db/models/DeudaTecnica.js'
import { SistemaIT } from '../db/models/SistemaIT.js'
import { requirePermiso } from '../middleware/requireAuth.js'
import { buildDeudaJiraSugerencia } from '../utils/deudaTecnicaJira.js'
import { applyJiraSnapshotToDeuda, buildJiraStatusResumen, syncDeudaTecnicaFromJira } from '../utils/deudaJiraSync.js'
import { createJiraIssue, fetchJiraIssueSnapshot, getJiraConfig } from '../utils/jiraClient.js'

export const itArquitecturaRouter = Router()

const canView = requirePermiso('it:arquitectura:ver')
const canEdit = requirePermiso('it:arquitectura:editar')

itArquitecturaRouter.get('/sistemas', canView, async (_req, res, next) => {
  try {
    const items = await SistemaIT.find({ activo: true }).sort({ orden: 1, nombre: 1 }).lean()
    res.json({ success: true, data: items })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.post('/sistemas', canEdit, async (req, res, next) => {
  try {
    const item = await SistemaIT.create(req.body)
    res.status(201).json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.put('/sistemas/:id', canEdit, async (req, res, next) => {
  try {
    const item = await SistemaIT.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!item) {
      res.status(404).json({ success: false, message: 'Sistema no encontrado' })
      return
    }
    res.json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.delete('/sistemas/:id', canEdit, async (req, res, next) => {
  try {
    await SistemaIT.findByIdAndUpdate(req.params.id, { activo: false })
    res.json({ success: true, message: 'Sistema desactivado' })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.get('/deuda-tecnica/jira/config', canView, async (_req, res) => {
  const cfg = getJiraConfig()
  res.json({
    success: true,
    data: {
      enabled: cfg.enabled,
      baseUrl: cfg.enabled ? cfg.baseUrl : null,
      projectKey: cfg.projectKey,
      issueType: cfg.issueType,
    },
  })
})

itArquitecturaRouter.post('/deuda-tecnica/jira/sync', canView, async (_req, res, next) => {
  try {
    const cfg = getJiraConfig()
    if (!cfg.enabled) {
      res.status(503).json({ success: false, message: 'Jira no está configurado' })
      return
    }
    const syncResult = await syncDeudaTecnicaFromJira()
    const items = await DeudaTecnica.find().sort({ urgencia: -1 }).lean()
    res.json({
      success: true,
      data: {
        sync: syncResult,
        resumen: buildJiraStatusResumen(items),
        items,
      },
    })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.post('/deuda-tecnica/:id/jira/sync', canView, async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' })
      return
    }
    const cfg = getJiraConfig()
    if (!cfg.enabled) {
      res.status(503).json({ success: false, message: 'Jira no está configurado' })
      return
    }
    const syncResult = await syncDeudaTecnicaFromJira(id)
    const item = await DeudaTecnica.findById(id).lean()
    if (!item) {
      res.status(404).json({ success: false, message: 'Item no encontrado' })
      return
    }
    res.json({ success: true, data: { sync: syncResult, item } })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.get('/deuda-tecnica/:id/jira/sugerencia', canView, async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' })
      return
    }
    const item = await DeudaTecnica.findById(id).lean()
    if (!item) {
      res.status(404).json({ success: false, message: 'Item no encontrado' })
      return
    }
    const sugerencia = buildDeudaJiraSugerencia(item)
    res.json({ success: true, data: sugerencia })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.post('/deuda-tecnica/:id/jira', canEdit, async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'ID inválido' })
      return
    }
    const item = await DeudaTecnica.findById(id)
    if (!item) {
      res.status(404).json({ success: false, message: 'Item no encontrado' })
      return
    }
    if (item.jira_issue_key) {
      res.status(409).json({
        success: false,
        message: `Ya vinculado a ${item.jira_issue_key}`,
        data: {
          jira_issue_key: item.jira_issue_key,
          jira_issue_url: item.jira_issue_url,
        },
      })
      return
    }

    const body = req.body as {
      summary?: string
      usar_sugerencia?: boolean
      que_hacer_extra?: string[]
      que_aplicar_extra?: string[]
    }

    const sugerencia = buildDeudaJiraSugerencia(item)
    const payload = { ...sugerencia.createPayload }

    if (body.summary?.trim()) {
      payload.summary = body.summary.trim().slice(0, 255)
    }

    if (body.usar_sugerencia === false) {
      payload.descriptionAdf = sugerencia.createPayload.descriptionAdf
    } else if (body.que_hacer_extra?.length || body.que_aplicar_extra?.length) {
      const { buildJiraAdf: adf } = await import('../utils/jiraClient.js')
      const qh = [...sugerencia.que_hacer, ...(body.que_hacer_extra ?? [])]
      const qa = [...sugerencia.que_aplicar, ...(body.que_aplicar_extra ?? [])]
      payload.descriptionAdf = adf([
        {
          heading: 'Contexto',
          text: item.descripcion || `Deuda técnica — ${item.sistema}`,
        },
        { heading: 'Qué hacer', bullets: qh },
        { heading: 'Qué aplicar', bullets: qa },
      ])
    }

    const created = await createJiraIssue(payload)
    item.jira_issue_key = created.key
    item.jira_issue_url = created.url
    item.jira_issue_id = created.id
    item.jira_created_at = new Date()
    if (item.estado === 'abierta') {
      item.estado = 'en_progreso'
    }
    const snap = await fetchJiraIssueSnapshot(created.key)
    if (snap) {
      await applyJiraSnapshotToDeuda(item, snap)
    }
    await item.save()

    const full = await DeudaTecnica.findById(id).lean()
    res.status(201).json({
      success: true,
      data: { deuda: full, jira: created, sugerencia },
    })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.get('/deuda-tecnica', canView, async (req, res, next) => {
  try {
    const items = await DeudaTecnica.find().sort({ urgencia: -1 }).lean()
    const cfg = getJiraConfig()
    res.json({
      success: true,
      data: items,
      jira: cfg.enabled
        ? {
            enabled: true,
            resumen: buildJiraStatusResumen(items),
          }
        : { enabled: false },
    })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.post('/deuda-tecnica', canEdit, async (req, res, next) => {
  try {
    const user = req.user!
    const item = await DeudaTecnica.create({
      ...req.body,
      creado_por_id: user._id,
      creado_por_nombre: user.nombre,
    })
    res.status(201).json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.put('/deuda-tecnica/:id', canEdit, async (req, res, next) => {
  try {
    const item = await DeudaTecnica.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!item) {
      res.status(404).json({ success: false, message: 'Item no encontrado' })
      return
    }
    res.json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.delete('/deuda-tecnica/:id', canEdit, async (req, res, next) => {
  try {
    await DeudaTecnica.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Item eliminado' })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.get('/endpoints', canView, async (_req, res, next) => {
  try {
    const items = await ApiEndpointIT.find({ activo: true }).sort({ grupo: 1, orden: 1 }).lean()
    res.json({ success: true, data: items })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.post('/endpoints', canEdit, async (req, res, next) => {
  try {
    const item = await ApiEndpointIT.create(req.body)
    res.status(201).json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.put('/endpoints/:id', canEdit, async (req, res, next) => {
  try {
    const item = await ApiEndpointIT.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!item) {
      res.status(404).json({ success: false, message: 'Endpoint no encontrado' })
      return
    }
    res.json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.delete('/endpoints/:id', canEdit, async (req, res, next) => {
  try {
    await ApiEndpointIT.findByIdAndUpdate(req.params.id, { activo: false })
    res.json({ success: true, message: 'Endpoint desactivado' })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.get('/checklist-items', canView, async (_req, res, next) => {
  try {
    const items = await ChecklistItemIT.find({ activo: true })
      .sort({ categoria: 1, orden: 1 })
      .lean()
    res.json({ success: true, data: items })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.post('/checklist-items', canEdit, async (req, res, next) => {
  try {
    const item = await ChecklistItemIT.create(req.body)
    res.status(201).json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.put('/checklist-items/:id', canEdit, async (req, res, next) => {
  try {
    const item = await ChecklistItemIT.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!item) {
      res.status(404).json({ success: false, message: 'Item no encontrado' })
      return
    }
    res.json({ success: true, data: item })
  } catch (err) {
    next(err)
  }
})

itArquitecturaRouter.delete('/checklist-items/:id', canEdit, async (req, res, next) => {
  try {
    await ChecklistItemIT.findByIdAndUpdate(req.params.id, { activo: false })
    res.json({ success: true, message: 'Item desactivado' })
  } catch (err) {
    next(err)
  }
})

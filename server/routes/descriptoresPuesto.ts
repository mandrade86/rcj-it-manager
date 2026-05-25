import { Router } from 'express'

import { DescriptorPuesto } from '../db/models/DescriptorPuesto.js'

export const descriptoresPuestoRouter = Router()

descriptoresPuestoRouter.get('/:codigo_puesto', async (req, res, next) => {
  try {
    const { codigo_puesto } = req.params
    const doc = await DescriptorPuesto.findOne({ codigo_puesto }).lean()
    if (!doc) {
      res.status(404).json({ error: 'Descriptor no configurado para este puesto' })
      return
    }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

descriptoresPuestoRouter.put('/:codigo_puesto', async (req, res, next) => {
  try {
    const { codigo_puesto } = req.params
    const { _id, __v, createdAt, updatedAt, codigo_puesto: _cp, ...rest } =
      req.body as Record<string, unknown>
    void _id; void __v; void createdAt; void updatedAt; void _cp
    const doc = await DescriptorPuesto.findOneAndUpdate(
      { codigo_puesto },
      { ...rest, codigo_puesto },
      { new: true, runValidators: true, upsert: true },
    ).lean()
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

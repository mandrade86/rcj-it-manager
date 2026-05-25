import { Router } from 'express'

import {
  clearEhrToken,
  getEhrAuthStatus,
  loginEhr,
  saveEhrAuthConfig,
} from '../utils/ehrAuth.js'

export const ehrRouter = Router()

/** GET /api/ehr/auth — estado de credenciales (sin contraseña ni token). */
ehrRouter.get('/auth', async (_req, res, next) => {
  try {
    const status = await getEhrAuthStatus()
    res.json(status)
  } catch (err) {
    next(err)
  }
})

/** PUT /api/ehr/auth — guarda URL de login, usuario y opcionalmente contraseña. */
ehrRouter.put('/auth', async (req, res, next) => {
  try {
    const { loginUrl, username, password } = req.body as {
      loginUrl?: string
      username?: string
      password?: string
    }
    await saveEhrAuthConfig({ loginUrl, username, password })
    const status = await getEhrAuthStatus()
    res.json(status)
  } catch (err) {
    next(err)
  }
})

/** POST /api/ehr/auth/login — prueba login y guarda token. */
ehrRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { loginUrl, username, password } = req.body as {
      loginUrl?: string
      username?: string
      password?: string
    }
    if (loginUrl !== undefined || username !== undefined || password !== undefined) {
      await saveEhrAuthConfig({ loginUrl, username, password })
    }
    await clearEhrToken()
    const token = await loginEhr(true)
    const status = await getEhrAuthStatus()
    res.json({
      ok: true,
      message: 'Sesión EHR iniciada correctamente.',
      tokenPreview: `${token.slice(0, 12)}…`,
      ...status,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al iniciar sesión en el EHR'
    res.status(400).json({ error: msg })
  }
})

/** POST /api/ehr/auth/logout — borra token cacheado. */
ehrRouter.post('/auth/logout', async (_req, res, next) => {
  try {
    await clearEhrToken()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

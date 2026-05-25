import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { Usuario } from '../db/models/Usuario.js'
import { Rol } from '../db/models/Rol.js'
import { JWT_SECRET, requireAuth } from '../middleware/requireAuth.js'
import { buildAuthPayload } from '../utils/authSession.js'
import {
  authenticateWithActiveDirectory,
  findUsuarioByLoginId,
  getAuthLoginConfig,
  isLocalPasswordFallbackEnabled,
} from '../utils/directoryAuth.js'
import { isAdLoginEnabled } from '../utils/ehrAuth.js'

export const authRouter = Router()

const JWT_EXPIRES = '8h'

authRouter.get('/config', async (_req, res, next) => {
  try {
    res.json(await getAuthLoginConfig())
  } catch (err) {
    next(err)
  }
})

authRouter.post('/login', async (req, res, next) => {
  try {
    const body = req.body as { email?: string; usuario?: string; password?: string }
    const loginId = (body.email ?? body.usuario ?? '').trim()
    const password = body.password ?? ''

    if (!loginId || !password) {
      res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
      return
    }

    let user = null
    let adValidated = false

    if (isAdLoginEnabled()) {
      try {
        await authenticateWithActiveDirectory(loginId, password)
        adValidated = true
        user = await findUsuarioByLoginId(loginId)
        if (!user) {
          res.status(403).json({
            error:
              'Credenciales válidas en Active Directory, pero no tienes acceso en IT Manager. Solicita tu usuario al área de IT.',
          })
          return
        }
      } catch (adErr) {
        if (!isLocalPasswordFallbackEnabled()) {
          const msg =
            adErr instanceof Error
              ? adErr.message
              : 'No se pudo validar con Active Directory.'
          res.status(401).json({ error: msg })
          return
        }
      }
    }

    if (!user) {
      const email = loginId.toLowerCase()
      user = await Usuario.findOne({ email, activo: true })
        .populate<{ rol_id: { _id: string; nombre: string; permisos: string[] } }>(
          'rol_id',
          'nombre permisos',
        )
        .populate<{ empleado_id: { _id: string; codigo: string; nombre: string } | null }>(
          'empleado_id',
          'codigo nombre',
        )
        .populate<{
          departamento_id: { _id: string; codigo: string; nombre: string; lleva_gastos?: boolean } | null
        }>('departamento_id', 'codigo nombre lleva_gastos')

      if (!user) {
        res.status(401).json({
          error: adValidated
            ? 'Usuario sin acceso en IT Manager.'
            : 'Credenciales incorrectas',
        })
        return
      }

      if (!user.password) {
        res.status(401).json({
          error: isAdLoginEnabled()
            ? 'Esta cuenta solo admite inicio de sesión con Active Directory.'
            : 'Usuario sin contraseña local configurada.',
        })
        return
      }

      const match = await bcrypt.compare(password, user.password)
      if (!match) {
        res.status(401).json({ error: 'Credenciales incorrectas' })
        return
      }
    }

    const payload = buildAuthPayload(
      user as unknown as Parameters<typeof buildAuthPayload>[0],
    )
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    await Usuario.findByIdAndUpdate(user._id, { ultimo_acceso: new Date() })

    res.json({ token, user: payload, authMethod: adValidated ? 'active_directory' : 'local' })
  } catch (err) {
    next(err)
  }
})

/**
 * Devuelve la información de sesión "plana" del usuario logueado en el mismo
 * shape que el payload del login. Útil para que el cliente refresque sus
 * datos (departamento, lleva_gastos, etc.) cuando cambian del lado servidor.
 */
authRouter.get('/sesion', requireAuth, async (req, res, next) => {
  try {
    const user = await Usuario.findById(req.user!._id)
      .select('-password')
      .populate<{ rol_id: { _id: string; nombre: string; permisos: string[] } }>('rol_id', 'nombre permisos')
      .populate<{ empleado_id: { _id: string; codigo: string; nombre: string } | null }>('empleado_id', 'codigo nombre')
      .populate<{
        departamento_id: { _id: string; codigo: string; nombre: string; lleva_gastos?: boolean } | null
      }>('departamento_id', 'codigo nombre lleva_gastos')
      .lean()
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    const rol = user.rol_id as { _id: string; nombre: string; permisos: string[] }
    const emp = user.empleado_id as { _id: string; codigo: string; nombre: string } | null
    const dept = user.departamento_id as
      | { _id: string; codigo: string; nombre: string; lleva_gastos?: boolean }
      | null
    res.json({
      _id: String(user._id),
      email: user.email,
      nombre: user.nombre,
      rol: rol?.nombre ?? '',
      permisos: rol?.permisos ?? [],
      empleado_id: emp ? String(emp._id) : null,
      empleado_codigo: emp?.codigo ?? null,
      empleado_nombre: emp?.nombre ?? null,
      departamento_id: dept ? String(dept._id) : null,
      departamento_codigo: dept?.codigo ?? null,
      departamento_nombre: dept?.nombre ?? null,
      departamento_lleva_gastos: dept ? Boolean(dept.lleva_gastos) : false,
    })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await Usuario.findById(req.user!._id)
      .select('-password')
      .populate('rol_id', 'nombre permisos')
      .populate('empleado_id', 'codigo nombre puesto departamento foto_url')
      .populate('empleados_ids', 'codigo nombre puesto departamento foto_url')
      .populate('departamento_id', 'codigo nombre color')
      .lean()
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    res.json(user)
  } catch (err) {
    next(err)
  }
})

authRouter.post('/cambiar-password', requireAuth, async (req, res, next) => {
  try {
    const { password_actual, password_nuevo } = req.body as Record<string, string>
    if (!password_actual || !password_nuevo) {
      res.status(400).json({ error: 'Faltan campos' }); return
    }
    const user = await Usuario.findById(req.user!._id).lean()
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return }
    if (!user.password) {
      res.status(400).json({
        error: 'Tu cuenta usa Active Directory; cambia la contraseña desde el dominio corporativo.',
      })
      return
    }
    const ok = await bcrypt.compare(password_actual, user.password)
    if (!ok) { res.status(400).json({ error: 'Contraseña actual incorrecta' }); return }
    const hash = await bcrypt.hash(password_nuevo, 10)
    await Usuario.findByIdAndUpdate(user._id, { password: hash })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

authRouter.get('/roles-disponibles', requireAuth, async (_req, res, next) => {
  try {
    const roles = await Rol.find({ activo: true }).select('_id nombre').lean()
    res.json(roles)
  } catch (err) {
    next(err)
  }
})

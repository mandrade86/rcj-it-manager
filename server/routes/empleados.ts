import { Router } from 'express'
import mongoose from 'mongoose'

import { Empleado } from '../db/models/Empleado.js'
import { Config } from '../db/models/Config.js'
import { Departamento } from '../db/models/Departamento.js'
import { Usuario } from '../db/models/Usuario.js'
import { fetchEhrJson } from '../utils/ehrAuth.js'
import { sincronizarEmpleadosDepartamentoDesdeEhr } from '../utils/sincronizarEmpleadoDepartamentoEhr.js'
import { resolveVisibleEmpleadoIds } from '../utils/empleadoScope.js'
import {
  buildEliminarLoteResponse,
  parseEliminarLoteIds,
} from '../utils/eliminarLote.js'

export const empleadosRouter = Router()

const ALLOWED = [
  'codigo', 'nombre', 'puesto', 'departamento', 'departamento_id',
  'departamentos_a_cargo',
  'email', 'telefono', 'jefe_id', 'foto_url', 'activo', 'fecha_ingreso',
] as const

const EMPLEADO_POPULATE = [
  { path: 'jefe_id', select: 'codigo nombre puesto' },
  { path: 'departamento_id', select: 'codigo nombre color' },
  { path: 'departamentos_a_cargo', select: 'codigo nombre color' },
] as const

function pick(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED) {
    if (body[k] === undefined) continue
    if (k === 'fecha_ingreso') {
      const v = body[k]
      if (v === null || v === '') {
        out[k] = null
      } else {
        const d = new Date(String(v))
        if (!Number.isNaN(d.getTime())) out[k] = d
      }
      continue
    }
    if (k === 'departamentos_a_cargo') {
      const raw = body[k]
      out[k] = Array.isArray(raw)
        ? raw.filter((v) => typeof v === 'string' && mongoose.isValidObjectId(v))
        : []
      continue
    }
    out[k] = body[k]
  }
  return out
}

function parseFechaIngresoExt(row: Record<string, unknown>): Date | null {
  const candidates = [
    row.fechaIngreso, row.fecha_ingreso, row.fechaContratacion,
    row.fecha_contratacion, row.hireDate, row.dateOfHire, row.startDate,
  ]
  for (const c of candidates) {
    if (c == null || c === '') continue
    const d = new Date(String(c))
    if (!Number.isNaN(d.getTime())) return d
  }
  return null
}

function valueToString(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function nestedDescripcion(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const row = value as Record<string, unknown>
  return valueToString(row.descripcion ?? row.nombre ?? row.name)
}

function normalizeEmployeePayload(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload as Array<Record<string, unknown>>
  if (payload && typeof payload === 'object') {
    const row = payload as Record<string, unknown>
    if (Array.isArray(row.data)) return row.data as Array<Record<string, unknown>>
    if (Array.isArray(row.items)) return row.items as Array<Record<string, unknown>>
    if (Array.isArray(row.results)) return row.results as Array<Record<string, unknown>>
  }
  throw new Error('El servicio no devolvió un array ni un objeto con data[]')
}

function extractDeptoNum(row: Record<string, unknown>): number | null {
  const raw =
    row.deptoId ??
    row.depto_id ??
    row.idDepartamento ??
    row.departmentId ??
    row['Depto #'] ??
    row['depto #']
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function mapEmpleadoEhr(row: Record<string, unknown>) {
  const codigo = valueToString(row.codigo ?? row.empleadoId)
  const nombreCompleto = `${valueToString(row.nombre)} ${valueToString(row.apellido)}`.trim()
  const puesto = valueToString(row.puesto) || nestedDescripcion(row.posicion)
  const deptoNum = extractDeptoNum(row)
  const departamento =
    valueToString(row.departamento) ||
    nestedDescripcion(row.departamento) ||
    (deptoNum != null ? `Depto ${deptoNum}` : '')

  return {
    codigo,
    nombre: nombreCompleto || valueToString(row.name ?? row.fullName),
    puesto,
    departamento,
    deptoNum,
    email: valueToString(row.correo ?? row.email),
    telefono: valueToString(row.telefono),
    foto_url: valueToString(row.foto),
    activo: row.activo !== false,
    fecha_ingreso: parseFechaIngresoExt(row),
    datos_externos: row,
    empleadoId: row.empleadoId,
    jefeInmediato: row.jefeInmediato,
  }
}

empleadosRouter.get('/', async (req, res, next) => {
  try {
    const { departamento, activo } = req.query
    const filter: Record<string, unknown> = {}
    if (departamento) filter.departamento = departamento
    if (activo !== undefined) filter.activo = activo === 'true'
    const rows = await Empleado.find(filter)
      .populate(EMPLEADO_POPULATE)
      .sort({ nombre: 1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

/** GET /api/empleados/config/servicio — devuelve la URL configurada */
empleadosRouter.get('/config/servicio', async (_req, res, next) => {
  try {
    const cfg = await Config.findOne({ clave: 'empleados_service_url' }).lean()
    res.json({ url: cfg?.valor ?? '' })
  } catch (err) {
    next(err)
  }
})

/** POST /api/empleados/config/servicio — guarda URL del servicio */
empleadosRouter.post('/config/servicio', async (req, res, next) => {
  try {
    const { url } = req.body as { url?: string }
    await Config.findOneAndUpdate(
      { clave: 'empleados_service_url' },
      { valor: url ?? '' },
      { upsert: true },
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/empleados/sync
 * Fetches employees from the configured external service URL and upserts them.
 * Supports RCJ EHR format:
 * { data: [{ empleadoId, codigo, nombre, apellido, jefeInmediato, correo, posicion, ... }] }
 */
empleadosRouter.post('/sync', async (_req, res, next) => {
  try {
    const cfg = await Config.findOne({ clave: 'empleados_service_url' }).lean()
    const url = cfg?.valor
    if (!url) {
      res.status(400).json({ error: 'URL del servicio no configurada. Configúrala primero.' })
      return
    }

    let data: Array<Record<string, unknown>>
    try {
      const json = await fetchEhrJson(url)
      data = normalizeEmployeePayload(json)
    } catch (fetchErr) {
      res.status(502).json({ error: `No se pudo conectar al servicio: ${(fetchErr as Error).message}` })
      return
    }

    let insertados = 0, actualizados = 0, errores = 0

    const deptoMap = new Map(
      (await Departamento.find({ ehr_departamento_id: { $ne: null } })
        .select('_id nombre ehr_departamento_id')
        .lean())
        .map((d) => [d.ehr_departamento_id as number, { _id: d._id, nombre: d.nombre }]),
    )

    // First pass: upsert without jefe_id
    for (const row of data) {
      const mapped = mapEmpleadoEhr(row)
      if (!mapped.codigo || !mapped.nombre) { errores++; continue }
      try {
        const $set: Record<string, unknown> = {
          nombre: mapped.nombre,
          puesto: mapped.puesto,
          departamento: mapped.departamento,
          email: mapped.email,
          telefono: mapped.telefono,
          foto_url: mapped.foto_url,
          datos_externos: mapped.datos_externos,
          activo: mapped.activo,
        }
        if (mapped.fecha_ingreso) $set.fecha_ingreso = mapped.fecha_ingreso
        const dn = mapped.deptoNum
        if (dn != null) {
          const hit = deptoMap.get(dn)
          if (hit) {
            $set.departamento_id = hit._id
            $set.departamento = hit.nombre
          }
        }
        const result = await Empleado.findOneAndUpdate(
          { codigo: mapped.codigo },
          { $set },
          { upsert: true, new: false },
        )
        if (result) actualizados++; else insertados++
      } catch { errores++ }
    }

    // Second pass: resolve jefeInmediato (EHR empleadoId) or jefe_codigo → jefe_id
    for (const row of data) {
      const mapped = mapEmpleadoEhr(row)
      if (!mapped.codigo) continue

      const jefeEmpleadoId = mapped.jefeInmediato
      const jefeCodigo = row.jefe_codigo ? valueToString(row.jefe_codigo) : null
      if (!jefeEmpleadoId && !jefeCodigo) continue

      const jefe = jefeEmpleadoId
        ? await Empleado.findOne({ 'datos_externos.empleadoId': jefeEmpleadoId }).lean()
        : await Empleado.findOne({ codigo: jefeCodigo }).lean()

      if (jefe) {
        await Empleado.findOneAndUpdate({ codigo: mapped.codigo }, { jefe_id: jefe._id })
      }
    }

    await sincronizarEmpleadosDepartamentoDesdeEhr()

    res.json({ ok: true, insertados, actualizados, errores, total: data.length })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/empleados/mi-equipo
 * Empleados visibles: tu `empleado_id`, asignaciones explícitas `empleados_ids`,
 * cadena de subordinados por `jefe_id` y dotación de `departamentos_a_cargo`.
 * Admins (`*`) ven el maestro completo.
 */
empleadosRouter.get('/mi-equipo', async (req, res, next) => {
  try {
    const userId = req.user?._id
    if (!userId) { res.status(401).json({ error: 'No autorizado' }); return }
    const { isAdmin, visibleIds, selfEmpleadoId, directIds, autoDirectIds, deptStartIds } =
      await resolveVisibleEmpleadoIds(userId)

    const baseQuery = isAdmin
      ? Empleado.find({})
      : Empleado.find({ _id: { $in: visibleIds } })

    const empleados = await baseQuery
      .populate(EMPLEADO_POPULATE)
      .sort({ nombre: 1 })
      .lean()

    // rootIds (raíces forzadas en el organigrama):
    //  - Si el usuario tiene identidad (empleado_id), la raíz es él mismo —
    //    sus directos auto-descubiertos cuelgan naturalmente debajo.
    //  - Más cualquier `empleados_ids` explícito.
    const rootIdSet = new Set<string>()
    if (selfEmpleadoId) rootIdSet.add(selfEmpleadoId)
    for (const id of directIds) rootIdSet.add(id)

    // Conteos distintos (sin duplicar). El usuario mismo no se cuenta como
    // "directo": son sus reportes directos quienes aparecen en ese balde.
    const autoDirectSet = new Set(autoDirectIds)
    const explicitDirectSet = new Set(directIds)
    const deptSet = new Set(deptStartIds)
    if (selfEmpleadoId) {
      explicitDirectSet.delete(selfEmpleadoId)
      autoDirectSet.delete(selfEmpleadoId)
      deptSet.delete(selfEmpleadoId)
    }
    // Quitar overlaps
    for (const id of autoDirectSet) explicitDirectSet.delete(id)
    for (const id of [...explicitDirectSet, ...autoDirectSet]) deptSet.delete(id)

    const directosCount = autoDirectSet.size + explicitDirectSet.size
    const porDepartamentoCount = deptSet.size
    const subordinadosCount = Math.max(
      0,
      visibleIds.length - directosCount - porDepartamentoCount - (selfEmpleadoId ? 1 : 0),
    )

    res.json({
      empleados,
      scope: isAdmin ? 'all' : 'mio',
      total: empleados.length,
      myEmpleadoId: selfEmpleadoId,
      rootIds: isAdmin ? [] : [...rootIdSet],
      autoDirectIds: isAdmin ? [] : autoDirectIds,
      deptIds: isAdmin ? [] : deptStartIds,
      directosCount: isAdmin ? 0 : directosCount,
      porDepartamentoCount: isAdmin ? 0 : porDepartamentoCount,
      subordinadosCount: isAdmin ? 0 : subordinadosCount,
    })
  } catch (err) {
    next(err)
  }
})

empleadosRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const parsed = parseEliminarLoteIds((req.body as { ids?: unknown }).ids)
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error })
      return
    }
    const { validIds, omitidos } = parsed
    const found = await Empleado.find({ _id: { $in: validIds } }).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const noEncontrados = validIds.filter((id) => !eliminar.includes(id))
    if (eliminar.length > 0) {
      await Empleado.deleteMany({ _id: { $in: eliminar } })
    }
    res.json(buildEliminarLoteResponse(eliminar, omitidos, noEncontrados))
  } catch (err) {
    next(err)
  }
})

empleadosRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const doc = await Empleado.findById(id)
      .populate([
        { path: 'jefe_id', select: 'codigo nombre puesto departamento' },
        { path: 'departamento_id', select: 'codigo nombre color' },
        { path: 'departamentos_a_cargo', select: 'codigo nombre color' },
      ])
      .lean()
    if (!doc) { res.status(404).json({ error: 'Empleado no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

empleadosRouter.post('/', async (req, res, next) => {
  try {
    const body = pick(req.body as Record<string, unknown>)
    if (!body.codigo || !body.nombre) {
      res.status(400).json({ error: 'Código y nombre son requeridos' }); return
    }
    const created = await Empleado.create(body)
    const doc = await Empleado.findById(created._id).populate(EMPLEADO_POPULATE).lean()
    res.status(201).json(doc)
  } catch (err) {
    next(err)
  }
})

empleadosRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    const body = pick(req.body as Record<string, unknown>)
    const doc = await Empleado.findByIdAndUpdate(id, body, { new: true, runValidators: true })
      .populate(EMPLEADO_POPULATE)
      .lean()
    if (!doc) { res.status(404).json({ error: 'Empleado no encontrado' }); return }
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

empleadosRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { res.status(400).json({ error: 'ID inválido' }); return }
    await Empleado.findByIdAndDelete(id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

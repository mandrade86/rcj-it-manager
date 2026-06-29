import fs from 'fs'
import path from 'path'
import { Router, type Request } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import xlsx from 'xlsx'

import { Proyecto, PROYECTO_ESTADOS } from '../db/models/Proyecto.js'
import { KPI } from '../db/models/KPI.js'
import { Tarea } from '../db/models/Tarea.js'
import { Usuario } from '../db/models/Usuario.js'
import {
  buildProyectoEquipoFilter,
  buildProyectoParticipoFilter,
  buildProyectoScopeFilter,
  isAdminProyectos,
  resolveDepartamentosUsuario,
} from '../utils/proyectoScope.js'
import {
  enrichProyectoAcceso,
  usuarioPuedeEditarProyecto,
  usuarioPuedeGestionarParticipantes,
} from '../utils/proyectoPermisos.js'
import { ADJUNTOS_TAREAS_DIR } from '../utils/multerAdjuntosTareas.js'
import { calcularRiesgo } from '../utils/proyectoRiesgo.js'
import {
  PROYECTO_EXCEL_COLS,
  buildPlantillaProyectosRows,
  buildResolverCache,
  rowToProyecto,
} from '../utils/proyectosExcel.js'

export const proyectosRouter = Router()

const uploadProyectosExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls')
    if (ok) cb(null, true)
    else cb(new Error('Solo se permiten archivos Excel .xlsx o .xls'))
  },
}).single('archivo')

const POPULATE_FIELDS = [
  { path: 'usuario_id', select: 'nombre email rol_id empleado_id' },
  { path: 'departamento_id', select: 'codigo nombre color' },
  { path: 'empresa_ids', select: 'codigo nombre color activo' },
  { path: 'kpi_id', select: 'nombre eje meta unidad frecuencia descripcion' },
  { path: 'participantes.usuario_id', select: 'nombre email activo' },
] as const

/** Construye el filtro Mongo basado en el scope del usuario actual. */
async function buildScopeFilter(req: Request): Promise<Record<string, unknown> | null> {
  const u = req.user
  if (!u) return null
  return buildProyectoScopeFilter(u._id, u.permisos ?? [])
}

/** Filtro para vista «Mi equipo» (sin proyectos propios). */
async function buildEquipoFilter(req: Request): Promise<Record<string, unknown> | null> {
  const u = req.user
  if (!u) return null
  return buildProyectoEquipoFilter(u._id, u.permisos ?? [])
}

function normalizeEmpresaIds(raw: unknown): mongoose.Types.ObjectId[] {
  if (raw == null) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  const out: mongoose.Types.ObjectId[] = []
  const seen = new Set<string>()
  for (const item of arr) {
    let s = ''
    if (typeof item === 'string') s = item.trim()
    else if (item && typeof item === 'object' && '_id' in item) s = String((item as { _id: unknown })._id).trim()
    if (!mongoose.isValidObjectId(s) || seen.has(s)) continue
    seen.add(s)
    out.push(new mongoose.Types.ObjectId(s))
  }
  return out
}

function pickBody(body: Record<string, unknown>) {
  const allowed = [
    'nombre', 'descripcion', 'eje', 'fase', 'tipo',
    'usuario_id', 'departamento_id', 'responsable',
    'fecha_inicio', 'fecha_fin', 'prioridad', 'estado',
    'meta_kpi', 'kpi_id', 'porcentaje_avance', 'notas',
  ] as const
  const out: Record<string, unknown> = {}
  for (const k of allowed) {
    if (body[k] === undefined) continue
    if (k === 'usuario_id' || k === 'departamento_id' || k === 'kpi_id') {
      const v = body[k]
      if (v === '' || v === null) { out[k] = null; continue }
      if (typeof v === 'string' && mongoose.isValidObjectId(v)) out[k] = v
    } else {
      out[k] = body[k]
    }
  }
  if (body.empresa_ids !== undefined) {
    out.empresa_ids = normalizeEmpresaIds(body.empresa_ids)
  }
  return out
}

function toOidString(id: unknown): string | null {
  if (id == null || id === '') return null
  const s = typeof id === 'string' ? id.trim() : String(id)
  if (!mongoose.isValidObjectId(s)) return null
  return s
}

/** Devuelve mensaje de error o null si el KPI pertenece al departamento indicado. */
async function validateProyectoKpi(
  kpiId: unknown,
  departamentoId: unknown,
): Promise<string | null> {
  const kid = toOidString(kpiId)
  if (!kid) return null
  const deptStr = toOidString(departamentoId)
  if (!deptStr) {
    return 'Para vincular un KPI el proyecto debe tener departamento asignado.'
  }
  const deptOid = new mongoose.Types.ObjectId(deptStr)
  const kpi = await KPI.findById(kid).select('departamento_id').lean()
  if (!kpi) return 'KPI no encontrado.'
  const kd = kpi.departamento_id as mongoose.Types.ObjectId | null | undefined
  if (!kd || String(kd) !== String(deptOid)) {
    return 'El KPI seleccionado no pertenece al departamento del proyecto.'
  }
  return null
}

type TareaAdjuntosLean = { adjuntos?: Array<{ archivo: string }> }

/** Elimina tareas, archivos adjuntos y el documento del proyecto. */
async function deleteProyectoCascade(pid: string): Promise<void> {
  const tareas = await Tarea.find({ proyecto_id: pid }).select('adjuntos').lean() as TareaAdjuntosLean[]
  for (const t of tareas) {
    for (const adj of t.adjuntos ?? []) {
      const fp = path.join(ADJUNTOS_TAREAS_DIR, adj.archivo)
      if (fs.existsSync(fp)) {
        try {
          fs.unlinkSync(fp)
        } catch {
          /* noop */
        }
      }
    }
  }
  await Tarea.deleteMany({ proyecto_id: pid })
  await Proyecto.findByIdAndDelete(pid)
}

/** Catálogo de estados del flujo (para selects en el frontend). */
proyectosRouter.get('/catalogo/estados', (_req, res) => {
  res.json(PROYECTO_ESTADOS)
})

/** GET /api/proyectos/plantilla-excel — plantilla de carga masiva (opcional: mismos filtros que GET /). */
proyectosRouter.get('/plantilla-excel', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }

    const filter: Record<string, unknown> = { ...scope }
    if (req.query.scope === 'equipo' || req.query.alcance === 'equipo') {
      const equipoFilter = await buildEquipoFilter(req)
      if (equipoFilter) Object.assign(filter, equipoFilter)
    }
    if (req.query.scope === 'participo' || req.query.alcance === 'participo') {
      const u = req.user
      if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
      Object.assign(filter, buildProyectoParticipoFilter(u._id))
    }
    if (req.query.fase != null && req.query.fase !== '') {
      const n = Number(req.query.fase)
      if ([1, 2, 3].includes(n)) filter.fase = n
    }
    if (typeof req.query.eje === 'string' && req.query.eje) filter.eje = req.query.eje
    if (typeof req.query.estado === 'string' && req.query.estado) filter.estado = req.query.estado
    if (typeof req.query.prioridad === 'string' && req.query.prioridad) filter.prioridad = req.query.prioridad
    if (typeof req.query.tipo === 'string' && req.query.tipo) filter.tipo = req.query.tipo

    const rowsData = await buildPlantillaProyectosRows(filter)
    if (!rowsData.length) {
      rowsData.push({
        ID: 'INV-001',
        Nombre: 'Ejemplo — reemplazar',
        Descripcion: '',
        Eje: 'Infraestructura',
        Fase: 1,
        Tipo: 'departamental',
        'Departamento codigo': 'IT',
        'Empresas codigos': '',
        'Usuario email': '',
        Responsable: '',
        Inicio: '',
        Fin: '',
        Prioridad: 'Media',
        Estado: 'Planificado',
        'KPI nombre': '',
        'Meta KPI': '',
        '% avance': 0,
        Notas: '',
      })
    }

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(rowsData, { header: [...PROYECTO_EXCEL_COLS] })
    ;(ws as { '!cols'?: { wch: number }[] })['!cols'] = [
      { wch: 12 }, { wch: 36 }, { wch: 28 }, { wch: 16 }, { wch: 6 }, { wch: 14 },
      { wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 20 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Proyectos')

    const instrucciones = [
      ['Plantilla de carga masiva de proyectos — RCJ IT Manager'],
      [],
      ['Cómo usar:'],
      ['1. Edita la hoja "Proyectos".'],
      ['2. ID obligatorio (ej. INV-001). Mismo ID = actualiza; ID nuevo = crea.'],
      ['3. Nombre obligatorio.'],
      ['4. Departamento codigo: código del maestro (ej. IT).'],
      ['5. Empresas codigos: separadas por coma (códigos del maestro Empresas).'],
      ['6. Usuario email: propietario del proyecto (usuario activo).'],
      ['7. KPI nombre: debe existir en el catálogo del mismo departamento.'],
      ['8. Sube el archivo desde Proyectos → "Subir Excel".'],
    ]
    const wsInfo = xlsx.utils.aoa_to_sheet(instrucciones)
    ;(wsInfo as { '!cols'?: { wch: number }[] })['!cols'] = [{ wch: 22 }, { wch: 72 }]
    xlsx.utils.book_append_sheet(wb, wsInfo, 'Instrucciones')

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="Proyectos-plantilla.xlsx"')
    res.send(buf)
  } catch (err) {
    next(err)
  }
})

/** GET /api/proyectos/exportar-excel — descarga los proyectos filtrados como Excel legible. */
proyectosRouter.get('/exportar-excel', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }

    const filter: Record<string, unknown> = { ...scope }
    if (req.query.scope === 'equipo' || req.query.alcance === 'equipo') {
      const equipoFilter = await buildEquipoFilter(req)
      if (equipoFilter) Object.assign(filter, equipoFilter)
    }
    if (req.query.scope === 'participo' || req.query.alcance === 'participo') {
      Object.assign(filter, buildProyectoParticipoFilter(u._id))
    }
    if (req.query.fase != null && req.query.fase !== '') {
      const n = Number(req.query.fase)
      if ([1, 2, 3].includes(n)) filter.fase = n
    }
    if (typeof req.query.eje === 'string' && req.query.eje) filter.eje = req.query.eje
    if (typeof req.query.estado === 'string' && req.query.estado) filter.estado = req.query.estado
    if (typeof req.query.prioridad === 'string' && req.query.prioridad) filter.prioridad = req.query.prioridad
    if (typeof req.query.tipo === 'string' && req.query.tipo) filter.tipo = req.query.tipo
    if (typeof req.query.departamento_id === 'string' && req.query.departamento_id) {
      filter.departamento_id = req.query.departamento_id
    }

    const rows = await Proyecto.find(filter)
      .populate('departamento_id', 'codigo nombre')
      .populate('empresa_ids', 'codigo nombre')
      .populate('usuario_id', 'nombre email')
      .populate('kpi_id', 'nombre')
      .sort({ nombre: 1 })
      .lean()

    function toDate(d: Date | string | null | undefined): string {
      if (!d) return ''
      const date = d instanceof Date ? d : new Date(d)
      if (Number.isNaN(date.getTime())) return ''
      const dd = String(date.getDate()).padStart(2, '0')
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const yyyy = date.getFullYear()
      return `${dd}/${mm}/${yyyy}`
    }

    const COLS = [
      'Nombre', 'Descripción', 'Eje', 'Fase', 'Tipo', 'Departamento',
      'Empresas', 'Propietario', 'Responsable', 'Inicio', 'Fin',
      'Prioridad', 'Estado', 'KPI', 'Meta KPI', '% Avance', 'Notas', 'Creado',
    ] as const

    const rowsData = rows.map((p) => {
      const dept = p.departamento_id as { codigo?: string; nombre?: string } | null
      const emps = (p.empresa_ids ?? []) as Array<{ codigo?: string; nombre?: string }>
      const owner = p.usuario_id as { nombre?: string; email?: string } | null
      const kpi = p.kpi_id as { nombre?: string } | null
      return {
        Nombre: p.nombre ?? '',
        'Descripción': p.descripcion ?? '',
        Eje: p.eje ?? '',
        Fase: p.fase != null ? String(p.fase) : '',
        Tipo: p.tipo === 'departamental' ? 'Departamental' : 'Individual',
        Departamento: dept?.nombre ?? dept?.codigo ?? '',
        Empresas: emps.map((e) => e.nombre ?? e.codigo).filter(Boolean).join(', '),
        Propietario: owner?.nombre ?? owner?.email ?? '',
        Responsable: p.responsable ?? '',
        Inicio: toDate(p.fecha_inicio),
        Fin: toDate(p.fecha_fin),
        Prioridad: p.prioridad ?? '',
        Estado: p.estado ?? '',
        KPI: kpi?.nombre ?? '',
        'Meta KPI': p.meta_kpi ?? '',
        '% Avance': p.porcentaje_avance ?? 0,
        Notas: p.notas ?? '',
        Creado: toDate(p.createdAt),
      }
    })

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(rowsData, { header: [...COLS] })
    ;(ws as { '!cols'?: { wch: number }[] })['!cols'] = [
      { wch: 36 }, { wch: 28 }, { wch: 16 }, { wch: 6 }, { wch: 14 },
      { wch: 20 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 16 },
      { wch: 10 }, { wch: 24 }, { wch: 12 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Proyectos')

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="Proyectos-${stamp}.xlsx"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
})

/** POST /api/proyectos/importar-excel — carga o actualiza proyectos desde Excel. */
proyectosRouter.post('/importar-excel', (req, res, next) => {
  uploadProyectosExcel(req, res, async (uploadErr) => {
    if (uploadErr) {
      next(uploadErr)
      return
    }
    try {
      const u = req.user
      if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
      if (!u.permisos.includes('*') && !u.permisos.includes('proyectos:editar')) {
        res.status(403).json({ error: 'No tienes permiso para importar proyectos' })
        return
      }
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'Archivo Excel es obligatorio' })
        return
      }

      const scope = await buildScopeFilter(req)
      if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }

      const wb = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true, raw: false })
      const sheetName = wb.SheetNames[0]
      if (!sheetName) {
        res.status(400).json({ error: 'El Excel no contiene hojas' })
        return
      }
      const sheet = wb.Sheets[sheetName]
      const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      })

      const cache = await buildResolverCache()
      const usuarioFull = await Usuario.findById(u._id).select('departamento_id nombre').lean()

      let creados = 0
      let actualizados = 0
      let omitidos = 0
      const errores: { fila: number; error: string }[] = []

      for (let i = 0; i < rows.length; i++) {
        const parsed = rowToProyecto(rows[i]!, cache)
        if ('error' in parsed) {
          omitidos++
          errores.push({ fila: i + 2, error: parsed.error })
          continue
        }

        const { id, payload } = parsed
        const existing = await Proyecto.findOne({ _id: id, ...scope }).select('_id estado').lean()

        if (!existing) {
          const dupGlobal = await Proyecto.findById(id).select('_id').lean()
          if (dupGlobal) {
            omitidos++
            errores.push({ fila: i + 2, error: 'ID ya existe fuera de tu alcance' })
            continue
          }
        }

        const deptEff = payload.departamento_id ?? usuarioFull?.departamento_id
        const errKpi = await validateProyectoKpi(payload.kpi_id, deptEff)
        if (errKpi) {
          omitidos++
          errores.push({ fila: i + 2, error: errKpi })
          continue
        }

        const { _id: _ignored, ...rest } = payload
        void _ignored
        const patch = { ...rest }
        if (patch.usuario_id === null && !patch.responsable) {
          patch.usuario_id = u._id as mongoose.Types.ObjectId
        }
        if (patch.departamento_id === null && usuarioFull?.departamento_id) {
          patch.departamento_id = usuarioFull.departamento_id as mongoose.Types.ObjectId
        }

        if (existing) {
          await Proyecto.findByIdAndUpdate(id, patch, { runValidators: true })
          actualizados++
        } else {
          await Proyecto.create({
            _id: id,
            ...patch,
            historial: [{
              fecha: new Date(),
              de: null,
              a: patch.estado ?? 'Planificado',
              usuario_id: u._id,
              usuario_nombre: u.nombre,
              comentario: 'Importación Excel',
            }],
          })
          creados++
        }

        if (payload.kpi_id) {
          const kpi = await KPI.findById(payload.kpi_id).select('meta').lean()
          await KPI.findByIdAndUpdate(payload.kpi_id, {
            $addToSet: { proyecto_ids: id },
          })
          if (kpi?.meta && !payload.meta_kpi) {
            await Proyecto.findByIdAndUpdate(id, { meta_kpi: kpi.meta })
          }
        }
      }

      res.json({
        ok: true,
        hoja: sheetName,
        totalFilas: rows.length,
        creados,
        actualizados,
        omitidos,
        errores: errores.slice(0, 30),
      })
    } catch (err) {
      next(err)
    }
  })
})

/**
 * Elimina varios proyectos visibles para el usuario (mismo criterio que DELETE /:id).
 * POST /api/proyectos/eliminar-lote  { ids: string[] }
 */
proyectosRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
    if (!u.permisos.includes('*') && !u.permisos.includes('proyectos:editar')) {
      res.status(403).json({ error: 'No tienes permiso para eliminar proyectos' })
      return
    }
    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }

    const raw = (req.body as { ids?: unknown }).ids
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'Envía un arreglo ids con al menos un id de proyecto.' })
      return
    }
    const ids = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))]
    if (ids.length > 200) {
      res.status(400).json({ error: 'Máximo 200 proyectos por solicitud.' })
      return
    }

    const filter: Record<string, unknown> = { _id: { $in: ids }, ...scope }
    const found = await Proyecto.find(filter).select('_id').lean()
    const eliminar = found.map((d) => String(d._id))
    const omitidos = ids.filter((id) => !eliminar.includes(id))

    for (const pid of eliminar) {
      await deleteProyectoCascade(pid)
    }

    res.json({
      eliminados: eliminar.length,
      ids: eliminar,
      omitidos,
    })
  } catch (err) {
    next(err)
  }
})

proyectosRouter.get('/', async (req, res, next) => {
  try {
    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }
    const filter: Record<string, unknown> = { ...scope }

    if (req.query.scope === 'equipo' || req.query.alcance === 'equipo') {
      const equipoFilter = await buildEquipoFilter(req)
      if (equipoFilter === null) { res.status(401).json({ error: 'No autenticado' }); return }
      Object.assign(filter, equipoFilter)
    }
    if (req.query.scope === 'participo' || req.query.alcance === 'participo') {
      const u = req.user
      if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
      delete filter.$or
      Object.assign(filter, buildProyectoParticipoFilter(u._id))
    }

    if (req.query.fase != null && req.query.fase !== '') {
      const n = Number(req.query.fase)
      if ([1, 2, 3].includes(n)) filter.fase = n
    }
    if (typeof req.query.eje === 'string' && req.query.eje) filter.eje = req.query.eje
    if (typeof req.query.estado === 'string' && req.query.estado) filter.estado = req.query.estado
    if (typeof req.query.prioridad === 'string' && req.query.prioridad) filter.prioridad = req.query.prioridad
    if (typeof req.query.tipo === 'string' && req.query.tipo) filter.tipo = req.query.tipo
    if (typeof req.query.empresa_id === 'string' && mongoose.isValidObjectId(req.query.empresa_id)) {
      filter.empresa_ids = new mongoose.Types.ObjectId(req.query.empresa_id)
    }

    // Filtros de scope explícito (cuando el usuario quiere restringir más)
    if (typeof req.query.usuario_id === 'string' && mongoose.isValidObjectId(req.query.usuario_id)) {
      filter.usuario_id = req.query.usuario_id
    }
    if (
      typeof req.query.departamento_id === 'string' &&
      mongoose.isValidObjectId(req.query.departamento_id)
    ) {
      const qDept = req.query.departamento_id
      if (!isAdminProyectos(req.user!.permisos ?? [])) {
        const permitidos = await resolveDepartamentosUsuario(req.user!._id)
        const allowed = new Set(permitidos.map((id) => String(id)))
        if (!allowed.has(qDept)) {
          res.status(403).json({ error: 'Solo puedes consultar proyectos de tus departamentos asignados.' })
          return
        }
      }
      filter.departamento_id = qDept
    }

    const rows = await Proyecto.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ updatedAt: -1, _id: 1 })
      .lean()

    const proyectoIds = rows.map((p) => String(p._id))
    const tareasDocs = proyectoIds.length > 0
      ? await Tarea.find({ proyecto_id: { $in: proyectoIds } })
        .select('estado proyecto_id')
        .lean()
      : []

    const tareasPorProyecto = new Map<string, { estado: string }[]>()
    for (const t of tareasDocs) {
      const pid = String(t.proyecto_id)
      const list = tareasPorProyecto.get(pid) ?? []
      list.push({ estado: String(t.estado) })
      tareasPorProyecto.set(pid, list)
    }

    const enriched = rows.map((p) => ({
      ...enrichProyectoAcceso(p as Record<string, unknown>, req.user!._id, req.user!.permisos ?? []),
      riesgo: calcularRiesgo(
        {
          estado: String(p.estado),
          fecha_inicio: p.fecha_inicio as Date | string | null | undefined,
          fecha_fin: p.fecha_fin as Date | string | null | undefined,
          porcentaje_avance: p.porcentaje_avance as number | undefined,
          createdAt: p.createdAt as Date | string | null | undefined,
        },
        tareasPorProyecto.get(String(p._id)) ?? [],
      ),
    }))

    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

proyectosRouter.get('/:id', async (req, res, next) => {
  try {
    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }
    const doc = await Proyecto.findOne({ _id: req.params.id, ...scope })
      .populate(POPULATE_FIELDS).lean()
    if (!doc) {
      res.status(404).json({ error: 'Proyecto no encontrado o sin acceso' })
      return
    }
    res.json(enrichProyectoAcceso(doc as Record<string, unknown>, req.user!._id, req.user!.permisos ?? []))
  } catch (err) {
    next(err)
  }
})

/**
 * Actualiza la lista de participantes del proyecto.
 * PUT /api/proyectos/:id/participantes  { participantes: [{ usuario_id, rol }] }
 */
proyectosRouter.put('/:id/participantes', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }

    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }

    const exists = await Proyecto.findOne({ _id: req.params.id, ...scope })
      .select('usuario_id participantes')
      .lean() as { usuario_id?: mongoose.Types.ObjectId; participantes?: unknown[] } | null
    if (!exists) {
      res.status(404).json({ error: 'Proyecto no encontrado o sin acceso' })
      return
    }

    if (!usuarioPuedeGestionarParticipantes(u._id, u.permisos ?? [], exists)) {
      res.status(403).json({ error: 'No tienes permiso para gestionar participantes de este proyecto' })
      return
    }

    const raw = (req.body as { participantes?: unknown }).participantes
    if (!Array.isArray(raw)) {
      res.status(400).json({ error: 'Envía participantes como arreglo de { usuario_id, rol }' })
      return
    }

    const ownerId = exists.usuario_id ? String(exists.usuario_id) : null
    const seen = new Set<string>()
    const participantes: Array<{
      usuario_id: mongoose.Types.ObjectId
      rol: 'editor' | 'lectura'
      agregado_en: Date
    }> = []

    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const uid = String((item as { usuario_id?: unknown }).usuario_id ?? '').trim()
      if (!mongoose.isValidObjectId(uid) || seen.has(uid)) continue
      if (ownerId && uid === ownerId) continue
      seen.add(uid)
      const rolRaw = String((item as { rol?: unknown }).rol ?? 'lectura')
      const rol: 'editor' | 'lectura' = rolRaw === 'editor' ? 'editor' : 'lectura'
      const usuarioOk = await Usuario.findById(uid).select('_id activo').lean()
      if (!usuarioOk || usuarioOk.activo === false) continue
      participantes.push({
        usuario_id: new mongoose.Types.ObjectId(uid),
        rol,
        agregado_en: new Date(),
      })
    }

    const doc = await Proyecto.findByIdAndUpdate(
      req.params.id,
      { participantes },
      { new: true, runValidators: true },
    ).populate(POPULATE_FIELDS).lean()

    res.json(enrichProyectoAcceso(doc as Record<string, unknown>, u._id, u.permisos ?? []))
  } catch (err) {
    next(err)
  }
})

proyectosRouter.post('/', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }

    if (!req.body?._id || typeof req.body._id !== 'string') {
      res.status(400).json({ error: 'El campo _id (código de proyecto) es obligatorio' })
      return
    }
    if (!req.body?.nombre || typeof req.body.nombre !== 'string') {
      res.status(400).json({ error: 'El campo nombre es obligatorio' })
      return
    }

    const payload = pickBody(req.body as Record<string, unknown>)
    // Defaults inteligentes según el usuario actual
    const usuarioFull = await Usuario.findById(u._id).select('_id departamento_id').lean()
    if (payload.usuario_id === undefined) payload.usuario_id = u._id
    if (payload.departamento_id === undefined && usuarioFull?.departamento_id) {
      payload.departamento_id = usuarioFull.departamento_id
    }

    const deptEff = payload.departamento_id ?? usuarioFull?.departamento_id
    const errKpi = await validateProyectoKpi(payload.kpi_id, deptEff)
    if (errKpi) {
      res.status(400).json({ error: errKpi })
      return
    }

    const doc = await Proyecto.create({
      _id: req.body._id,
      ...payload,
      historial: [{
        fecha: new Date(),
        de: null,
        a: (payload.estado as string) ?? 'Planificado',
        usuario_id: u._id,
        usuario_nombre: u.nombre,
        comentario: 'Creación del proyecto',
      }],
    })
    const full = await Proyecto.findById(doc._id).populate(POPULATE_FIELDS).lean()
    res.status(201).json(full)
  } catch (err) {
    next(err)
  }
})

proyectosRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }

    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }
    const exists = await Proyecto.findOne({ _id: id, ...scope }).select('_id estado usuario_id participantes').lean()
    if (!exists) {
      res.status(404).json({ error: 'Proyecto no encontrado o sin acceso' })
      return
    }
    if (!usuarioPuedeEditarProyecto(u._id, u.permisos ?? [], exists)) {
      res.status(403).json({ error: 'Solo lectura en este proyecto' })
      return
    }
    if (req.body?._id != null && String(req.body._id) !== id) {
      res.status(400).json({ error: 'No se puede cambiar el _id del proyecto' })
      return
    }
    const patch = pickBody(req.body as Record<string, unknown>)
    // El cambio de estado debe pasar por la ruta /transicion para auditoría.
    delete (patch as Record<string, unknown>).estado

    const current = await Proyecto.findById(id).select('departamento_id kpi_id').lean()
    const deptEff =
      patch.departamento_id !== undefined ? patch.departamento_id : current?.departamento_id
    const kpiEff = patch.kpi_id !== undefined ? patch.kpi_id : current?.kpi_id
    const errKpi = await validateProyectoKpi(kpiEff, deptEff)
    if (errKpi) {
      res.status(400).json({ error: errKpi })
      return
    }

    const doc = await Proyecto.findByIdAndUpdate(id, patch, {
      new: true, runValidators: true,
    }).populate(POPULATE_FIELDS).lean()
    res.json(enrichProyectoAcceso(doc as Record<string, unknown>, u._id, u.permisos ?? []))
  } catch (err) {
    next(err)
  }
})

proyectosRouter.delete('/:id', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }
    if (!u.permisos.includes('*') && !u.permisos.includes('proyectos:editar')) {
      res.status(403).json({ error: 'No tienes permiso para eliminar proyectos' })
      return
    }
    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }
    const exists = await Proyecto.findOne({ _id: req.params.id, ...scope }).select('_id').lean()
    if (!exists) {
      res.status(404).json({ error: 'Proyecto no encontrado o sin acceso' })
      return
    }
    const pid = String(req.params.id)
    await deleteProyectoCascade(pid)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/**
 * Transición de estado del proyecto. Registra historial.
 * POST /api/proyectos/:id/transicion  { a: 'Aprobado', comentario?: '…' }
 */
proyectosRouter.post('/:id/transicion', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }

    const a = (req.body as { a?: unknown }).a
    if (typeof a !== 'string' || !PROYECTO_ESTADOS.includes(a as (typeof PROYECTO_ESTADOS)[number])) {
      res.status(400).json({
        error: `Estado destino inválido. Permitidos: ${PROYECTO_ESTADOS.join(', ')}`,
      })
      return
    }
    const comentario = String((req.body as { comentario?: unknown }).comentario ?? '').trim() || undefined

    const scope = await buildScopeFilter(req)
    if (scope === null) { res.status(401).json({ error: 'No autenticado' }); return }
    const doc = await Proyecto.findOne({ _id: req.params.id, ...scope })
      .select('estado usuario_id participantes historial porcentaje_avance')
    if (!doc) {
      res.status(404).json({ error: 'Proyecto no encontrado o sin acceso' })
      return
    }
    if (!usuarioPuedeEditarProyecto(u._id, u.permisos ?? [], doc)) {
      res.status(403).json({ error: 'Solo lectura en este proyecto' })
      return
    }

    const previo = doc.estado
    if (previo === a) {
      res.status(400).json({ error: `El proyecto ya está en estado «${a}»` })
      return
    }

    doc.estado = a as (typeof PROYECTO_ESTADOS)[number]
    // Cuando se marca como Completado, fijamos avance al 100%.
    if (a === 'Completado') doc.porcentaje_avance = 100
    if (!Array.isArray(doc.historial)) doc.historial = []
    doc.historial.push({
      fecha: new Date(),
      de: previo,
      a,
      usuario_id: mongoose.isValidObjectId(u._id)
        ? new mongoose.Types.ObjectId(u._id)
        : undefined,
      usuario_nombre: u.nombre,
      comentario,
    })
    await doc.save()
    const full = await Proyecto.findById(doc._id).populate(POPULATE_FIELDS).lean()
    res.json(enrichProyectoAcceso(full as Record<string, unknown>, u._id, u.permisos ?? []))
  } catch (err) {
    next(err)
  }
})

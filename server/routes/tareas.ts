import fs from 'fs'
import path from 'path'
import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import xlsx from 'xlsx'

import { Empleado } from '../db/models/Empleado.js'
import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'
import { recalcularAvanceProyecto } from '../utils/proyectoAvance.js'
import {
  esColumnaKanban,
  estadoDesdeColumnaKanban,
  porcentajeParaColumnaKanban,
} from '../utils/tareaKanban.js'
import { usuarioPuedeMoverTarea, usuarioPuedeEditarTareasProyecto } from '../utils/tareaPermisos.js'
import {
  limpiarDependenciasRotas,
  validarDependenciasTarea,
} from '../utils/tareaDependencias.js'
import {
  ADJUNTOS_TAREAS_DIR,
  uploadAdjuntoTarea,
} from '../utils/multerAdjuntosTareas.js'
import { generarReporteSemanalTareas } from '../utils/reporteSemanalTareas.js'
import { normalizeTareaTags, parseTagsFromExcel } from '../utils/tareaTags.js'

export const tareasRouter = Router()

const uploadTareasExcel = multer({
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

const TAREA_ESTADOS = ['Pendiente', 'En progreso', 'Completado', 'Bloqueado'] as const
type TareaEstado = (typeof TAREA_ESTADOS)[number]

function normHeader(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCell(row: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(row)
  const wanted = aliases.map(normHeader)
  for (const [key, value] of entries) {
    if (wanted.includes(normHeader(key))) return value
  }
  return undefined
}

function text(row: Record<string, unknown>, aliases: string[]): string {
  return String(getCell(row, aliases) ?? '').trim()
}

function pct(raw: unknown): number {
  if (raw == null || raw === '') return 0
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)))
  }
  const n = Number(String(raw).replace('%', '').replace(',', '.').trim())
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
}

function parseDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  if (typeof raw === 'number') {
    const parsed = xlsx.SSF.parse_date_code(raw)
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, 12)
  }
  const s = String(raw).trim()
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
  const latam = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (latam) {
    const year = Number(latam[3]!.length === 2 ? `20${latam[3]}` : latam[3])
    return new Date(year, Number(latam[2]) - 1, Number(latam[1]), 12)
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseEstado(raw: unknown, porcentaje: number): TareaEstado {
  const s = normHeader(raw)
  if (!s) return porcentaje >= 100 ? 'Completado' : porcentaje > 0 ? 'En progreso' : 'Pendiente'
  if (['completado', 'completa', 'finalizado', 'finalizada', 'hecho', 'done'].includes(s)) return 'Completado'
  if (['en progreso', 'progreso', 'en proceso', 'proceso', 'in progress'].includes(s)) return 'En progreso'
  if (['bloqueado', 'bloqueada', 'bloqueo', 'blocked'].includes(s)) return 'Bloqueado'
  return 'Pendiente'
}

function rowToTarea(row: Record<string, unknown>, proyectoId: string, proyectoEje = '') {
  const porcentaje = pct(getCell(row, ['porcentaje', '%', '% avance', 'avance', 'progreso']))
  return {
    id: text(row, ['id', '_id', 'tarea_id', 'id tarea']),
    payload: {
      proyecto_id: proyectoId,
      nombre: text(row, ['nombre', 'tarea', 'actividad', 'task']),
      descripcion: text(row, ['descripcion', 'descripción', 'detalle', 'observaciones']) || undefined,
      responsable: text(row, ['responsable', 'asignado', 'owner', 'encargado']) || undefined,
      fecha_inicio: parseDate(getCell(row, ['fecha_inicio', 'inicio', 'fecha inicio', 'start'])),
      fecha_fin: parseDate(getCell(row, ['fecha_fin', 'fin', 'fecha fin', 'vencimiento', 'due date'])),
      estado: parseEstado(getCell(row, ['estado', 'estatus', 'status']), porcentaje),
      porcentaje,
      eje: text(row, ['eje', 'categoria', 'categoría']) || proyectoEje || undefined,
      tags: parseTagsFromExcel(getCell(row, ['tags', 'tag', 'etiquetas', 'etiqueta', 'labels'])),
    },
  }
}

/** Resuelve `responsable_id` a partir del nombre del responsable (texto). */
function eliminarAdjuntosFisicos(adjuntos?: Array<{ archivo: string }>): void {
  for (const adj of adjuntos ?? []) {
    const fp = path.join(ADJUNTOS_TAREAS_DIR, adj.archivo)
    if (fs.existsSync(fp)) {
      try { fs.unlinkSync(fp) } catch { /* noop */ }
    }
  }
}

async function resolverResponsableId(nombre: string | undefined): Promise<string | null> {
  if (!nombre) return null
  const trimmed = nombre.trim()
  if (!trimmed) return null
  const emp = await Empleado.findOne({
    nombre: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    activo: true,
  }).select('_id').lean() as { _id: mongoose.Types.ObjectId } | null
  return emp?._id ? String(emp._id) : null
}

tareasRouter.get('/', async (req, res, next) => {
  try {
    const { proyecto_id } = req.query
    if (typeof proyecto_id !== 'string' || !proyecto_id) {
      res.status(400).json({ error: 'Query proyecto_id es obligatorio' })
      return
    }
    const rows = await Tarea.find({ proyecto_id })
      .sort({ fecha_fin: 1, nombre: 1 })
      .lean()
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

/** Reporte semanal de tareas para gerencia. */
tareasRouter.get('/reporte-semanal', async (req, res, next) => {
  try {
    const semana = typeof req.query.semana === 'string' ? req.query.semana : ''
    if (!semana) {
      res.status(400).json({ error: 'Query semana es obligatorio (formato YYYY-Www)' })
      return
    }
    const alcance = typeof req.query.alcance === 'string' ? req.query.alcance : 'todos'
    const proyecto_id = typeof req.query.proyecto_id === 'string' ? req.query.proyecto_id : undefined
    const departamento_id = typeof req.query.departamento_id === 'string'
      ? req.query.departamento_id
      : undefined

    const result = await generarReporteSemanalTareas({
      semana,
      alcance,
      proyecto_id,
      departamento_id,
      userId: String(req.user!._id),
      permisos: req.user!.permisos ?? [],
    })
    if ('error' in result) {
      res.status(400).json({ error: result.error })
      return
    }
    res.json(result)
  } catch (err) {
    next(err)
  }
})

tareasRouter.post('/', async (req, res, next) => {
  try {
    if (!req.body?.proyecto_id || typeof req.body.proyecto_id !== 'string') {
      res.status(400).json({ error: 'proyecto_id es obligatorio' })
      return
    }
    if (!(await usuarioPuedeEditarTareasProyecto(req, req.body.proyecto_id))) {
      res.status(403).json({ error: 'Solo lectura en este proyecto' })
      return
    }
    const body = { ...req.body } as Record<string, unknown>
    // KPI/fuente_medicion ya no aplican a nivel de tarea
    delete body.kpi
    delete body.fuente_medicion

    if (!body.responsable_id && typeof body.responsable === 'string') {
      const rid = await resolverResponsableId(body.responsable)
      if (rid) body.responsable_id = rid
    }
    if ('depende_de_ids' in body) {
      const v = await validarDependenciasTarea(
        req.body.proyecto_id,
        null,
        body.depende_de_ids,
      )
      if (v.error) {
        res.status(400).json({ error: v.error })
        return
      }
      body.depende_de_ids = v.ids
    }
    if ('tags' in body) {
      body.tags = normalizeTareaTags(body.tags)
    }
    const doc = await Tarea.create(body)
    await recalcularAvanceProyecto(req.body.proyecto_id)
    res.status(201).json(doc)
  } catch (err) {
    next(err)
  }
})

tareasRouter.post('/importar-excel', (req, res, next) => {
  uploadTareasExcel(req, res, async (uploadErr) => {
    if (uploadErr) {
      next(uploadErr)
      return
    }
    try {
      const proyectoId = String(req.body?.proyecto_id ?? '').trim()
      if (!proyectoId) {
        res.status(400).json({ error: 'proyecto_id es obligatorio' })
        return
      }
      if (!req.file?.buffer) {
        res.status(400).json({ error: 'Archivo Excel es obligatorio' })
        return
      }

      const proyecto = await Proyecto.findById(proyectoId).select('_id eje').lean() as {
        _id: string
        eje?: string
      } | null
      if (!proyecto) {
        res.status(404).json({ error: 'Proyecto no encontrado' })
        return
      }
      if (!(await usuarioPuedeEditarTareasProyecto(req, proyectoId))) {
        res.status(403).json({ error: 'Solo lectura en este proyecto' })
        return
      }

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

      let creadas = 0
      let actualizadas = 0
      let omitidas = 0
      const errores: { fila: number; error: string }[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!
        const { id, payload } = rowToTarea(row, proyectoId, proyecto.eje ?? '')
        if (!payload.nombre) {
          omitidas++
          errores.push({ fila: i + 2, error: 'Sin nombre de tarea' })
          continue
        }

        const existing = (id && mongoose.isValidObjectId(id)
          ? await Tarea.findOne({ _id: id, proyecto_id: proyectoId }).select('_id').lean()
          : await Tarea.findOne({
              proyecto_id: proyectoId,
              nombre: new RegExp(`^${payload.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            }).select('_id').lean()) as { _id: mongoose.Types.ObjectId } | null

        const responsableId = await resolverResponsableId(payload.responsable)
        const fullPayload: Record<string, unknown> = { ...payload }
        if (responsableId) fullPayload.responsable_id = responsableId
        const ridExcel = text(row, ['responsable_id', 'id empleado', 'empleado_id', 'empleado id'])
        if (ridExcel && mongoose.isValidObjectId(ridExcel)) {
          fullPayload.responsable_id = ridExcel
        }

        if (existing?._id) {
          await Tarea.findByIdAndUpdate(existing._id, fullPayload, { runValidators: true })
          actualizadas++
        } else {
          await Tarea.create(fullPayload)
          creadas++
        }
      }

      await recalcularAvanceProyecto(proyectoId)
      res.json({
        ok: true,
        hoja: sheetName,
        totalFilas: rows.length,
        creadas,
        actualizadas,
        omitidas,
        errores: errores.slice(0, 20),
      })
    } catch (err) {
      next(err)
    }
  })
})

/**
 * Genera una plantilla Excel para la carga masiva de tareas.
 *
 * - Si se pasa `proyecto_id`, las tareas existentes se precargan con su `ID`,
 *   para que el usuario pueda actualizar de manera segura.
 * - Si no, devuelve sólo un ejemplo y la hoja de instrucciones.
 */
tareasRouter.get('/plantilla-excel', async (req, res, next) => {
  try {
    const proyectoId = typeof req.query.proyecto_id === 'string' ? req.query.proyecto_id : ''

    const COLS = [
      'ID',
      'Nombre',
      'Descripcion',
      'Responsable',
      'Inicio',
      'Fin',
      'Estado',
      '% avance',
      'Eje',
      'Tags',
    ] as const

    function toIsoDate(d: Date | string | null | undefined): string {
      if (!d) return ''
      const date = d instanceof Date ? d : new Date(d)
      if (Number.isNaN(date.getTime())) return ''
      const yyyy = date.getFullYear()
      const mm = String(date.getMonth() + 1).padStart(2, '0')
      const dd = String(date.getDate()).padStart(2, '0')
      return `${dd}/${mm}/${yyyy}`
    }

    type Row = Record<(typeof COLS)[number], string | number>
    const rowsData: Row[] = []
    let proyectoNombre = ''
    let proyectoEje = ''

    if (proyectoId && mongoose.isValidObjectId(proyectoId)) {
      const proyecto = (await Proyecto.findById(proyectoId)
        .select('_id nombre eje')
        .lean()) as { _id: string; nombre?: string; eje?: string } | null
      if (proyecto) {
        proyectoNombre = proyecto.nombre ?? ''
        proyectoEje = proyecto.eje ?? ''
        const tareas = (await Tarea.find({ proyecto_id: proyectoId })
          .sort({ fecha_fin: 1, nombre: 1 })
          .lean()) as Array<{
            _id: mongoose.Types.ObjectId
            nombre?: string
            descripcion?: string
            responsable?: string
            fecha_inicio?: Date
            fecha_fin?: Date
            estado?: string
            porcentaje?: number
            eje?: string
            tags?: string[]
          }>
        for (const t of tareas) {
          rowsData.push({
            ID: String(t._id),
            Nombre: t.nombre ?? '',
            Descripcion: t.descripcion ?? '',
            Responsable: t.responsable ?? '',
            Inicio: toIsoDate(t.fecha_inicio),
            Fin: toIsoDate(t.fecha_fin),
            Estado: t.estado ?? 'Pendiente',
            '% avance': t.porcentaje ?? 0,
            Eje: t.eje ?? '',
            Tags: (t.tags ?? []).join(', '),
          })
        }
      }
    }

    if (rowsData.length === 0) {
      rowsData.push({
        ID: '',
        Nombre: 'Ejemplo: Configurar firewall perimetral',
        Descripcion: 'Habilitar reglas y políticas según hardening',
        Responsable: 'Juan Pérez',
        Inicio: toIsoDate(new Date()),
        Fin: toIsoDate(new Date(Date.now() + 14 * 86400000)),
        Estado: 'En progreso',
        '% avance': 25,
        Eje: proyectoEje || 'Seguridad',
        Tags: 'urgente, seguridad',
      })
    }

    const wb = xlsx.utils.book_new()
    const ws = xlsx.utils.json_to_sheet(rowsData, { header: [...COLS] })
    ;(ws as { '!cols'?: { wch: number }[] })['!cols'] = [
      { wch: 26 }, { wch: 38 }, { wch: 40 }, { wch: 22 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 24 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Tareas')

    const instrucciones = [
      ['Plantilla de carga masiva de tareas — RCJ IT Manager'],
      [],
      proyectoNombre ? [`Proyecto: ${proyectoNombre}`] : ['Proyecto: (sin asociar)'],
      proyectoEje ? [`Eje del proyecto: ${proyectoEje}`] : [],
      [],
      ['Cómo usar esta plantilla:'],
      ['1. Edita las filas de la hoja "Tareas".'],
      ['2. Para ACTUALIZAR una tarea existente, conserva su valor en la columna ID.'],
      ['3. Para CREAR una tarea nueva, deja la columna ID en blanco. Si ya existe '
        + 'una tarea con el mismo nombre dentro del proyecto, también se actualizará.'],
      ['4. Sube el archivo con el botón "Subir Excel" en el detalle del proyecto.'],
      [],
      ['Formato de columnas:'],
      ['ID', 'Identificador de la tarea (no editar). Si va vacío se crea una nueva.'],
      ['Nombre', 'Obligatorio. Las filas sin nombre se omiten.'],
      ['Descripcion', 'Opcional.'],
      ['Responsable', 'Nombre completo del empleado (se intenta vincular automáticamente).'],
      ['Inicio', 'Fecha DD/MM/YYYY o YYYY-MM-DD.'],
      ['Fin', 'Fecha DD/MM/YYYY o YYYY-MM-DD.'],
      ['Estado', 'Pendiente | En progreso | Completado | Bloqueado.'],
      ['% avance', 'Número entero 0-100. Si es 100, el estado se asume Completado.'],
      ['Eje', 'Categoría del proyecto. Si va vacío se hereda del proyecto.'],
      ['Tags', 'Etiquetas separadas por coma (ej. urgente, infra, fase-1).'],
      [],
      ['Nota: El KPI ahora se asocia al proyecto, no a la tarea.'],
    ].filter((r) => r.length > 0)

    const wsInfo = xlsx.utils.aoa_to_sheet(instrucciones)
    ;(wsInfo as { '!cols'?: { wch: number }[] })['!cols'] = [{ wch: 22 }, { wch: 80 }]
    xlsx.utils.book_append_sheet(wb, wsInfo, 'Instrucciones')

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const fname = proyectoNombre
      ? `Tareas-${proyectoNombre.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40)}.xlsx`
      : 'Tareas-plantilla.xlsx'
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
})

/** GET /api/tareas/exportar-excel?proyecto_id=xxx — descarga las tareas del proyecto como Excel. */
tareasRouter.get('/exportar-excel', async (req, res, next) => {
  try {
    const u = req.user
    if (!u) { res.status(401).json({ error: 'No autenticado' }); return }

    const proyectoId = typeof req.query.proyecto_id === 'string' ? req.query.proyecto_id : ''
    if (!proyectoId || !mongoose.isValidObjectId(proyectoId)) {
      res.status(400).json({ error: 'Parámetro proyecto_id requerido' })
      return
    }

    const proyecto = await Proyecto.findById(proyectoId).select('_id nombre eje').lean() as
      | { _id: mongoose.Types.ObjectId; nombre?: string; eje?: string } | null

    if (!proyecto) {
      res.status(404).json({ error: 'Proyecto no encontrado' })
      return
    }

    const tareas = await Tarea.find({ proyecto_id: proyectoId })
      .sort({ fecha_fin: 1, nombre: 1 })
      .lean() as Array<{
        _id: mongoose.Types.ObjectId
        nombre?: string
        descripcion?: string
        responsable?: string
        fecha_inicio?: Date
        fecha_fin?: Date
        estado?: string
        porcentaje?: number
        eje?: string
        tags?: string[]
        createdAt?: Date
      }>

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
      'Nombre', 'Descripción', 'Responsable', 'Inicio', 'Fin',
      'Estado', '% Avance', 'Eje', 'Tags', 'Creado',
    ] as const

    const rowsData = tareas.map((t) => ({
      Nombre: t.nombre ?? '',
      'Descripción': t.descripcion ?? '',
      Responsable: t.responsable ?? '',
      Inicio: toDate(t.fecha_inicio),
      Fin: toDate(t.fecha_fin),
      Estado: t.estado ?? '',
      '% Avance': t.porcentaje ?? 0,
      Eje: t.eje ?? proyecto.eje ?? '',
      Tags: (t.tags ?? []).join(', '),
      Creado: toDate(t.createdAt),
    }))

    const wb = xlsx.utils.book_new()

    const wsInfo = xlsx.utils.aoa_to_sheet([
      [`Proyecto: ${proyecto.nombre ?? ''}`],
      proyecto.eje ? [`Eje: ${proyecto.eje}`] : [],
      [`Total tareas: ${tareas.length}`],
    ].filter((r) => r.length > 0))
    ;(wsInfo as { '!cols'?: { wch: number }[] })['!cols'] = [{ wch: 60 }]
    xlsx.utils.book_append_sheet(wb, wsInfo, 'Info')

    const ws = xlsx.utils.json_to_sheet(rowsData, { header: [...COLS] })
    ;(ws as { '!cols'?: { wch: number }[] })['!cols'] = [
      { wch: 40 }, { wch: 40 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
      { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 12 },
    ]
    xlsx.utils.book_append_sheet(wb, ws, 'Tareas')

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const safeName = (proyecto.nombre ?? 'Tareas').replace(/[^A-Za-z0-9_\- ]/g, '_').slice(0, 40)
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="Tareas-${safeName}-${stamp}.xlsx"`)
    res.send(buf)
  } catch (err) {
    next(err)
  }
})

/**
 * Elimina varias tareas y sus archivos adjuntos.
 * POST /api/tareas/eliminar-lote  { ids: string[], proyecto_id?: string }
 */
tareasRouter.post('/eliminar-lote', async (req, res, next) => {
  try {
    const body = req.body as { ids?: unknown; proyecto_id?: unknown }
    const raw = body.ids
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: 'Envía un arreglo ids con al menos un id de tarea.' })
      return
    }
    const ids = [...new Set(
      raw.map((x) => String(x).trim()).filter((id) => mongoose.isValidObjectId(id)),
    )]
    if (ids.length === 0) {
      res.status(400).json({ error: 'Ningún identificador de tarea es válido.' })
      return
    }
    if (ids.length > 200) {
      res.status(400).json({ error: 'Máximo 200 tareas por solicitud.' })
      return
    }

    const proyectoId = typeof body.proyecto_id === 'string' ? body.proyecto_id.trim() : ''
    const filter: Record<string, unknown> = { _id: { $in: ids } }
    if (proyectoId) filter.proyecto_id = proyectoId

    const tareas = await Tarea.find(filter).select('proyecto_id adjuntos').lean() as Array<{
      _id: mongoose.Types.ObjectId
      proyecto_id: string
      adjuntos?: Array<{ archivo: string }>
    }>

    const eliminarIds = tareas.map((t) => String(t._id))
    const omitidos = ids.filter((id) => !eliminarIds.includes(id))

    const proyectosAfectados = [...new Set(tareas.map((t) => t.proyecto_id))]
    for (const pid of proyectosAfectados) {
      if (!(await usuarioPuedeEditarTareasProyecto(req, pid))) {
        res.status(403).json({ error: 'Solo lectura en uno o más proyectos del lote' })
        return
      }
    }

    for (const t of tareas) {
      eliminarAdjuntosFisicos(t.adjuntos)
    }
    if (eliminarIds.length > 0) {
      await Tarea.deleteMany({ _id: { $in: eliminarIds } })
    }

    for (const pid of proyectosAfectados) {
      await limpiarDependenciasRotas(pid, eliminarIds)
      await recalcularAvanceProyecto(pid)
    }

    res.json({
      eliminados: eliminarIds.length,
      ids: eliminarIds,
      omitidos,
    })
  } catch (err) {
    next(err)
  }
})

/** Mueve una tarea en el tablero Kanban (solo dueño del proyecto o responsable). */
tareasRouter.patch('/:id/estado-kanban', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const columna = (req.body as { columna?: unknown }).columna
    if (!esColumnaKanban(columna)) {
      res.status(400).json({ error: 'columna debe ser todo, in_progress o done' })
      return
    }

    const prev = await Tarea.findById(id)
      .select('proyecto_id responsable_id estado porcentaje depende_de_ids')
      .lean() as {
      proyecto_id: string
      responsable_id?: mongoose.Types.ObjectId | null
      estado: string
      porcentaje: number
      depende_de_ids?: mongoose.Types.ObjectId[]
    } | null
    if (!prev) {
      res.status(404).json({ error: 'Tarea no encontrada' })
      return
    }

    const puede = await usuarioPuedeMoverTarea(req, prev)
    if (!puede) {
      res.status(403).json({
        error: 'Solo el dueño del proyecto o el responsable de la tarea pueden moverla en el tablero.',
      })
      return
    }

    const nuevoEstado = estadoDesdeColumnaKanban(columna)
    const nuevoPct = porcentajeParaColumnaKanban(columna, prev.porcentaje ?? 0)

    const doc = await Tarea.findByIdAndUpdate(
      id,
      { estado: nuevoEstado, porcentaje: nuevoPct },
      { new: true, runValidators: true },
    ).lean()

    await recalcularAvanceProyecto(prev.proyecto_id)
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

tareasRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const prev = await Tarea.findById(id).select('proyecto_id').lean() as {
      proyecto_id: string
    } | null
    if (!prev) {
      res.status(404).json({ error: 'Tarea no encontrada' })
      return
    }
    if (!(await usuarioPuedeEditarTareasProyecto(req, prev.proyecto_id))) {
      res.status(403).json({ error: 'Solo lectura en este proyecto' })
      return
    }
    const {
      __v, createdAt, updatedAt, _id,
      kpi: _kpi, fuente_medicion: _fuenteMed,
      adjuntos: _adjuntos, // los adjuntos se gestionan por sus propios endpoints
      ...rest
    } = req.body as Record<string, unknown>
    void __v; void createdAt; void updatedAt; void _id; void _kpi; void _fuenteMed; void _adjuntos

    if (!rest.responsable_id && typeof rest.responsable === 'string') {
      const rid = await resolverResponsableId(rest.responsable)
      if (rid) rest.responsable_id = rid
    }

    if ('depende_de_ids' in rest) {
      const v = await validarDependenciasTarea(prev.proyecto_id, id, rest.depende_de_ids)
      if (v.error) {
        res.status(400).json({ error: v.error })
        return
      }
      rest.depende_de_ids = v.ids
    }

    if ('tags' in rest) {
      rest.tags = normalizeTareaTags(rest.tags)
    }

    const doc = await Tarea.findByIdAndUpdate(id, rest, {
      new: true,
      runValidators: true,
    }).lean()
    const pid = (doc as { proyecto_id?: string })?.proyecto_id ?? prev.proyecto_id
    await recalcularAvanceProyecto(pid)
    res.json(doc)
  } catch (err) {
    next(err)
  }
})

tareasRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const prev = await Tarea.findById(id).select('proyecto_id adjuntos').lean() as {
      proyecto_id: string
      adjuntos?: Array<{ archivo: string }>
    } | null
    if (!prev) {
      res.status(404).json({ error: 'Tarea no encontrada' })
      return
    }
    if (!(await usuarioPuedeEditarTareasProyecto(req, prev.proyecto_id))) {
      res.status(403).json({ error: 'Solo lectura en este proyecto' })
      return
    }
    eliminarAdjuntosFisicos(prev.adjuntos)
    await Tarea.findByIdAndDelete(id)
    await limpiarDependenciasRotas(prev.proyecto_id, [id])
    await recalcularAvanceProyecto(prev.proyecto_id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

/* ============================================================
 * Comentarios de tareas
 * ============================================================ */

tareasRouter.post('/:id/comentarios', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const texto = String((req.body as { texto?: unknown }).texto ?? '').trim()
    if (!texto) {
      res.status(400).json({ error: 'El comentario no puede estar vacío' })
      return
    }

    const tarea = await Tarea.findById(id).select('proyecto_id comentarios')
    if (!tarea) {
      res.status(404).json({ error: 'Tarea no encontrada' })
      return
    }

    const comentario = {
      texto,
      autor: req.user?.nombre ?? req.user?.email ?? 'Usuario',
      autor_id: req.user?._id ?? null,
    }
    tarea.comentarios.push(comentario)
    await tarea.save()
    const saved = tarea.comentarios[tarea.comentarios.length - 1]
    res.status(201).json(saved)
  } catch (err) {
    next(err)
  }
})

/* ============================================================
 * Adjuntos de tareas
 * ============================================================ */

/** Lista los adjuntos de una tarea. */
tareasRouter.get('/:id/adjuntos', async (req, res, next) => {
  try {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const tarea = await Tarea.findById(id).select('adjuntos').lean() as {
      adjuntos?: Array<{
        _id: mongoose.Types.ObjectId
        nombre_original: string
        archivo: string
        mime_type?: string
        size_bytes?: number
        subido_por?: string
        subido_en?: Date
      }>
    } | null
    if (!tarea) {
      res.status(404).json({ error: 'Tarea no encontrada' })
      return
    }
    res.json(tarea.adjuntos ?? [])
  } catch (err) {
    next(err)
  }
})

/** Sube un adjunto a la tarea. Form-data: archivo. */
tareasRouter.post('/:id/adjuntos', (req, res, next) => {
  uploadAdjuntoTarea(req, res, async (uploadErr) => {
    if (uploadErr) {
      next(uploadErr)
      return
    }
    try {
      const { id } = req.params
      if (!mongoose.isValidObjectId(id)) {
        res.status(400).json({ error: 'Identificador inválido' })
        return
      }
      if (!req.file) {
        res.status(400).json({ error: 'Archivo es obligatorio' })
        return
      }
      const tarea = await Tarea.findById(id)
      if (!tarea) {
        // Borrar archivo huérfano si la tarea no existe
        if (req.file?.filename) {
          const fp = path.join(ADJUNTOS_TAREAS_DIR, req.file.filename)
          if (fs.existsSync(fp)) { try { fs.unlinkSync(fp) } catch { /* noop */ } }
        }
        res.status(404).json({ error: 'Tarea no encontrada' })
        return
      }
      const adjunto = {
        nombre_original: req.file.originalname,
        archivo: req.file.filename,
        mime_type: req.file.mimetype || '',
        size_bytes: req.file.size || 0,
        subido_por: req.user?.nombre ?? req.user?.email ?? '',
        subido_en: new Date(),
      }
      tarea.adjuntos.push(adjunto)
      await tarea.save()
      const saved = tarea.adjuntos
      res.status(201).json(saved[saved.length - 1])
    } catch (err) {
      next(err)
    }
  })
})

/** Elimina un adjunto de la tarea (incluye archivo físico). */
tareasRouter.delete('/:id/adjuntos/:adjuntoId', async (req, res, next) => {
  try {
    const { id, adjuntoId } = req.params
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(adjuntoId)) {
      res.status(400).json({ error: 'Identificador inválido' })
      return
    }
    const tarea = await Tarea.findById(id)
    if (!tarea) {
      res.status(404).json({ error: 'Tarea no encontrada' })
      return
    }
    const adjuntos = (tarea as unknown as {
      adjuntos: Array<{ _id: mongoose.Types.ObjectId; archivo: string }>
    }).adjuntos
    const idx = adjuntos.findIndex((a) => String(a._id) === adjuntoId)
    if (idx === -1) {
      res.status(404).json({ error: 'Adjunto no encontrado' })
      return
    }
    const target = adjuntos[idx]!
    const fp = path.join(ADJUNTOS_TAREAS_DIR, target.archivo)
    if (fs.existsSync(fp)) {
      try { fs.unlinkSync(fp) } catch { /* noop */ }
    }
    adjuntos.splice(idx, 1)
    await tarea.save()
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

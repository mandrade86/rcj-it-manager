import fs from 'fs'
import path from 'path'
import type { Request, RequestHandler } from 'express'
import { Router } from 'express'
import mongoose from 'mongoose'
import xlsx from 'xlsx'

import { Departamento } from '../db/models/Departamento.js'
import { Usuario } from '../db/models/Usuario.js'
import { parseOpexSheet, type OpexParseResult } from '../utils/gastosOpexParse.js'
import {
  parseFinancialQuerySheet,
  type GastosFinancieroParse,
} from '../utils/gastosQuery1Parse.js'

// ─── Nombres de hoja ──────────────────────────────────────────────────────────

const PREFERRED_OPEX_SHEETS = ['Base OPEX (Gastos)', 'Base OPEX', 'OPEX']
const FINANCIAL_PATTERNS = [/^query\s*1$/i, /^consulta\s*1$/i, /^query1$/i, /^consulta1$/i]
const FINANCIAL_EXACT  = ['Análisis financiero', 'Analisis financiero', 'Financial summary']

function isFinancialSheet(name: string): boolean {
  if (FINANCIAL_PATTERNS.some((re) => re.test(name))) return true
  return FINANCIAL_EXACT.includes(name)
}

function pickOpexSheet(wb: xlsx.WorkBook): string {
  for (const n of PREFERRED_OPEX_SHEETS) if (wb.SheetNames.includes(n)) return n
  const notFin = wb.SheetNames.filter((n) => !isFinancialSheet(n))
  return notFin[0] ?? wb.SheetNames[0] ?? 'Sheet1'
}

function pickFinancialSheet(wb: xlsx.WorkBook): string | null {
  return wb.SheetNames.find(isFinancialSheet) ?? null
}

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export type GastosContexto = {
  departamento_id: string
  departamento_codigo: string
  departamento_nombre: string
  archivoRelativo: string
}

export type GastosOpexResponse = {
  archivo: string
  archivoExiste: boolean
  hoja?: string
  periodos: string[]
  categorias: OpexParseResult['categorias']
  totalAnual: number
  meta20: number
  ahorroProyectado: number
  advertencia?: string
  contexto?: GastosContexto
}

export type GastosFinancieroResponse = GastosFinancieroParse & {
  archivo: string
  archivoExiste: boolean
  contexto?: GastosContexto
}

// ─── Resolución por departamento ──────────────────────────────────────────────

type DepartamentoDoc = {
  _id: unknown
  codigo: string
  nombre: string
  lleva_gastos?: boolean
  archivo_gastos?: string
  activo?: boolean
}

const lastSyncByDept: Record<string, string> = {}

function defaultArchivoForCodigo(codigo: string): string {
  const safe = codigo.replace(/[^A-Za-z0-9_-]+/g, '').toLowerCase()
  return path.posix.join('data', `gastos-${safe}.xlsx`)
}

function absolutePath(rel: string): string {
  // Normaliza separadores y monta sobre el cwd del server.
  const parts = rel.split(/[\\/]+/).filter(Boolean)
  return path.join(process.cwd(), ...parts)
}

/**
 * Devuelve el departamento_id del usuario. Si el JWT no lo trae (tokens emitidos
 * antes de incorporar el campo al payload), lo busca en la base.
 */
async function resolveUserDepartamentoId(req: Request): Promise<string | null> {
  const fromJwt = req.user?.departamento_id
  if (fromJwt) return fromJwt
  const uid = req.user?._id
  if (!uid || !mongoose.isValidObjectId(uid)) return null
  const u = await Usuario.findById(uid)
    .select('departamento_id')
    .lean<{ departamento_id?: mongoose.Types.ObjectId | string | null } | null>()
  return u?.departamento_id ? String(u.departamento_id) : null
}

async function resolveDepartamentoForRequest(req: Request): Promise<
  | { ok: true; dept: DepartamentoDoc }
  | { ok: false; status: number; error: string }
> {
  const isAdmin = req.user?.permisos?.includes('*') ?? false
  const requested = typeof req.query.departamento_id === 'string' ? req.query.departamento_id : null
  const userDept = await resolveUserDepartamentoId(req)

  // Admin puede consultar cualquier departamento.
  if (isAdmin && requested) {
    if (!mongoose.isValidObjectId(requested)) {
      return { ok: false, status: 400, error: 'Identificador de departamento inválido' }
    }
    const dept = await Departamento.findById(requested).lean<DepartamentoDoc | null>()
    if (!dept) return { ok: false, status: 404, error: 'Departamento no encontrado' }
    if (!dept.lleva_gastos) {
      return { ok: false, status: 400, error: 'Este departamento no maneja gastos' }
    }
    return { ok: true, dept }
  }

  // Si el usuario pide un departamento específico (vía query), debe coincidir
  // con su departamento asignado. Esto evita un 403 inesperado cuando el
  // cliente envía `?departamento_id=` con el mismo departamento del usuario.
  if (!isAdmin && requested) {
    if (!mongoose.isValidObjectId(requested)) {
      return { ok: false, status: 400, error: 'Identificador de departamento inválido' }
    }
    if (!userDept || String(userDept) !== String(requested)) {
      return { ok: false, status: 403, error: 'No tienes acceso a ese departamento.' }
    }
    const dept = await Departamento.findById(requested).lean<DepartamentoDoc | null>()
    if (!dept) return { ok: false, status: 404, error: 'Departamento no encontrado' }
    if (!dept.lleva_gastos) {
      return {
        ok: false,
        status: 403,
        error: 'Tu departamento no tiene habilitado el módulo de gastos.',
      }
    }
    return { ok: true, dept }
  }

  // Si el usuario tiene departamento asignado, usar ese.
  if (userDept && mongoose.isValidObjectId(userDept)) {
    const dept = await Departamento.findById(userDept).lean<DepartamentoDoc | null>()
    if (!dept) return { ok: false, status: 404, error: 'Departamento asignado no encontrado' }
    if (!dept.lleva_gastos) {
      return {
        ok: false,
        status: 403,
        error: 'Tu departamento no tiene habilitado el módulo de gastos.',
      }
    }
    return { ok: true, dept }
  }

  // Admin sin selección: tomar el primer departamento con lleva_gastos.
  if (isAdmin) {
    const dept = await Departamento.findOne({ lleva_gastos: true, activo: true })
      .sort({ codigo: 1 })
      .lean<DepartamentoDoc | null>()
    if (!dept) {
      return {
        ok: false,
        status: 404,
        error: 'No hay departamentos configurados con manejo de gastos.',
      }
    }
    return { ok: true, dept }
  }

  return { ok: false, status: 403, error: 'No tienes acceso al módulo de gastos.' }
}

function archivoRelativoFor(dept: DepartamentoDoc): string {
  const custom = (dept.archivo_gastos ?? '').trim()
  return custom || defaultArchivoForCodigo(dept.codigo)
}

function ctxFromDept(dept: DepartamentoDoc): GastosContexto {
  return {
    departamento_id: String(dept._id),
    departamento_codigo: dept.codigo,
    departamento_nombre: dept.nombre,
    archivoRelativo: archivoRelativoFor(dept),
  }
}

// ─── Lectura del workbook ─────────────────────────────────────────────────────

function readWb(archivoRel: string): {
  wb: xlsx.WorkBook | null
  archivoExiste: boolean
  readError: boolean
} {
  // Intenta primero el archivo específico del departamento; si no existe, prueba
  // el archivo legacy `data/gastos.xlsx` como fallback amigable.
  const candidates = [absolutePath(archivoRel)]
  const fallback = absolutePath('data/gastos.xlsx')
  if (!candidates.includes(fallback)) candidates.push(fallback)

  for (const fp of candidates) {
    if (!fs.existsSync(fp)) continue
    try {
      const wb = xlsx.readFile(fp, { cellDates: true, raw: false })
      return { wb, archivoExiste: true, readError: false }
    } catch {
      return { wb: null, archivoExiste: true, readError: true }
    }
  }
  return { wb: null, archivoExiste: false, readError: false }
}

function sheetRows(wb: xlsx.WorkBook, name: string): unknown[][] {
  const sheet = wb.Sheets[name]
  if (!sheet) return []
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
}

// ─── Carga OPEX ───────────────────────────────────────────────────────────────

function emptyOpex(archivoRel: string, archivoExiste: boolean, advertencia?: string): GastosOpexResponse {
  return {
    archivo: archivoRel,
    archivoExiste,
    hoja: '',
    periodos: [],
    categorias: [],
    totalAnual: 0,
    meta20: 0,
    ahorroProyectado: 0,
    advertencia,
  }
}

function loadOpex(
  wb: xlsx.WorkBook | null,
  archivoRel: string,
  archivoExiste: boolean,
  readError: boolean,
): GastosOpexResponse {
  if (!archivoExiste) return emptyOpex(archivoRel, false)
  if (readError || !wb) return emptyOpex(archivoRel, true, 'No se pudo leer el archivo Excel.')
  const sheetName = pickOpexSheet(wb)
  const rows = sheetRows(wb, sheetName)
  if (!rows.length) return emptyOpex(archivoRel, true, 'La hoja OPEX está vacía.')
  const parsed = parseOpexSheet(rows, sheetName)
  return { archivo: archivoRel, archivoExiste: true, ...parsed }
}

// ─── Carga Financiero ─────────────────────────────────────────────────────────

const EMPTY_PARSED: GastosFinancieroParse = {
  hoja: '',
  columnasDetectadas: { ano: null, categoria: '—', tipo: '—', descripcion: null, monto: '—' },
  anos: [], categorias: [],
  totalCapex: 0, totalOpex: 0,
  porCategoria: [], porAno: [], porTipoCategoria: [], matriz: [], filas: [],
}

function loadFinanciero(
  wb: xlsx.WorkBook | null,
  archivoRel: string,
  archivoExiste: boolean,
  readError: boolean,
): GastosFinancieroResponse {
  const base = (parsed: GastosFinancieroParse, existe = true): GastosFinancieroResponse => ({
    archivo: archivoRel,
    archivoExiste: existe,
    ...parsed,
  })

  if (!archivoExiste) return base({ ...EMPTY_PARSED }, false)
  if (readError || !wb) return base({ ...EMPTY_PARSED, advertencia: 'No se pudo leer el archivo Excel.' })

  const finName = pickFinancialSheet(wb)
  if (!finName) {
    return base({
      ...EMPTY_PARSED,
      advertencia:
        'No se encontró hoja Query1 / Consulta1. ' +
        'Exporte la consulta de Power Query a una hoja con ese nombre.',
    })
  }

  const rows = sheetRows(wb, finName)
  if (!rows.length) return base({ ...EMPTY_PARSED, hoja: finName, advertencia: 'La hoja está vacía.' })

  const parsed = parseFinancialQuerySheet(rows, finName)
  return base(parsed)
}

// ─── Diagnóstico del Excel ────────────────────────────────────────────────────

function diagnosticoExcel(wb: xlsx.WorkBook | null, archivoExiste: boolean) {
  if (!archivoExiste) return { archivoExiste: false, hojas: [] }
  if (!wb) return { archivoExiste: true, hojas: [], error: 'No se pudo leer el archivo.' }

  const hojas = wb.SheetNames.map((nombre) => {
    const sheet = wb.Sheets[nombre]
    let cabeceras: string[] = []
    let filas = 0
    if (sheet) {
      const rows = xlsx.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][]
      filas = Math.max(0, rows.length - 1)
      for (const row of rows.slice(0, 10)) {
        const cols = (row as unknown[]).map((c) => String(c ?? '').trim()).filter(Boolean)
        if (cols.length >= 2) { cabeceras = cols; break }
      }
    }
    return {
      nombre,
      esFinanciera: isFinancialSheet(nombre),
      esOpex: PREFERRED_OPEX_SHEETS.includes(nombre),
      cabeceras,
      filas,
    }
  })

  return { archivoExiste: true, hojas }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const gastosRouter = Router()

/**
 * Lista los departamentos con manejo de gastos visibles para el usuario.
 * - Admin: ve todos los departamentos con `lleva_gastos = true`.
 * - Otros: ven sólo su departamento (si es elegible).
 */
const listarDepartamentos: RequestHandler = async (req, res, next) => {
  try {
    const isAdmin = req.user?.permisos?.includes('*') ?? false
    const userDept = await resolveUserDepartamentoId(req)

    // No admin sin departamento (o con id inválido): no hay departamentos elegibles.
    if (!isAdmin) {
      if (!userDept || !mongoose.isValidObjectId(userDept)) {
        res.json([])
        return
      }
    }

    const filtro: Record<string, unknown> = { lleva_gastos: true, activo: true }
    if (!isAdmin) filtro._id = userDept

    const docs = await Departamento.find(filtro)
      .select('_id codigo nombre archivo_gastos')
      .sort({ codigo: 1 })
      .lean()
    res.json(
      docs.map((d) => ({
        _id: String(d._id),
        codigo: d.codigo,
        nombre: d.nombre,
        archivoRelativo: archivoRelativoFor(d as DepartamentoDoc),
      })),
    )
  } catch (e) {
    next(e)
  }
}

gastosRouter.get('/departamentos', listarDepartamentos)

gastosRouter.get('/opex', async (req, res, next) => {
  try {
    const resolved = await resolveDepartamentoForRequest(req)
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error })
      return
    }
    const ctx = ctxFromDept(resolved.dept)
    const { wb, archivoExiste, readError } = readWb(ctx.archivoRelativo)
    lastSyncByDept[ctx.departamento_id] = new Date().toISOString()
    res.json({
      ...loadOpex(wb, ctx.archivoRelativo, archivoExiste, readError),
      contexto: ctx,
    })
  } catch (e) { next(e) }
})

gastosRouter.get('/financiero', async (req, res, next) => {
  try {
    const resolved = await resolveDepartamentoForRequest(req)
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error })
      return
    }
    const ctx = ctxFromDept(resolved.dept)
    const { wb, archivoExiste, readError } = readWb(ctx.archivoRelativo)
    res.json({
      ...loadFinanciero(wb, ctx.archivoRelativo, archivoExiste, readError),
      contexto: ctx,
    })
  } catch (e) { next(e) }
})

gastosRouter.get('/diagnostico', async (req, res, next) => {
  try {
    const resolved = await resolveDepartamentoForRequest(req)
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error })
      return
    }
    const ctx = ctxFromDept(resolved.dept)
    const { wb, archivoExiste } = readWb(ctx.archivoRelativo)
    res.json({ ...diagnosticoExcel(wb, archivoExiste), contexto: ctx })
  } catch (e) { next(e) }
})

gastosRouter.get('/ultimo-sync', async (req, res, next) => {
  try {
    const resolved = await resolveDepartamentoForRequest(req)
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error })
      return
    }
    const ctx = ctxFromDept(resolved.dept)
    res.json({
      fecha: lastSyncByDept[ctx.departamento_id] ?? null,
      archivo: ctx.archivoRelativo,
      contexto: ctx,
    })
  } catch (e) { next(e) }
})

gastosRouter.post('/sync', async (req, res, next) => {
  try {
    const resolved = await resolveDepartamentoForRequest(req)
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error })
      return
    }
    const ctx = ctxFromDept(resolved.dept)
    const { wb, archivoExiste, readError } = readWb(ctx.archivoRelativo)
    lastSyncByDept[ctx.departamento_id] = new Date().toISOString()
    res.json({
      ok: true,
      syncAt: lastSyncByDept[ctx.departamento_id],
      contexto: ctx,
      opex: { ...loadOpex(wb, ctx.archivoRelativo, archivoExiste, readError), contexto: ctx },
      financiero: { ...loadFinanciero(wb, ctx.archivoRelativo, archivoExiste, readError), contexto: ctx },
    })
  } catch (e) { next(e) }
})

/** POST /api/gastos/analizar-opex-ia — análisis ejecutivo OPEX con Claude. */
gastosRouter.post('/analizar-opex-ia', async (req, res, next) => {
  try {
    const resolved = await resolveDepartamentoForRequest(req)
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error })
      return
    }
    const ctx = ctxFromDept(resolved.dept)
    const { wb, archivoExiste, readError } = readWb(ctx.archivoRelativo)
    const opex = loadOpex(wb, ctx.archivoRelativo, archivoExiste, readError)

    if (!opex.archivoExiste || !opex.categorias.length) {
      res.status(400).json({
        error:
          'No hay datos OPEX disponibles para analizar. Verifica que el archivo gastos.xlsx esté en su lugar.',
      })
      return
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor.' })
      return
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })

    const resumenCategorias = [...opex.categorias]
      .sort((a, b) => b.total - a.total)
      .map(
        (c) =>
          `- ${c.nombre}: Lps ${c.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })} (meta -20%: Lps ${c.meta20.toLocaleString('es-HN', { minimumFractionDigits: 2 })})`,
      )
      .join('\n')

    const prompt = `Eres un consultor de eficiencia IT para RCJ Corporación, grupo empresarial en Honduras.
El área de IT tiene como meta reducir su OPEX (gastos operativos) entre un 15% y 25% durante 2026.

Estos son los gastos OPEX actuales por categoría (en Lempiras hondureños):
${resumenCategorias}

Total OPEX anual: Lps ${opex.totalAnual.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
Meta de ahorro (-20%): Lps ${opex.ahorroProyectado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}

Proporciona un análisis ejecutivo en español con:
1. Las 3 categorías con mayor potencial de ahorro (justifica brevemente por qué)
2. Una acción concreta y realista para cada una de esas 3 categorías
3. Una estimación de ahorro alcanzable en lempiras para cada acción
4. Una recomendación de priorización (qué hacer primero)

Sé directo y orientado a la acción. No uses listas muy largas. Máximo 250 palabras.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    })

    const texto = message.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    res.json({ ok: true, analisis: texto, generadoEn: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})

import mongoose from 'mongoose'
import xlsx from 'xlsx'

import { Departamento } from '../db/models/Departamento.js'
import { Empresa } from '../db/models/Empresa.js'
import { KPI } from '../db/models/KPI.js'
import { Proyecto, PROYECTO_ESTADOS } from '../db/models/Proyecto.js'
import { Usuario } from '../db/models/Usuario.js'

export const PROYECTO_EXCEL_COLS = [
  'ID',
  'Nombre',
  'Descripcion',
  'Eje',
  'Fase',
  'Tipo',
  'Departamento codigo',
  'Empresas codigos',
  'Usuario email',
  'Responsable',
  'Inicio',
  'Fin',
  'Prioridad',
  'Estado',
  'KPI nombre',
  'Meta KPI',
  '% avance',
  'Notas',
] as const

function normHeader(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getCell(row: Record<string, unknown>, aliases: string[]): unknown {
  const wanted = aliases.map(normHeader)
  for (const [key, value] of Object.entries(row)) {
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

export function parseDateExcel(raw: unknown): Date | null {
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

function parseEstado(raw: unknown): string {
  if (raw == null || raw === '') return 'Planificado'
  const n = normHeader(raw)
  for (const e of PROYECTO_ESTADOS) {
    if (normHeader(e) === n) return e
  }
  if (['en progreso', 'progreso', 'activo'].includes(n)) return 'En progreso'
  if (['completado', 'completa', 'finalizado'].includes(n)) return 'Completado'
  if (['bloqueado', 'blocked'].includes(n)) return 'Bloqueado'
  if (['idea'].includes(n)) return 'Idea'
  if (['aprobado'].includes(n)) return 'Aprobado'
  if (['cancelado'].includes(n)) return 'Cancelado'
  return 'Planificado'
}

function parseTipo(raw: unknown): 'individual' | 'departamental' {
  const n = normHeader(raw)
  if (['departamental', 'depto', 'departamento'].includes(n)) return 'departamental'
  return 'individual'
}

function parseFase(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined
  const n = Number(String(raw).trim())
  if ([1, 2, 3].includes(n)) return n
  return undefined
}

type ResolverCache = {
  deptByCodigo: Map<string, mongoose.Types.ObjectId>
  empByCodigo: Map<string, mongoose.Types.ObjectId>
  userByEmail: Map<string, mongoose.Types.ObjectId>
  kpiByDeptNombre: Map<string, mongoose.Types.ObjectId>
}

export async function buildResolverCache(): Promise<ResolverCache> {
  const [depts, emps, users, kpis] = await Promise.all([
    Departamento.find().select('_id codigo nombre').lean(),
    Empresa.find().select('_id codigo').lean(),
    Usuario.find({ activo: true }).select('_id email nombre').lean(),
    KPI.find().select('_id nombre departamento_id').lean(),
  ])
  const deptByCodigo = new Map<string, mongoose.Types.ObjectId>()
  for (const d of depts) {
    if (d.codigo) deptByCodigo.set(normHeader(d.codigo), d._id as mongoose.Types.ObjectId)
    if (d.nombre) deptByCodigo.set(normHeader(d.nombre), d._id as mongoose.Types.ObjectId)
  }
  const empByCodigo = new Map<string, mongoose.Types.ObjectId>()
  for (const e of emps) {
    if (e.codigo) empByCodigo.set(normHeader(e.codigo), e._id as mongoose.Types.ObjectId)
  }
  const userByEmail = new Map<string, mongoose.Types.ObjectId>()
  for (const u of users) {
    if (u.email) userByEmail.set(normHeader(u.email), u._id as mongoose.Types.ObjectId)
  }
  const kpiByDeptNombre = new Map<string, mongoose.Types.ObjectId>()
  for (const k of kpis) {
    const key = `${String(k.departamento_id)}::${normHeader(k.nombre)}`
    kpiByDeptNombre.set(key, k._id as mongoose.Types.ObjectId)
  }
  return { deptByCodigo, empByCodigo, userByEmail, kpiByDeptNombre }
}

export type ProyectoRowPayload = {
  _id: string
  nombre: string
  descripcion?: string
  eje?: string
  fase?: number
  tipo: 'individual' | 'departamental'
  departamento_id?: mongoose.Types.ObjectId | null
  empresa_ids: mongoose.Types.ObjectId[]
  usuario_id?: mongoose.Types.ObjectId | null
  responsable?: string
  fecha_inicio?: Date | null
  fecha_fin?: Date | null
  prioridad?: string
  estado: string
  kpi_id?: mongoose.Types.ObjectId | null
  meta_kpi?: string
  porcentaje_avance?: number
  notas?: string
}

export function rowToProyecto(
  row: Record<string, unknown>,
  cache: ResolverCache,
): { id: string; payload: ProyectoRowPayload } | { error: string } {
  const id = text(row, ['id', '_id', 'codigo', 'codigo proyecto', 'proyecto id'])
  const nombre = text(row, ['nombre', 'proyecto', 'titulo'])
  if (!nombre) return { error: 'Sin nombre' }
  if (!id) return { error: 'Sin ID de proyecto' }

  const deptCod = text(row, [
    'departamento codigo',
    'depto codigo',
    'departamento',
    'codigo departamento',
  ])
  let departamento_id: mongoose.Types.ObjectId | null = null
  if (deptCod) {
    departamento_id = cache.deptByCodigo.get(normHeader(deptCod)) ?? null
    if (!departamento_id) return { error: `Departamento no encontrado: ${deptCod}` }
  }

  const empRaw = text(row, ['empresas codigos', 'empresas', 'empresa codigos'])
  const empresa_ids: mongoose.Types.ObjectId[] = []
  if (empRaw) {
    for (const part of empRaw.split(/[,;|]/)) {
      const c = part.trim()
      if (!c) continue
      const oid = cache.empByCodigo.get(normHeader(c))
      if (oid) empresa_ids.push(oid)
    }
  }

  const email = text(row, ['usuario email', 'email', 'propietario email'])
  let usuario_id: mongoose.Types.ObjectId | null = null
  if (email) {
    usuario_id = cache.userByEmail.get(normHeader(email)) ?? null
  }

  const kpiNombre = text(row, ['kpi nombre', 'kpi', 'nombre kpi'])
  let kpi_id: mongoose.Types.ObjectId | null = null
  if (kpiNombre && departamento_id) {
    kpi_id =
      cache.kpiByDeptNombre.get(`${String(departamento_id)}::${normHeader(kpiNombre)}`) ?? null
  }

  const prioridadRaw = text(row, ['prioridad'])
  const prioridad = ['Alta', 'Media', 'Baja'].find((p) => normHeader(p) === normHeader(prioridadRaw)) ?? 'Media'

  return {
    id,
    payload: {
      _id: id,
      nombre,
      descripcion: text(row, ['descripcion', 'descripción']) || undefined,
      eje: text(row, ['eje', 'categoria']) || undefined,
      fase: parseFase(getCell(row, ['fase'])),
      tipo: parseTipo(getCell(row, ['tipo', 'tipo proyecto'])),
      departamento_id,
      empresa_ids,
      usuario_id,
      responsable: text(row, ['responsable', 'owner']) || undefined,
      fecha_inicio: parseDateExcel(getCell(row, ['inicio', 'fecha inicio', 'fecha_inicio', 'start'])),
      fecha_fin: parseDateExcel(getCell(row, ['fin', 'fecha fin', 'fecha_fin', 'vencimiento'])),
      prioridad,
      estado: parseEstado(getCell(row, ['estado', 'estatus'])),
      kpi_id,
      meta_kpi: text(row, ['meta kpi', 'meta_kpi', 'meta']) || undefined,
      porcentaje_avance: pct(getCell(row, ['% avance', 'avance', 'porcentaje', 'progreso'])),
      notas: text(row, ['notas', 'observaciones']) || undefined,
    },
  }
}

export async function buildPlantillaProyectosRows(
  filter?: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const rows = await Proyecto.find(filter ?? {})
    .populate('departamento_id', 'codigo')
    .populate('empresa_ids', 'codigo')
    .populate('usuario_id', 'email')
    .populate('kpi_id', 'nombre')
    .sort({ _id: 1 })
    .lean()

  return rows.map((p) => {
    const dept = p.departamento_id as { codigo?: string } | null
    const emps = (p.empresa_ids ?? []) as Array<{ codigo?: string }>
    const user = p.usuario_id as { email?: string } | null
    const kpi = p.kpi_id as { nombre?: string } | null
    return {
      ID: p._id,
      Nombre: p.nombre,
      Descripcion: p.descripcion ?? '',
      Eje: p.eje ?? '',
      Fase: p.fase ?? '',
      Tipo: p.tipo ?? 'individual',
      'Departamento codigo': dept?.codigo ?? '',
      'Empresas codigos': emps.map((e) => e.codigo).filter(Boolean).join(', '),
      'Usuario email': user?.email ?? '',
      Responsable: p.responsable ?? '',
      Inicio: p.fecha_inicio ? new Date(p.fecha_inicio).toISOString().slice(0, 10) : '',
      Fin: p.fecha_fin ? new Date(p.fecha_fin).toISOString().slice(0, 10) : '',
      Prioridad: p.prioridad ?? 'Media',
      Estado: p.estado ?? 'Planificado',
      'KPI nombre': kpi?.nombre ?? '',
      'Meta KPI': p.meta_kpi ?? '',
      '% avance': p.porcentaje_avance ?? 0,
      Notas: p.notas ?? '',
    }
  })
}

import fs from 'node:fs/promises'
import path from 'node:path'

import mongoose from 'mongoose'

import { Colaborador } from '../db/models/Colaborador.js'
import { Departamento } from '../db/models/Departamento.js'
import { Empleado } from '../db/models/Empleado.js'
import { KPI } from '../db/models/KPI.js'
import { PerfilPuesto } from '../db/models/PerfilPuesto.js'
import { PlanCarrera } from '../db/models/PlanCarrera.js'
import { PlantillaCarrera } from '../db/models/PlantillaCarrera.js'

export type KpiEvaluacionExportRow = {
  kpi_nombre: string
  kpi_eje?: string
  peso: number
  descripcion?: string
}

export type PerfilPuestoExportRow = {
  codigo: string
  titulo: string
  departamento_codigo?: string | null
  nivel?: string
  reporta_a?: string
  objetivo?: string
  requisitos?: string[]
  responsabilidades?: string[]
  autoridad?: string[]
  educacion?: string
  experiencia?: string
  competencias?: string[]
  tiene_personal_a_cargo?: boolean
  rubrica_criterios?: {
    categoria: string
    criterio: string
    descripcion?: string
  }[]
  kpis_evaluacion?: KpiEvaluacionExportRow[]
  notas?: string
}

export type PlantillaCarreraExportRow = {
  nombre: string
  descripcion?: string
  departamento_codigo?: string | null
  tipo_ruta: string
  activo?: boolean
  items: {
    codigo?: string
    seccion?: string
    requisito: string
    tipo_requisito?: 'Indispensable' | 'Recomendado'
    plazo_estimado?: string
    recurso?: string
  }[]
}

export type PlanCarreraExportRow = {
  colaborador_codigo: string
  plantilla_tipo_ruta?: string | null
  plantilla_departamento_codigo?: string | null
  tipo: string
  fecha_inicio?: string | null
  periodo_estimado?: string
  responsable_seguimiento?: string
  items: {
    codigo?: string
    seccion?: string
    requisito: string
    tipo_requisito?: 'Indispensable' | 'Recomendado'
    plazo_estimado?: string
    recurso?: string
    estado?: 'Pendiente' | 'En progreso' | 'Completado'
    notas?: string
  }[]
}

export type ColaboradorPerfilLinkExportRow = {
  colaborador_codigo: string
  perfil_puesto_codigo: string
}

export type TalentoExportFile = {
  exportedAt: string
  source: string
  perfiles_puesto: PerfilPuestoExportRow[]
  plantillas_carrera: PlantillaCarreraExportRow[]
  planes_carrera: PlanCarreraExportRow[]
  colaboradores_perfil: ColaboradorPerfilLinkExportRow[]
}

export type TalentoImportResult = {
  perfiles: { insertados: number; actualizados: number; omitidos: number }
  plantillas: { insertados: number; actualizados: number; omitidos: number }
  planes: { insertados: number; actualizados: number; omitidos: number }
  colaboradores_perfil: { actualizados: number; omitidos: number }
  advertencias: string[]
}

async function deptCodigoById(): Promise<Map<string, string>> {
  const rows = await Departamento.find({}).select('_id codigo').lean()
  return new Map(rows.map((d) => [String(d._id), d.codigo]))
}

async function deptIdByCodigo(): Promise<Map<string, mongoose.Types.ObjectId>> {
  const rows = await Departamento.find({}).select('_id codigo').lean()
  return new Map(rows.map((d) => [d.codigo, d._id as mongoose.Types.ObjectId]))
}

async function resolveDeptCodigo(
  departamento_id: unknown,
  deptMap: Map<string, string>,
): Promise<string | null> {
  if (!departamento_id) return null
  if (typeof departamento_id === 'string') return deptMap.get(departamento_id) ?? null
  if (typeof departamento_id === 'object' && departamento_id !== null && '_id' in departamento_id) {
    return deptMap.get(String((departamento_id as { _id: unknown })._id)) ?? null
  }
  return null
}

function plantillaKey(tipo_ruta: string, departamento_codigo: string | null | undefined): string {
  return `${tipo_ruta}::${departamento_codigo ?? ''}`
}

export function defaultTalentoExportPath(): string {
  return path.resolve(process.cwd(), 'data', 'talento-export.json')
}

/** Ruta Docker `/app/data/...` → `data/...` al correr en Windows/Mac fuera del contenedor. */
export function resolveTalentoFilePath(filePath: string): string {
  if (filePath.startsWith('/app/')) {
    const local = path.resolve(process.cwd(), filePath.replace(/^\/app\//, ''))
    return local
  }
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
}

async function resolveDepartamentoId(
  deptCodigo: string | null | undefined,
  deptIdMap: Map<string, mongoose.Types.ObjectId>,
): Promise<mongoose.Types.ObjectId | null> {
  const codigo = deptCodigo?.trim() || null
  if (!codigo) return null
  if (deptIdMap.has(codigo)) return deptIdMap.get(codigo) ?? null
  if (codigo === 'DEP-8') {
    const it = await Departamento.findOne({
      $or: [{ codigo: 'IT' }, { ehr_departamento_id: 8 }],
    })
      .select('_id codigo')
      .lean()
    if (it) return it._id as mongoose.Types.ObjectId
  }
  return null
}

/** Busca colaborador por código; si no existe, enlaza o crea desde Empleado (EHR). */
async function resolveOrCreateColaborador(
  codigo: string,
  advertencias: string[],
): Promise<mongoose.Types.ObjectId | null> {
  const key = codigo.trim()
  if (!key) return null

  const direct = await Colaborador.findOne({ codigo: key }).select('_id').lean()
  if (direct) return direct._id as mongoose.Types.ObjectId

  const empleado = await Empleado.findOne({ codigo: key })
    .populate('departamento_id', 'codigo nombre')
    .lean()
  if (!empleado) {
    advertencias.push(`Sin colaborador ni empleado con código «${key}» (plan/perfil omitido)`)
    return null
  }

  const byEmpleado = await Colaborador.findOne({ empleado_id: empleado._id }).select('_id').lean()
  if (byEmpleado) return byEmpleado._id as mongoose.Types.ObjectId

  const dept =
    empleado.departamento_id && typeof empleado.departamento_id === 'object'
      ? (empleado.departamento_id as { _id: mongoose.Types.ObjectId; codigo?: string; nombre?: string })
      : null
  let deptId = dept?._id ?? null
  if (!deptId && empleado.departamento_id && typeof empleado.departamento_id === 'string') {
    deptId = new mongoose.Types.ObjectId(empleado.departamento_id)
  }
  if (!deptId) {
    let general = await Departamento.findOne({ codigo: 'GEN' }).select('_id').lean()
    if (!general) {
      general = await Departamento.create({ codigo: 'GEN', nombre: 'General' })
    }
    deptId = general._id as mongoose.Types.ObjectId
  }

  let colabCodigo = key
  let n = 1
  while (await Colaborador.exists({ codigo: colabCodigo })) {
    n += 1
    colabCodigo = `${key}-${n}`
  }

  const creado = await Colaborador.create({
    codigo: colabCodigo,
    nombre: empleado.nombre,
    puesto: empleado.puesto || 'Sin puesto definido',
    codigo_puesto: colabCodigo,
    departamento_id: deptId,
    empleado_id: empleado._id,
    frente: dept?.nombre || empleado.departamento || 'General',
    estado: 'Activo',
  })
  advertencias.push(`Colaborador auto-creado para empleado ${key} → ${colabCodigo}`)
  return creado._id as mongoose.Types.ObjectId
}

export async function exportTalentoToFile(outPath: string): Promise<TalentoExportFile> {
  const deptMap = await deptCodigoById()

  const perfilesRaw = await PerfilPuesto.find({}).sort({ codigo: 1 }).lean()
  const kpiIds = new Set<string>()
  for (const p of perfilesRaw) {
    for (const k of p.kpis_evaluacion ?? []) {
      if (k.kpi_id) kpiIds.add(String(k.kpi_id))
    }
  }
  const kpis = kpiIds.size
    ? await KPI.find({ _id: { $in: [...kpiIds] } }).select('nombre eje').lean()
    : []
  const kpiById = new Map(kpis.map((k) => [String(k._id), k]))

  const perfiles_puesto: PerfilPuestoExportRow[] = []
  for (const p of perfilesRaw) {
    perfiles_puesto.push({
      codigo: p.codigo,
      titulo: p.titulo,
      departamento_codigo: await resolveDeptCodigo(p.departamento_id, deptMap),
      nivel: p.nivel ?? '',
      reporta_a: p.reporta_a ?? '',
      objetivo: p.objetivo ?? '',
      requisitos: p.requisitos ?? [],
      responsabilidades: p.responsabilidades ?? [],
      autoridad: p.autoridad ?? [],
      educacion: p.educacion ?? '',
      experiencia: p.experiencia ?? '',
      competencias: p.competencias ?? [],
      tiene_personal_a_cargo: Boolean(p.tiene_personal_a_cargo),
      rubrica_criterios: (p.rubrica_criterios ?? []).map((r) => ({
        categoria: r.categoria,
        criterio: r.criterio,
        descripcion: r.descripcion ?? '',
      })),
      kpis_evaluacion: (p.kpis_evaluacion ?? []).map((k) => {
        const ref = kpiById.get(String(k.kpi_id))
        return {
          kpi_nombre: ref?.nombre ?? '',
          kpi_eje: ref?.eje ?? '',
          peso: k.peso,
          descripcion: k.descripcion ?? '',
        }
      }),
      notas: p.notas ?? '',
    })
  }

  const plantillasRaw = await PlantillaCarrera.find({}).sort({ nombre: 1 }).lean()
  const plantillas_carrera: PlantillaCarreraExportRow[] = []
  for (const pl of plantillasRaw) {
    plantillas_carrera.push({
      nombre: pl.nombre,
      descripcion: pl.descripcion ?? '',
      departamento_codigo: await resolveDeptCodigo(pl.departamento_id, deptMap),
      tipo_ruta: pl.tipo_ruta,
      activo: pl.activo !== false,
      items: (pl.items ?? []).map((it) => ({
        codigo: it.codigo ?? '',
        seccion: it.seccion ?? '',
        requisito: it.requisito,
        tipo_requisito: it.tipo_requisito,
        plazo_estimado: it.plazo_estimado ?? '',
        recurso: it.recurso ?? '',
      })),
    })
  }

  const plantillaById = new Map(
    plantillasRaw.map((pl) => [
      String(pl._id),
      {
        tipo_ruta: pl.tipo_ruta,
        departamento_codigo: null as string | null,
      },
    ]),
  )
  for (const [id, meta] of plantillaById) {
    const pl = plantillasRaw.find((x) => String(x._id) === id)
    meta.departamento_codigo = pl
      ? await resolveDeptCodigo(pl.departamento_id, deptMap)
      : null
  }

  const colabRaw = await Colaborador.find({}).select('codigo perfil_puesto_id').lean()
  const perfilIds = colabRaw
    .map((c) => c.perfil_puesto_id)
    .filter(Boolean)
    .map((id) => String(id))
  const perfilesLink = perfilIds.length
    ? await PerfilPuesto.find({ _id: { $in: perfilIds } }).select('_id codigo').lean()
    : []
  const perfilCodigoById = new Map(perfilesLink.map((p) => [String(p._id), p.codigo]))

  const colaboradores_perfil: ColaboradorPerfilLinkExportRow[] = []
  for (const c of colabRaw) {
    if (!c.perfil_puesto_id) continue
    const perfilCodigo = perfilCodigoById.get(String(c.perfil_puesto_id))
    if (!perfilCodigo) continue
    colaboradores_perfil.push({
      colaborador_codigo: c.codigo,
      perfil_puesto_codigo: perfilCodigo,
    })
  }

  const planesRaw = await PlanCarrera.find({}).lean()
  const colabIds = [...new Set(planesRaw.map((p) => String(p.colaborador_id)))]
  const colabs = colabIds.length
    ? await Colaborador.find({ _id: { $in: colabIds } }).select('_id codigo').lean()
    : []
  const colabCodigoById = new Map(colabs.map((c) => [String(c._id), c.codigo]))

  const planes_carrera: PlanCarreraExportRow[] = []
  for (const plan of planesRaw) {
    const colaborador_codigo = colabCodigoById.get(String(plan.colaborador_id))
    if (!colaborador_codigo) continue
    const plMeta = plan.plantilla_id ? plantillaById.get(String(plan.plantilla_id)) : null
    planes_carrera.push({
      colaborador_codigo,
      plantilla_tipo_ruta: plMeta?.tipo_ruta ?? null,
      plantilla_departamento_codigo: plMeta?.departamento_codigo ?? null,
      tipo: plan.tipo,
      fecha_inicio: plan.fecha_inicio ? plan.fecha_inicio.toISOString() : null,
      periodo_estimado: plan.periodo_estimado ?? '',
      responsable_seguimiento: plan.responsable_seguimiento ?? '',
      items: (plan.items ?? []).map((it) => ({
        codigo: it.codigo ?? '',
        seccion: it.seccion ?? '',
        requisito: it.requisito,
        tipo_requisito: it.tipo_requisito,
        plazo_estimado: it.plazo_estimado ?? '',
        recurso: it.recurso ?? '',
        estado: it.estado ?? 'Pendiente',
        notas: it.notas ?? '',
      })),
    })
  }

  const payload: TalentoExportFile = {
    exportedAt: new Date().toISOString(),
    source: 'rcj-it-manager',
    perfiles_puesto,
    plantillas_carrera,
    planes_carrera,
    colaboradores_perfil,
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}

async function resolveKpiId(
  row: KpiEvaluacionExportRow,
  advertencias: string[],
): Promise<mongoose.Types.ObjectId | null> {
  const nombre = row.kpi_nombre.trim()
  if (!nombre) return null
  const filter: Record<string, unknown> = { nombre }
  if (row.kpi_eje?.trim()) filter.eje = row.kpi_eje.trim()
  const hit = await KPI.findOne(filter).select('_id').lean()
  if (!hit) {
    advertencias.push(`KPI no encontrado en destino: «${nombre}»${row.kpi_eje ? ` (${row.kpi_eje})` : ''}`)
    return null
  }
  return hit._id as mongoose.Types.ObjectId
}

export async function importTalentoFromFile(filePath: string): Promise<TalentoImportResult> {
  const resolvedPath = resolveTalentoFilePath(filePath)
  const raw = await fs.readFile(resolvedPath, 'utf8')
  const parsed = JSON.parse(raw) as TalentoExportFile
  const advertencias: string[] = []

  const deptIdMap = await deptIdByCodigo()
  const result: TalentoImportResult = {
    perfiles: { insertados: 0, actualizados: 0, omitidos: 0 },
    plantillas: { insertados: 0, actualizados: 0, omitidos: 0 },
    planes: { insertados: 0, actualizados: 0, omitidos: 0 },
    colaboradores_perfil: { actualizados: 0, omitidos: 0 },
    advertencias,
  }

  for (const row of parsed.perfiles_puesto ?? []) {
    const codigo = String(row.codigo ?? '').trim()
    const titulo = String(row.titulo ?? '').trim()
    if (!codigo || !titulo) {
      result.perfiles.omitidos++
      continue
    }

    const deptCodigo = row.departamento_codigo?.trim() || null
    const departamento_id = await resolveDepartamentoId(deptCodigo, deptIdMap)
    if (deptCodigo && !departamento_id) {
      advertencias.push(`Departamento no encontrado para perfil ${codigo}: ${deptCodigo}`)
    }

    const kpis_evaluacion: { kpi_id: mongoose.Types.ObjectId; peso: number; descripcion: string }[] =
      []
    for (const k of row.kpis_evaluacion ?? []) {
      const kpi_id = await resolveKpiId(k, advertencias)
      if (!kpi_id) continue
      kpis_evaluacion.push({
        kpi_id,
        peso: k.peso,
        descripcion: k.descripcion ?? '',
      })
    }

    const $set = {
      codigo,
      titulo,
      departamento_id,
      nivel: row.nivel ?? '',
      reporta_a: row.reporta_a ?? '',
      objetivo: row.objetivo ?? '',
      requisitos: row.requisitos ?? [],
      responsabilidades: row.responsabilidades ?? [],
      autoridad: row.autoridad ?? [],
      educacion: row.educacion ?? '',
      experiencia: row.experiencia ?? '',
      competencias: row.competencias ?? [],
      tiene_personal_a_cargo: Boolean(row.tiene_personal_a_cargo),
      rubrica_criterios: row.rubrica_criterios ?? [],
      kpis_evaluacion,
      notas: row.notas ?? '',
    }

    const prev = await PerfilPuesto.findOne({ codigo }).select('_id').lean()
    await PerfilPuesto.findOneAndUpdate({ codigo }, { $set }, { upsert: true })
    if (prev) result.perfiles.actualizados++
    else result.perfiles.insertados++
  }

  const plantillaIdByKey = new Map<string, mongoose.Types.ObjectId>()

  for (const row of parsed.plantillas_carrera ?? []) {
    const nombre = String(row.nombre ?? '').trim()
    const tipo_ruta = String(row.tipo_ruta ?? '').trim()
    if (!nombre || !tipo_ruta) {
      result.plantillas.omitidos++
      continue
    }

    const deptCodigo = row.departamento_codigo?.trim() || null
    const departamento_id = await resolveDepartamentoId(deptCodigo, deptIdMap)
    if (deptCodigo && !departamento_id) {
      advertencias.push(`Departamento no encontrado para plantilla ${nombre}: ${deptCodigo}`)
    }

    const filter: Record<string, unknown> = { tipo_ruta }
    if (departamento_id) filter.departamento_id = departamento_id
    else filter.nombre = nombre

    const $set = {
      nombre,
      descripcion: row.descripcion ?? '',
      departamento_id: departamento_id ?? null,
      tipo_ruta,
      activo: row.activo !== false,
      items: row.items ?? [],
    }

    const prev = await PlantillaCarrera.findOne(filter).select('_id').lean()
    const doc = await PlantillaCarrera.findOneAndUpdate(
      filter,
      { $set },
      { upsert: true, new: true },
    )
    plantillaIdByKey.set(plantillaKey(tipo_ruta, deptCodigo), doc._id as mongoose.Types.ObjectId)
    if (prev) result.plantillas.actualizados++
    else result.plantillas.insertados++
  }

  for (const row of parsed.planes_carrera ?? []) {
    const colaborador_codigo = String(row.colaborador_codigo ?? '').trim()
    const tipo = String(row.tipo ?? '').trim()
    if (!colaborador_codigo || !tipo) {
      result.planes.omitidos++
      continue
    }

    const colabId = await resolveOrCreateColaborador(colaborador_codigo, advertencias)
    if (!colabId) {
      result.planes.omitidos++
      continue
    }

    const plKey = plantillaKey(
      row.plantilla_tipo_ruta?.trim() ?? '',
      row.plantilla_departamento_codigo?.trim() || null,
    )
    const plantilla_id = plantillaIdByKey.get(plKey) ?? null
    if (row.plantilla_tipo_ruta && !plantilla_id) {
      advertencias.push(
        `Plantilla no resuelta para plan de ${colaborador_codigo}: ${plKey}`,
      )
    }

    const $set = {
      colaborador_id: colabId,
      plantilla_id,
      tipo,
      fecha_inicio: row.fecha_inicio ? new Date(row.fecha_inicio) : null,
      periodo_estimado: row.periodo_estimado ?? '',
      responsable_seguimiento: row.responsable_seguimiento ?? '',
      items: row.items ?? [],
    }

    const prev = await PlanCarrera.findOne({ colaborador_id: colabId }).select('_id').lean()
    await PlanCarrera.findOneAndUpdate({ colaborador_id: colabId }, { $set }, { upsert: true })
    if (prev) result.planes.actualizados++
    else result.planes.insertados++
  }

  for (const row of parsed.colaboradores_perfil ?? []) {
    const colaborador_codigo = String(row.colaborador_codigo ?? '').trim()
    const perfil_puesto_codigo = String(row.perfil_puesto_codigo ?? '').trim()
    if (!colaborador_codigo || !perfil_puesto_codigo) {
      result.colaboradores_perfil.omitidos++
      continue
    }

    const [colabId, perfil] = await Promise.all([
      resolveOrCreateColaborador(colaborador_codigo, advertencias),
      PerfilPuesto.findOne({ codigo: perfil_puesto_codigo }).select('_id').lean(),
    ])
    if (!colabId || !perfil) {
      if (!perfil) {
        advertencias.push(`Perfil no encontrado para vínculo: ${perfil_puesto_codigo}`)
      }
      result.colaboradores_perfil.omitidos++
      continue
    }

    await Colaborador.updateOne(
      { _id: colabId },
      { $set: { perfil_puesto_id: perfil._id, codigo_puesto: perfil_puesto_codigo } },
    )
    result.colaboradores_perfil.actualizados++
  }

  return result
}

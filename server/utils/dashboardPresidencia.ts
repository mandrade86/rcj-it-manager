import { Departamento } from '../db/models/Departamento.js'
import { Empresa } from '../db/models/Empresa.js'
import { KPI } from '../db/models/KPI.js'
import { Proyecto } from '../db/models/Proyecto.js'
import { Usuario } from '../db/models/Usuario.js'
import { pctCumplimientoKpi, ultimoRegistro, type ProyectoAvanceLean } from './kpiPct.js'
import { buildProyectoScopeFilter } from './proyectoScope.js'

export type PresidenciaKpi = {
  nombre: string
  meta: string | null
  unidad: string | null
  cumplimiento_pct: number
  ultimo_valor: number | null
}

export type PresidenciaProyecto = {
  _id: string
  nombre: string
  estado: string
  prioridad: string
  porcentaje_avance: number
  encargado: string | null
  meta_kpi: string | null
  kpi: PresidenciaKpi | null
  comentario: string
  eje: string
  fecha_fin: string | null
  departamento_id: string | null
  empresa_ids: string[]
}

export type PresidenciaDepartamento = {
  _id: string
  nombre: string
  codigo: string
  empresa_id: string | null
  activo: boolean
}

export type PresidenciaEmpresa = {
  _id: string
  nombre: string
  codigo: string
  color: string
  activo: boolean
}

function idsUnicos(valores: Array<unknown>): string[] {
  const seen = new Set<string>()
  for (const v of valores) {
    if (v == null) continue
    const s = String(v)
    if (s) seen.add(s)
  }
  return [...seen]
}

function nombreEncargado(usuario: unknown, responsable?: string | null): string | null {
  if (usuario && typeof usuario === 'object' && 'nombre' in usuario) {
    const nombre = String((usuario as { nombre?: unknown }).nombre ?? '').trim()
    if (nombre) return nombre
  }
  const libre = responsable?.trim()
  return libre || null
}

function isoONull(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return null
}

export async function queryDashboardPresidencia(userId: string, permisos: string[]) {
  const scope = await buildProyectoScopeFilter(userId, permisos)
  const proyectos = await Proyecto.find(scope)
    .select('nombre estado prioridad porcentaje_avance responsable meta_kpi fecha_fin departamento_id empresa_ids usuario_id kpi_id eje comentario_presidencia')
    .populate({ path: 'usuario_id', select: 'nombre', model: Usuario })
    .sort({ nombre: 1 })
    .lean()

  const kpiIds = idsUnicos(proyectos.map((p) => p.kpi_id))
  const kpis = kpiIds.length
    ? await KPI.find({ _id: { $in: kpiIds } })
      .select('nombre meta unidad tipo_calculo registros proyecto_ids')
      .lean()
    : []
  const extrasPorKpi = new Map<string, ProyectoAvanceLean[]>()
  for (const p of proyectos) {
    if (!p.kpi_id) continue
    const id = String(p.kpi_id)
    const lista = extrasPorKpi.get(id) ?? []
    lista.push({ porcentaje_avance: p.porcentaje_avance, estado: p.estado })
    extrasPorKpi.set(id, lista)
  }
  const kpiPorId = new Map(kpis.map((k) => {
    const id = String(k._id)
    const ultimo = ultimoRegistro(k)
    return [id, {
      nombre: k.nombre,
      meta: k.meta ?? null,
      unidad: k.unidad ?? null,
      cumplimiento_pct: pctCumplimientoKpi(k, extrasPorKpi.get(id) ?? []),
      ultimo_valor: ultimo?.valor == null || Number.isNaN(Number(ultimo.valor)) ? null : Number(ultimo.valor),
    } satisfies PresidenciaKpi]
  }))

  const deptIds = idsUnicos(proyectos.map((p) => p.departamento_id))
  const empresaMarcadas = idsUnicos(proyectos.flatMap((p) => p.empresa_ids ?? []))

  const [empresasActivas, departamentos] = await Promise.all([
    Empresa.find({
      $or: [{ activo: true }, ...(empresaMarcadas.length ? [{ _id: { $in: empresaMarcadas } }] : [])],
    })
      .select('nombre codigo color activo')
      .sort({ nombre: 1 })
      .lean(),
    Departamento.find({
      $or: [{ activo: true }, ...(deptIds.length ? [{ _id: { $in: deptIds } }] : [])],
    })
      .select('nombre codigo empresa_id activo')
      .sort({ nombre: 1 })
      .lean(),
  ])

  const empresas = [...empresasActivas]
  const empresaIds = new Set(empresas.map((e) => String(e._id)))
  const empresasFaltantes = idsUnicos(
    departamentos.map((d) => d.empresa_id).filter((id) => id && !empresaIds.has(String(id))),
  )
  if (empresasFaltantes.length) {
    const extra = await Empresa.find({ _id: { $in: empresasFaltantes } })
      .select('nombre codigo color activo')
      .lean()
    empresas.push(...extra)
    empresas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }

  const deptEmpresa = new Map(
    departamentos.map((d) => [String(d._id), d.empresa_id ? String(d.empresa_id) : null]),
  )

  return {
    empresas: empresas.map((e) => ({
      _id: String(e._id),
      nombre: e.nombre,
      codigo: e.codigo,
      color: e.color || '#002060',
      activo: e.activo !== false,
    })) satisfies PresidenciaEmpresa[],
    departamentos: departamentos.map((d) => ({
      _id: String(d._id),
      nombre: d.nombre,
      codigo: d.codigo,
      empresa_id: d.empresa_id ? String(d.empresa_id) : null,
      activo: d.activo !== false,
    })) satisfies PresidenciaDepartamento[],
    proyectos: proyectos.map((p) => {
      const departamentoId = p.departamento_id ? String(p.departamento_id) : null
      const marcadas = (p.empresa_ids ?? []).map((id) => String(id))
      const heredada = departamentoId ? deptEmpresa.get(departamentoId) : null
      return {
        _id: String(p._id),
        nombre: p.nombre,
        estado: p.estado,
        prioridad: p.prioridad ?? 'Media',
        porcentaje_avance: p.porcentaje_avance ?? 0,
        encargado: nombreEncargado(p.usuario_id, p.responsable),
        meta_kpi: p.meta_kpi?.trim() || null,
        kpi: p.kpi_id ? kpiPorId.get(String(p.kpi_id)) ?? null : null,
        comentario: p.comentario_presidencia?.trim() || '',
        eje: p.eje?.trim() || '',
        fecha_fin: isoONull(p.fecha_fin),
        departamento_id: departamentoId,
        empresa_ids: marcadas.length ? marcadas : (heredada ? [heredada] : []),
      }
    }) satisfies PresidenciaProyecto[],
  }
}

export async function guardarComentarioPresidencia(
  userId: string,
  permisos: string[],
  proyectoId: string,
  comentario: string,
) {
  const scope = await buildProyectoScopeFilter(userId, permisos)
  const texto = comentario.trim().slice(0, 2000)
  const doc = await Proyecto.findOneAndUpdate(
    { _id: proyectoId, ...scope },
    { $set: { comentario_presidencia: texto } },
    { new: true },
  )
    .select('comentario_presidencia')
    .lean()
  if (!doc) return null
  return { proyecto_id: proyectoId, comentario: doc.comentario_presidencia?.trim() || '' }
}

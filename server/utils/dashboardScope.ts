import mongoose from 'mongoose'

import { Colaborador } from '../db/models/Colaborador.js'
import { Departamento } from '../db/models/Departamento.js'
import { Empleado } from '../db/models/Empleado.js'
import { resolveVisibleEmpleadoIds } from './empleadoScope.js'
import {
  buildProyectoScopeFilter,
  isAdminProyectos,
  resolveDepartamentosUsuario,
} from './proyectoScope.js'

export type DashboardAlcanceTipo = 'global' | 'departamentos' | 'equipo' | 'personal'

export type DashboardAlcance = {
  tipo: DashboardAlcanceTipo
  etiqueta: string
  descripcion: string
  departamentos: { _id: string; codigo: string; nombre: string }[]
}

export type DashboardScopeResolved = {
  alcance: DashboardAlcance
  proyectoFilter: Record<string, unknown>
  departamentoIds: mongoose.Types.ObjectId[]
  /** Colaboradores vinculados a empleados visibles (equipo / depto). */
  colaboradorIds: mongoose.Types.ObjectId[]
}

async function loadDepartamentoLabels(
  ids: mongoose.Types.ObjectId[],
): Promise<{ _id: string; codigo: string; nombre: string }[]> {
  if (!ids.length) return []
  const rows = await Departamento.find({ _id: { $in: ids } })
    .select('codigo nombre')
    .sort({ codigo: 1 })
    .lean()
  return rows.map((d) => ({
    _id: String(d._id),
    codigo: d.codigo ?? '',
    nombre: d.nombre ?? '',
  }))
}

async function colaboradoresEnDepartamentos(
  deptIds: mongoose.Types.ObjectId[],
): Promise<mongoose.Types.ObjectId[]> {
  if (!deptIds.length) return []
  const empleados = await Empleado.find({
    departamento_id: { $in: deptIds },
    activo: { $ne: false },
  })
    .select('_id')
    .lean()
  if (!empleados.length) return []
  const empleadoIds = empleados.map((e) => e._id)
  const colabs = await Colaborador.find({ empleado_id: { $in: empleadoIds } }).select('_id').lean()
  return colabs.map((c) => c._id as mongoose.Types.ObjectId)
}

async function colaboradoresDeEmpleados(
  empleadoIds: string[],
): Promise<mongoose.Types.ObjectId[]> {
  if (!empleadoIds.length) return []
  const colabs = await Colaborador.find({ empleado_id: { $in: empleadoIds } }).select('_id').lean()
  return colabs.map((c) => c._id as mongoose.Types.ObjectId)
}

function buildAlcanceLabels(
  tipo: DashboardAlcanceTipo,
  departamentos: { codigo: string; nombre: string }[],
): Pick<DashboardAlcance, 'etiqueta' | 'descripcion'> {
  const deptCodes = departamentos.map((d) => d.codigo || d.nombre).filter(Boolean)
  const deptList = deptCodes.length ? deptCodes.join(', ') : null

  switch (tipo) {
    case 'global':
      return {
        etiqueta: 'Vista general',
        descripcion:
          'Métricas de todos los proyectos, KPIs y capacitaciones de la organización (perfil con acceso global).',
      }
    case 'departamentos':
      return {
        etiqueta: deptList ? `Departamento${deptCodes.length > 1 ? 's' : ''}: ${deptList}` : 'Mis departamentos',
        descripcion:
          'Proyectos de su departamento asignado, los departamentos de su rol y su equipo; KPIs y capacitaciones filtrados por esos departamentos.',
      }
    case 'equipo':
      return {
        etiqueta: 'Mi equipo',
        descripcion:
          'Proyectos propios y de su equipo directo; KPIs de su departamento; capacitaciones de su equipo.',
      }
    case 'personal':
    default:
      return {
        etiqueta: 'Mi espacio de trabajo',
        descripcion:
          'Solo sus proyectos asignados, sus KPIs de departamento (si aplica) y sus capacitaciones personales.',
      }
  }
}

export async function resolveDashboardScope(
  userId: string,
  permisos: string[],
): Promise<DashboardScopeResolved> {
  const proyectoFilter = await buildProyectoScopeFilter(userId, permisos)
  const departamentoIds = await resolveDepartamentosUsuario(userId)
  const departamentos = await loadDepartamentoLabels(departamentoIds)

  const empleadoScope = await resolveVisibleEmpleadoIds(userId)
  const equipoEmpleadoIds = empleadoScope.visibleIds.filter((id) => id !== empleadoScope.selfEmpleadoId)
  const tieneEquipo = equipoEmpleadoIds.length > 0

  let tipo: DashboardAlcanceTipo
  if (isAdminProyectos(permisos)) {
    tipo = 'global'
  } else if (departamentoIds.length > 0) {
    tipo = 'departamentos'
  } else if (tieneEquipo) {
    tipo = 'equipo'
  } else {
    tipo = 'personal'
  }

  let colaboradorIds: mongoose.Types.ObjectId[] = []
  if (tipo === 'global') {
    colaboradorIds = []
  } else if (tipo === 'departamentos') {
    const porDept = await colaboradoresEnDepartamentos(departamentoIds)
    const porEquipo = await colaboradoresDeEmpleados(empleadoScope.visibleIds)
    colaboradorIds = [...new Set([...porDept, ...porEquipo].map(String))].map(
      (id) => new mongoose.Types.ObjectId(id),
    )
  } else if (tipo === 'equipo') {
    colaboradorIds = await colaboradoresDeEmpleados(empleadoScope.visibleIds)
  } else {
    if (empleadoScope.selfEmpleadoId) {
      const mine = await Colaborador.findOne({ empleado_id: empleadoScope.selfEmpleadoId })
        .select('_id')
        .lean()
      if (mine?._id) colaboradorIds = [mine._id as mongoose.Types.ObjectId]
    }
  }

  const { etiqueta, descripcion } = buildAlcanceLabels(tipo, departamentos)

  return {
    alcance: { tipo, etiqueta, descripcion, departamentos },
    proyectoFilter,
    departamentoIds,
    colaboradorIds,
  }
}

/** Filtro Mongo para KPIs según alcance. */
export function buildKpiFilter(scope: DashboardScopeResolved): Record<string, unknown> {
  if (scope.alcance.tipo === 'global') return {}
  if (scope.departamentoIds.length > 0) {
    return { departamento_id: { $in: scope.departamentoIds } }
  }
  return { departamento_id: { $in: [] } }
}

/** Cuenta capacitaciones en progreso según alcance. */
export async function countCapacitacionesEnProgreso(
  scope: DashboardScopeResolved,
): Promise<number> {
  const { Capacitacion } = await import('../db/models/Capacitacion.js')

  if (scope.alcance.tipo === 'global') {
    return Capacitacion.countDocuments({ estado: 'En progreso' })
  }

  if (scope.alcance.tipo === 'personal') {
    if (!scope.colaboradorIds.length) return 0
    return Capacitacion.countDocuments({
      asignados: {
        $elemMatch: {
          colaborador_id: { $in: scope.colaboradorIds },
          estado: 'En progreso',
        },
      },
    })
  }

  const or: Record<string, unknown>[] = []
  if (scope.departamentoIds.length > 0) {
    or.push({ departamentos_ids: { $in: scope.departamentoIds } })
  }
  if (scope.colaboradorIds.length > 0) {
    or.push({ 'asignados.colaborador_id': { $in: scope.colaboradorIds } })
  }
  if (!or.length) return 0

  return Capacitacion.countDocuments({
    estado: 'En progreso',
    $or: or,
  })
}

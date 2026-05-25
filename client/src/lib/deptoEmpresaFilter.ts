import type { DepartamentoDoc } from '@/types/departamento'
import type { EmpleadoDoc } from '@/types/empleado'

/** Mapa departamento_id → empresa_id (ObjectId string). */
export function buildDeptToEmpresaIdMap(depts: DepartamentoDoc[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const d of depts) {
    const ex = d.empresa_id
    const eid =
      typeof ex === 'string'
        ? ex
        : ex && typeof ex === 'object' && '_id' in ex
          ? String((ex as { _id: string })._id)
          : null
    if (eid) m.set(d._id, eid)
  }
  return m
}

export function empleadoDepartamentoId(e: EmpleadoDoc): string | null {
  const d = e.departamento_id
  if (!d) return null
  if (typeof d === 'string') return d
  return d._id
}

export function empleadoEmpresaId(
  e: EmpleadoDoc,
  deptToEmpresa: Map<string, string>,
): string | null {
  const did = empleadoDepartamentoId(e)
  if (!did) return null
  return deptToEmpresa.get(did) ?? null
}

export function empresaNombrePorId(
  empresaId: string | null,
  empresas: { _id: string; nombre: string }[],
): string {
  if (!empresaId) return '—'
  return empresas.find((x) => x._id === empresaId)?.nombre ?? '—'
}

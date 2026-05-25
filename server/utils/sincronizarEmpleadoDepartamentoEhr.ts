import mongoose from 'mongoose'

import { Departamento } from '../db/models/Departamento.js'
import { Empleado } from '../db/models/Empleado.js'

function parseDeptoNumFromExternos(ext: Record<string, unknown> | null | undefined): number | null {
  if (!ext || typeof ext !== 'object') return null
  const raw =
    ext.deptoId ??
    ext.depto_id ??
    ext.idDepartamento ??
    ext.departmentId ??
    ext.Depto ??
    ext['Depto #']
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (raw == null || raw === '') return null
  const p = Number(String(raw).trim())
  return Number.isFinite(p) ? p : null
}

function parseDeptoNumFromTexto(departamento: string | undefined): number | null {
  if (!departamento || typeof departamento !== 'string') return null
  const m = departamento.match(/^depto\s*#?\s*(\d+)\s*$/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Asigna `departamento_id` y limpia `departamento` al nombre oficial según `ehr_departamento_id` (Depto #).
 * Usa datos del EHR en `datos_externos` y el texto legacy «Depto N».
 */
export async function sincronizarEmpleadosDepartamentoDesdeEhr(): Promise<void> {
  const depts = await Departamento.find({ ehr_departamento_id: { $ne: null } })
    .select('_id nombre ehr_departamento_id')
    .lean()
  const byEhr = new Map<number, { _id: mongoose.Types.ObjectId; nombre: string }>()
  for (const d of depts) {
    if (d.ehr_departamento_id == null) continue
    byEhr.set(d.ehr_departamento_id, {
      _id: d._id as mongoose.Types.ObjectId,
      nombre: d.nombre,
    })
  }
  if (byEhr.size === 0) return

  const cursor = Empleado.find({}).select('_id departamento departamento_id datos_externos').cursor()
  for await (const e of cursor) {
    const ext = e.datos_externos as Record<string, unknown> | undefined
    let n = parseDeptoNumFromExternos(ext)
    if (n == null) n = parseDeptoNumFromTexto(e.departamento)
    if (n == null) continue
    const d = byEhr.get(n)
    if (!d) continue
    if (String(e.departamento_id) === String(d._id) && e.departamento === d.nombre) continue
    await Empleado.updateOne(
      { _id: e._id },
      { $set: { departamento_id: d._id, departamento: d.nombre } },
    )
  }
}

import mongoose from 'mongoose'

import { Tarea } from '../db/models/Tarea.js'

/** Normaliza ids de predecesores (depende_de). */
export function parseDependeDeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(
    raw.map((x) => String(x).trim()).filter((id) => mongoose.isValidObjectId(id)),
  )]
}

type TareaDepLean = { _id: mongoose.Types.ObjectId; depende_de_ids?: mongoose.Types.ObjectId[] }

/** Mapa tarea → ids de tareas de las que depende. */
function buildPredMap(
  rows: TareaDepLean[],
  overrideTaskId: string | null,
  overrideDeps: string[] | null,
): Map<string, string[]> {
  const preds = new Map<string, string[]>()
  for (const t of rows) {
    const id = String(t._id)
    preds.set(id, (t.depende_de_ids ?? []).map(String))
  }
  if (overrideTaskId != null && overrideDeps != null) {
    preds.set(overrideTaskId, overrideDeps)
  }
  return preds
}

function canReach(
  from: string,
  target: string,
  preds: Map<string, string[]>,
  visited: Set<string>,
): boolean {
  if (from === target) return true
  if (visited.has(from)) return false
  visited.add(from)
  for (const p of preds.get(from) ?? []) {
    if (canReach(p, target, preds, visited)) return true
  }
  return false
}

/** True si agregar estas dependencias crearía un ciclo. */
export function detectariaCiclo(
  rows: TareaDepLean[],
  tareaId: string,
  nuevasDeps: string[],
): boolean {
  if (nuevasDeps.includes(tareaId)) return true
  const preds = buildPredMap(rows, tareaId, nuevasDeps)
  for (const d of nuevasDeps) {
    if (canReach(d, tareaId, preds, new Set())) return true
  }
  return false
}

/**
 * Valida dependencias de una tarea dentro del proyecto.
 * @returns ids normalizados o mensaje de error.
 */
export async function validarDependenciasTarea(
  proyectoId: string,
  tareaId: string | null,
  raw: unknown,
): Promise<{ ids: mongoose.Types.ObjectId[]; error?: string }> {
  const depIds = parseDependeDeIds(raw)
  if (depIds.length === 0) return { ids: [] }

  if (tareaId && depIds.includes(tareaId)) {
    return { ids: [], error: 'Una tarea no puede depender de sí misma.' }
  }

  const found = await Tarea.find({
    proyecto_id: proyectoId,
    _id: { $in: depIds },
  }).select('_id depende_de_ids').lean() as TareaDepLean[]

  if (found.length !== depIds.length) {
    return { ids: [], error: 'Alguna tarea predecesora no existe en este proyecto.' }
  }

  if (tareaId) {
    const all = await Tarea.find({ proyecto_id: proyectoId })
      .select('_id depende_de_ids')
      .lean() as TareaDepLean[]
    if (detectariaCiclo(all, tareaId, depIds)) {
      return { ids: [], error: 'Las dependencias formarían un ciclo circular.' }
    }
  }

  return {
    ids: depIds.map((id) => new mongoose.Types.ObjectId(id)),
  }
}

/** Quita referencias a tareas eliminadas dentro del mismo proyecto. */
export async function limpiarDependenciasRotas(
  proyectoId: string,
  eliminadosIds: string[],
): Promise<void> {
  if (eliminadosIds.length === 0) return
  const oids = eliminadosIds.map((id) => new mongoose.Types.ObjectId(id))
  await Tarea.updateMany(
    { proyecto_id: proyectoId, depende_de_ids: { $in: oids } },
    { $pull: { depende_de_ids: { $in: oids } } },
  )
}

import { Proyecto } from '../db/models/Proyecto.js'
import { Tarea } from '../db/models/Tarea.js'

export async function recalcularAvanceProyecto(proyectoId: string) {
  const tareas = await Tarea.find({ proyecto_id: proyectoId })
    .select('porcentaje')
    .lean()
  if (tareas.length === 0) {
    await Proyecto.findByIdAndUpdate(proyectoId, { porcentaje_avance: 0 })
    return
  }
  const sum = tareas.reduce((acc, t) => acc + (t.porcentaje ?? 0), 0)
  const avg = Math.round(sum / tareas.length)
  await Proyecto.findByIdAndUpdate(proyectoId, { porcentaje_avance: avg })
}

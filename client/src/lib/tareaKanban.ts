import type { AuthUser } from '@/store/authStore'
import type { Proyecto } from '@/types/proyecto'
import { proyectoOwnerId } from '@/types/proyecto'
import type { Tarea, TareaEstado } from '@/types/tarea'

export type KanbanColumna = 'todo' | 'in_progress' | 'done'

export const KANBAN_COLUMNAS: {
  id: KanbanColumna
  titulo: string
  subtitulo: string
}[] = [
  { id: 'todo', titulo: 'To Do', subtitulo: 'Pendiente / Bloqueado' },
  { id: 'in_progress', titulo: 'In Progress', subtitulo: 'En progreso' },
  { id: 'done', titulo: 'Done', subtitulo: 'Completado' },
]

export function columnaKanbanDeEstado(estado: TareaEstado): KanbanColumna {
  if (estado === 'Completado') return 'done'
  if (estado === 'En progreso') return 'in_progress'
  return 'todo'
}

export function esDuenoProyecto(proyecto: Proyecto, user: AuthUser | null): boolean {
  if (!user) return false
  const ownerId = proyectoOwnerId(proyecto)
  return Boolean(ownerId && ownerId === user._id)
}

export function puedeMoverTareaKanban(
  tarea: Tarea,
  proyecto: Proyecto,
  user: AuthUser | null,
): boolean {
  if (!user) return false
  if (esDuenoProyecto(proyecto, user)) return true
  if (
    tarea.responsable_id &&
    user.empleado_id &&
    String(tarea.responsable_id) === String(user.empleado_id)
  ) {
    return true
  }
  return false
}

export function agruparTareasKanban(tareas: Tarea[]): Record<KanbanColumna, Tarea[]> {
  const grupos: Record<KanbanColumna, Tarea[]> = {
    todo: [],
    in_progress: [],
    done: [],
  }
  for (const t of tareas) {
    grupos[columnaKanbanDeEstado(t.estado)].push(t)
  }
  return grupos
}

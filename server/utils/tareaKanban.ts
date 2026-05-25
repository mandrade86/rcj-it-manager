export type KanbanColumna = 'todo' | 'in_progress' | 'done'

export type EstadoKanbanResultado = 'Pendiente' | 'En progreso' | 'Completado'

const COLUMNAS: KanbanColumna[] = ['todo', 'in_progress', 'done']

export function esColumnaKanban(v: unknown): v is KanbanColumna {
  return typeof v === 'string' && COLUMNAS.includes(v as KanbanColumna)
}

export function columnaKanbanDeEstado(estado: string): KanbanColumna {
  if (estado === 'Completado') return 'done'
  if (estado === 'En progreso') return 'in_progress'
  return 'todo'
}

export function estadoDesdeColumnaKanban(col: KanbanColumna): EstadoKanbanResultado {
  switch (col) {
    case 'done':
      return 'Completado'
    case 'in_progress':
      return 'En progreso'
    default:
      return 'Pendiente'
  }
}

export function porcentajeParaColumnaKanban(col: KanbanColumna, actual: number): number {
  if (col === 'done') return 100
  if (col === 'todo') return 0
  return actual > 0 && actual < 100 ? actual : Math.min(actual, 50) || 10
}

import { compareNumbers, compareStrings, type MaestroSortDir } from '@/lib/maestroList'
import type { Proyecto } from '@/types/proyecto'
import {
  proyectoDeptDoc,
  proyectoEmpresasLabel,
  proyectoOwnerName,
} from '@/types/proyecto'

const RIESGO_ORDEN: Record<string, number> = {
  Alto: 4,
  Medio: 3,
  Bajo: 2,
  'Sin fecha': 1,
}

const PRIORIDAD_ORDEN: Record<string, number> = {
  Alta: 3,
  Media: 2,
  Baja: 1,
}

function dateMs(raw?: string | null): number {
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function proyectoSearchTexts(p: Proyecto): (string | null | undefined)[] {
  return [
    p._id,
    p.nombre,
    p.descripcion,
    p.responsable,
    p.eje,
    p.estado,
    p.prioridad,
    p.tipo,
    p.riesgo?.nivel,
    p.riesgo?.motivo,
    proyectoOwnerName(p),
    proyectoDeptDoc(p)?.nombre,
    proyectoDeptDoc(p)?.codigo,
    proyectoEmpresasLabel(p),
  ]
}

export function compareProyectos(
  a: Proyecto,
  b: Proyecto,
  sortKey: string,
  sortDir: MaestroSortDir,
): number {
  const dir = sortDir

  switch (sortKey) {
    case 'id':
      return compareStrings(a._id, b._id, dir)
    case 'nombre':
      return compareStrings(a.nombre, b.nombre, dir)
    case 'tipo':
      return compareStrings(a.tipo ?? '', b.tipo ?? '', dir)
    case 'propietario':
      return compareStrings(proyectoOwnerName(a), proyectoOwnerName(b), dir)
    case 'departamento':
      return compareStrings(
        proyectoDeptDoc(a)?.nombre ?? '',
        proyectoDeptDoc(b)?.nombre ?? '',
        dir,
      )
    case 'empresas':
      return compareStrings(
        proyectoEmpresasLabel(a),
        proyectoEmpresasLabel(b),
        dir,
      )
    case 'eje':
      return compareStrings(a.eje ?? '', b.eje ?? '', dir)
    case 'inicio':
      return compareNumbers(dateMs(a.fecha_inicio), dateMs(b.fecha_inicio), dir)
    case 'fin':
      return compareNumbers(dateMs(a.fecha_fin), dateMs(b.fecha_fin), dir)
    case 'avance':
      return compareNumbers(a.porcentaje_avance ?? 0, b.porcentaje_avance ?? 0, dir)
    case 'riesgo': {
      const ra = RIESGO_ORDEN[a.riesgo?.nivel ?? ''] ?? 0
      const rb = RIESGO_ORDEN[b.riesgo?.nivel ?? ''] ?? 0
      return compareNumbers(ra, rb, dir)
    }
    case 'estado':
      return compareStrings(a.estado, b.estado, dir)
    case 'prioridad': {
      const pa = PRIORIDAD_ORDEN[a.prioridad] ?? 0
      const pb = PRIORIDAD_ORDEN[b.prioridad] ?? 0
      return compareNumbers(pa, pb, dir)
    }
    case 'fase':
      return compareNumbers(a.fase ?? 0, b.fase ?? 0, dir)
    default:
      return compareStrings(a.nombre, b.nombre, dir)
  }
}

export const PROYECTO_SORT_PRESETS: {
  id: string
  label: string
  sortKey: string
  sortDir: MaestroSortDir
}[] = [
  { id: 'nombre-asc', label: 'Nombre (A → Z)', sortKey: 'nombre', sortDir: 'asc' },
  { id: 'nombre-desc', label: 'Nombre (Z → A)', sortKey: 'nombre', sortDir: 'desc' },
  { id: 'fin-asc', label: 'Fecha fin (más próxima)', sortKey: 'fin', sortDir: 'asc' },
  { id: 'fin-desc', label: 'Fecha fin (más lejana)', sortKey: 'fin', sortDir: 'desc' },
  { id: 'avance-desc', label: 'Avance (mayor primero)', sortKey: 'avance', sortDir: 'desc' },
  { id: 'avance-asc', label: 'Avance (menor primero)', sortKey: 'avance', sortDir: 'asc' },
  { id: 'riesgo-desc', label: 'Riesgo (alto primero)', sortKey: 'riesgo', sortDir: 'desc' },
  { id: 'estado-asc', label: 'Estado (A → Z)', sortKey: 'estado', sortDir: 'asc' },
]

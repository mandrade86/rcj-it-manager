export type MaestroActivoFilter = 'all' | 'activos' | 'inactivos'
export type MaestroSortDir = 'asc' | 'desc'

export const MAESTRO_SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

export function matchMaestroSearch(query: string, texts: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return texts.some((t) => (t ?? '').toLowerCase().includes(q))
}

export function passMaestroActivoFilter(
  filter: MaestroActivoFilter,
  activo: boolean | undefined,
): boolean {
  if (filter === 'all') return true
  if (filter === 'activos') return activo !== false
  return activo === false
}

export function compareStrings(a: string, b: string, dir: MaestroSortDir): number {
  const r = a.localeCompare(b, 'es', { sensitivity: 'base' })
  return dir === 'asc' ? r : -r
}

export function compareNumbers(a: number, b: number, dir: MaestroSortDir): number {
  const r = a - b
  return dir === 'asc' ? r : -r
}

export function nextMaestroSort(
  currentKey: string,
  column: string,
  currentDir: MaestroSortDir,
): { key: string; dir: MaestroSortDir } {
  if (currentKey === column) {
    return { key: column, dir: currentDir === 'asc' ? 'desc' : 'asc' }
  }
  return { key: column, dir: 'asc' }
}

export type ApplyMaestroListOptions<T> = {
  items: T[]
  busqueda?: string
  searchTexts?: (item: T) => (string | null | undefined)[]
  filterActivo?: MaestroActivoFilter
  getActivo?: (item: T) => boolean | undefined
  sortKey: string
  sortDir: MaestroSortDir
  compare: (a: T, b: T, sortKey: string, sortDir: MaestroSortDir) => number
}

export function applyMaestroList<T>(opts: ApplyMaestroListOptions<T>): T[] {
  const {
    items,
    busqueda = '',
    searchTexts,
    filterActivo = 'all',
    getActivo,
    sortKey,
    sortDir,
    compare,
  } = opts

  let out = items

  if (getActivo && filterActivo !== 'all') {
    out = out.filter((item) => passMaestroActivoFilter(filterActivo, getActivo(item)))
  }

  if (searchTexts && busqueda.trim()) {
    out = out.filter((item) => matchMaestroSearch(busqueda, searchTexts(item)))
  }

  return [...out].sort((a, b) => compare(a, b, sortKey, sortDir))
}

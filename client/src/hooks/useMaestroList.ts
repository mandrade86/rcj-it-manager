import { useCallback, useMemo, useState } from 'react'

import {
  applyMaestroList,
  type MaestroActivoFilter,
  type MaestroSortDir,
} from '@/lib/maestroList'

type Options<T> = {
  items: T[]
  defaultSortKey: string
  defaultSortDir?: MaestroSortDir
  searchTexts?: (item: T) => (string | null | undefined)[]
  getActivo?: (item: T) => boolean | undefined
  compare: (a: T, b: T, sortKey: string, sortDir: MaestroSortDir) => number
}

export function useMaestroList<T>({
  items,
  defaultSortKey,
  defaultSortDir = 'asc',
  searchTexts,
  getActivo,
  compare,
}: Options<T>) {
  const [busqueda, setBusqueda] = useState('')
  const [filterActivo, setFilterActivo] = useState<MaestroActivoFilter>('all')
  const [sortKey, setSortKey] = useState(defaultSortKey)
  const [sortDir, setSortDir] = useState<MaestroSortDir>(defaultSortDir)

  const onSort = useCallback((key: string, dir: MaestroSortDir) => {
    setSortKey(key)
    setSortDir(dir)
  }, [])

  const rows = useMemo(
    () =>
      applyMaestroList({
        items,
        busqueda,
        filterActivo,
        sortKey,
        sortDir,
        searchTexts,
        getActivo,
        compare,
      }),
    [items, busqueda, filterActivo, sortKey, sortDir, searchTexts, getActivo, compare],
  )

  return {
    rows,
    busqueda,
    setBusqueda,
    filterActivo,
    setFilterActivo,
    sortKey,
    sortDir,
    onSort,
    total: items.length,
    count: rows.length,
  }
}

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { nextMaestroSort, type MaestroSortDir } from '@/lib/maestroList'

type Props = {
  column: string
  label: string
  sortKey: string
  sortDir: MaestroSortDir
  onSort: (key: string, dir: MaestroSortDir) => void
  className?: string
}

export function MaestroSortableHead({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
  className,
}: Props) {
  const active = sortKey === column

  return (
    <TableHead className={className}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 font-medium hover:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
        onClick={() => {
          const next = nextMaestroSort(sortKey, column, sortDir)
          onSort(next.key, next.dir)
        }}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-50" />
        )}
      </button>
    </TableHead>
  )
}

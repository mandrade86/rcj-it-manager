import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PAGE_SIZE_OPTIONS } from '@/hooks/usePagination'
import { cn } from '@/lib/utils'

export type PaginationBarProps = {
  page: number
  totalPages: number
  pageSize: number
  totalItems: number
  fromItem: number
  toItem: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  className?: string
  /** Ocultar si solo hay una página (sin cambiar tamaño) */
  hideWhenSinglePage?: boolean
}

export function PaginationBar({
  page,
  totalPages,
  pageSize,
  totalItems,
  fromItem,
  toItem,
  onPageChange,
  onPageSizeChange,
  className,
  hideWhenSinglePage = false,
}: PaginationBarProps) {
  if (totalItems === 0) return null
  if (hideWhenSinglePage && totalPages <= 1 && !onPageSizeChange) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground',
        className,
      )}
    >
      {onPageSizeChange ? (
        <label className="flex items-center gap-2">
          <span className="text-xs">Por página</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Registros por página"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="text-xs">{pageSize} por página</span>
      )}

      <span className="text-xs tabular-nums">
        Mostrando <span className="font-medium text-foreground">{fromItem}</span>–
        <span className="font-medium text-foreground">{toItem}</span> de{' '}
        <span className="font-medium text-foreground">{totalItems}</span>
      </span>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-[100px] text-center text-xs tabular-nums">
          Página <span className="font-medium text-foreground">{page}</span> de{' '}
          <span className="font-medium text-foreground">{totalPages}</span>
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

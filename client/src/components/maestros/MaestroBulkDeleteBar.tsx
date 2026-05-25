import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

type Props = {
  seleccionCount: number
  bulkDeleting?: boolean
  onEliminar: () => void
  etiqueta?: string
}

export function MaestroBulkDeleteBar({
  seleccionCount,
  bulkDeleting = false,
  onEliminar,
  etiqueta = 'registro(s)',
}: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        {seleccionCount === 0
          ? `Marca ${etiqueta} en la tabla para eliminarlos en lote.`
          : `${seleccionCount} seleccionado(s).`}
      </span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="gap-1.5"
        disabled={seleccionCount === 0 || bulkDeleting}
        onClick={onEliminar}
      >
        <Trash2 className="size-3.5" />
        {bulkDeleting ? 'Eliminando…' : 'Eliminar seleccionados'}
      </Button>
    </div>
  )
}

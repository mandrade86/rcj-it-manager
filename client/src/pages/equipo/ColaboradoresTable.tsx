import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatLps } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Colaborador } from '@/types/colaborador'

export function ColaboradoresTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Colaborador[]
  onEdit: (c: Colaborador) => void
  onDelete: (c: Colaborador) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Nombre</TableHead>
            <TableHead>Puesto</TableHead>
            <TableHead>Frente</TableHead>
            <TableHead>Nivel</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Salario</TableHead>
            <TableHead className="w-[100px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No hay colaboradores con los filtros seleccionados.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((c) => (
              <TableRow key={c._id}>
                <TableCell className="font-medium">
                  {c.estado === 'Activo' ? (
                    <Link
                      to={`/equipo/${c._id}`}
                      className="text-[var(--navy)] underline-offset-2 hover:underline"
                    >
                      {c.nombre}
                    </Link>
                  ) : (
                    <span>{c.nombre}</span>
                  )}
                </TableCell>
                <TableCell>{c.puesto}</TableCell>
                <TableCell>{c.frente}</TableCell>
                <TableCell>{c.nivel ?? '—'}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      c.estado === 'Activo' && 'bg-[var(--lime-lt)] text-[var(--navy)]',
                      c.estado === 'Futuro' && 'bg-[var(--blue-lt)] text-foreground',
                    )}
                  >
                    {c.estado}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatLps(c.salario_mensual ?? null)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => onEdit(c)}
                    aria-label={`Editar ${c.nombre}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(c)}
                    aria-label={`Eliminar ${c.nombre}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

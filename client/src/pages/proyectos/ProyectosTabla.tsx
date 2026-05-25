import { Building2, Factory, User } from 'lucide-react'

import { MaestroSortableHead } from '@/components/maestros/MaestroSortableHead'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { MaestroSortDir } from '@/lib/maestroList'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ejeBarClass } from '@/lib/ejeColors'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Proyecto } from '@/types/proyecto'
import {
  estadoColor, proyectoDeptDoc, proyectoEmpresasLabel, proyectoOwnerName,
} from '@/types/proyecto'

function AvanceBar({ value }: { value: number }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-[var(--lime)] transition-all"
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="tabular-nums text-xs text-muted-foreground">{v}%</span>
    </div>
  )
}

export function ProyectosTabla({
  rows,
  onRowClick,
  miUsuarioId,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  sortKey,
  sortDir,
  onSort,
  emptyMessage = 'No hay proyectos con los filtros seleccionados.',
}: {
  rows: Proyecto[]
  onRowClick: (p: Proyecto) => void
  miUsuarioId?: string | null
  selectable?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleRow?: (id: string) => void
  onToggleAll?: () => void
  sortKey?: string
  sortDir?: MaestroSortDir
  onSort?: (key: string, dir: MaestroSortDir) => void
  emptyMessage?: string
}) {
  const sortable = Boolean(onSort && sortKey && sortDir)
  const selected = selectedIds ?? new Set<string>()
  const allSelected =
    rows.length > 0 && rows.every((p) => selected.has(p._id))
  const someSelected = rows.some((p) => selected.has(p._id))

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {selectable && (
              <TableHead className="w-10 pr-0">
                <input
                  type="checkbox"
                  className="size-3.5 accent-[var(--lime)]"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected
                  }}
                  onChange={() => onToggleAll?.()}
                  title="Seleccionar todos en la lista"
                />
              </TableHead>
            )}
            {sortable ? (
              <>
                <MaestroSortableHead column="id" label="ID" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} className="w-[100px]" />
                <MaestroSortableHead column="nombre" label="Nombre" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="tipo" label="Tipo" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="propietario" label="Propietario" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="departamento" label="Departamento" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <TableHead>Empresas</TableHead>
                <MaestroSortableHead column="eje" label="Eje" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="inicio" label="Inicio" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="fin" label="Fin" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="avance" label="Avance" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="riesgo" label="Riesgo" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
                <MaestroSortableHead column="estado" label="Estado" sortKey={sortKey!} sortDir={sortDir!} onSort={onSort!} />
              </>
            ) : (
              <>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Propietario</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Empresas</TableHead>
                <TableHead>Eje</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Riesgo</TableHead>
                <TableHead>Estado</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={selectable ? 13 : 12}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((p) => {
              const dept = proyectoDeptDoc(p)
              const owner = proyectoOwnerName(p)
              const ownerObj = typeof p.usuario_id === 'object' ? p.usuario_id : null
              const isMine = ownerObj != null && miUsuarioId != null && ownerObj._id === miUsuarioId
              return (
                <TableRow
                  key={p._id}
                  className="cursor-pointer"
                  onClick={() => onRowClick(p)}
                >
                  {selectable && (
                    <TableCell
                      className="w-10 pr-0 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="size-3.5 accent-[var(--lime)]"
                        checked={selected.has(p._id)}
                        onChange={() => onToggleRow?.(p._id)}
                        aria-label={`Seleccionar ${p._id}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs font-medium">{p._id}</TableCell>
                  <TableCell className="max-w-[220px] font-medium">
                    <span className="line-clamp-2">{p.nombre}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {p.tipo === 'departamental' ? 'Departamental' : 'Individual'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {owner ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3 text-muted-foreground" />
                        {owner}
                        {isMine && (
                          <Badge variant="secondary" className="ml-1 bg-[var(--lime-lt)] py-0 text-[9px] text-[var(--navy)]">
                            tú
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {dept ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: dept.color ?? '#002060' }}
                        />
                        <Building2 className="size-3 text-muted-foreground" />
                        {dept.nombre}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] text-xs">
                    {(() => {
                      const lab = proyectoEmpresasLabel(p)
                      if (!lab) return <span className="text-muted-foreground">—</span>
                      return (
                        <span className="inline-flex items-start gap-1 line-clamp-2">
                          <Factory className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                          {lab}
                        </span>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    {p.eje ? (
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] text-white', ejeBarClass(p.eje))}
                      >
                        {p.eje}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDateDMY(p.fecha_inicio)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatDateDMY(p.fecha_fin)}
                  </TableCell>
                  <TableCell>
                    <AvanceBar value={p.porcentaje_avance} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.riesgo ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex cursor-default items-center gap-1.5">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: p.riesgo.color }}
                              aria-hidden
                            />
                            <span className="font-medium">{p.riesgo.nivel}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {p.riesgo.motivo}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-[10px]', estadoColor(p.estado))}>
                      {p.estado}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

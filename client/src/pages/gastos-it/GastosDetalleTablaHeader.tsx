import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type GastosDetalleColumnaDef = {
  id: string
  label: string
  filter?: 'text' | 'select'
  align?: 'left' | 'right'
  className?: string
}

type Props = {
  columnas: GastosDetalleColumnaDef[]
  filtros: Record<string, string>
  opciones: Record<string, string[]>
  onFiltroChange: (columna: string, valor: string) => void
}

export function GastosDetalleTablaHeader({
  columnas,
  filtros,
  opciones,
  onFiltroChange,
}: Props) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {columnas.map((col) => (
          <TableHead
            key={col.id}
            className={cn(
              'align-top whitespace-normal py-2',
              col.align === 'right' && 'text-right',
              col.className,
            )}
          >
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold leading-none">{col.label}</span>
              {col.filter === 'text' ? (
                <Input
                  value={filtros[col.id] ?? ''}
                  onChange={(e) => onFiltroChange(col.id, e.target.value)}
                  placeholder="Filtrar…"
                  className="h-7 min-w-[72px] text-xs"
                />
              ) : null}
              {col.filter === 'select' ? (
                <Select
                  value={filtros[col.id] || 'todos'}
                  onValueChange={(v) => onFiltroChange(col.id, v)}
                >
                  <SelectTrigger className="h-7 min-w-[88px] text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {(opciones[col.id] ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  )
}

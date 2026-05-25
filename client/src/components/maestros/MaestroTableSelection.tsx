import { TableHead, TableCell } from '@/components/ui/table'

export function MaestroSelectAllHeader({
  allSelected,
  someSelected,
  onToggleAll,
}: {
  allSelected: boolean
  someSelected: boolean
  onToggleAll: () => void
}) {
  return (
    <TableHead className="w-10 pr-0">
      <input
        type="checkbox"
        className="size-3.5 accent-[var(--lime)]"
        checked={allSelected}
        ref={(el) => {
          if (el) el.indeterminate = !allSelected && someSelected
        }}
        onChange={onToggleAll}
        title="Seleccionar todos en la lista"
      />
    </TableHead>
  )
}

export function MaestroSelectCell({
  id,
  label,
  selected,
  onToggle,
}: {
  id: string
  label: string
  selected: boolean
  onToggle: (id: string) => void
}) {
  return (
    <TableCell className="w-10 pr-0" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        className="size-3.5 accent-[var(--lime)]"
        checked={selected}
        onChange={() => onToggle(id)}
        aria-label={`Seleccionar ${label}`}
      />
    </TableCell>
  )
}

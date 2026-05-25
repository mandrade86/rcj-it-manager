import type { DepartamentoDoc } from '@/types/departamento'

type Props = {
  departamentos: DepartamentoDoc[]
  value: string[]
  onChange: (v: string[]) => void
  hint?: string
}

export function DepartamentosMultiSelect({
  departamentos, value, onChange, hint,
}: Props) {
  const set = new Set(value)
  return (
    <div className="grid gap-2 max-h-48 overflow-y-auto rounded-md border border-border p-2">
      <p className="text-xs text-muted-foreground">
        {hint ?? (
          <>
            Marca los departamentos que esta persona supervisa. En <strong>Mi Equipo</strong> verá
            a los empleados activos asignados a cada departamento (además de su jerarquía por jefe).
          </>
        )}
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {departamentos.map((d) => (
          <label key={d._id} className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs hover:bg-muted">
            <input
              type="checkbox"
              checked={set.has(d._id)}
              className="size-4 accent-[var(--lime)]"
              onChange={(e) => {
                const next = new Set(value)
                if (e.target.checked) next.add(d._id)
                else next.delete(d._id)
                onChange(Array.from(next))
              }}
            />
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: d.color ?? '#002060' }}
            />
            <span className="truncate">
              {d.nombre} <span className="text-muted-foreground">({d.codigo})</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

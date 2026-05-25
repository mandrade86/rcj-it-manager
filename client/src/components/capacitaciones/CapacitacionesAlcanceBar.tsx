import { Building2, Globe } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { CapacitacionesAlcance } from '@/types/capacitacion'

type Props = {
  alcance: CapacitacionesAlcance
}

export function CapacitacionesAlcanceBar({ alcance }: Props) {
  const Icon = alcance.isGlobal ? Globe : Building2

  return (
    <div className="rounded-lg border border-border bg-[var(--blue-lt)]/40 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-[var(--navy)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--navy)]">{alcance.etiqueta}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{alcance.descripcion}</p>
          </div>
        </div>
        {!alcance.isGlobal && alcance.departamentos.length > 0 && (
          <div className="flex flex-wrap gap-1 sm:justify-end">
            {alcance.departamentos.map((d) => (
              <Badge
                key={d._id}
                variant="outline"
                className="gap-1 bg-card py-0 text-[10px] text-[var(--navy)]"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ background: d.color ?? '#002060' }}
                />
                {d.codigo}
                <span className="font-normal text-muted-foreground">· {d.nombre}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

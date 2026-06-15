import { Building2, Globe, User, UserCheck, UsersRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProyectoAlcance } from '@/store/proyectosStore'

type Props = {
  alcance: ProyectoAlcance
  onAlcanceChange: (v: ProyectoAlcance) => void
  cuentas: { mias: number; equipo: number; depto: number; participo: number; total: number }
  puedeVerTodos: boolean
  miDepartamentoId: string | null
  contextLine: React.ReactNode
}

const items: {
  id: ProyectoAlcance
  label: string
  icon: typeof User
  countKey: keyof Props['cuentas'] | null
  disabled?: (p: Pick<Props, 'puedeVerTodos' | 'miDepartamentoId'>) => boolean
}[] = [
  { id: 'mis', label: 'Mis proyectos', icon: User, countKey: 'mias' },
  { id: 'equipo', label: 'Mi equipo', icon: UsersRound, countKey: 'equipo' },
  {
    id: 'participo',
    label: 'Donde participo',
    icon: UserCheck,
    countKey: 'participo',
  },
  {
    id: 'depto',
    label: 'Mi departamento',
    icon: Building2,
    countKey: 'depto',
    disabled: (p) => !p.miDepartamentoId,
  },
  {
    id: 'todos',
    label: 'Todos',
    icon: Globe,
    countKey: 'total',
    disabled: (p) => !p.puedeVerTodos,
  },
]

export function ProyectosAlcanceBar({
  alcance,
  onAlcanceChange,
  cuentas,
  puedeVerTodos,
  miDepartamentoId,
  contextLine,
}: Props) {
  const props = { puedeVerTodos, miDepartamentoId }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
        {items.map(({ id, label, icon: Icon, countKey, disabled }) => {
          const off = disabled?.(props)
          const active = alcance === id
          const count = countKey ? cuentas[countKey] : 0
          return (
            <button
              key={id}
              type="button"
              disabled={off}
              title={off ? 'No disponible para tu perfil' : label}
              onClick={() => onAlcanceChange(id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                active
                  ? 'bg-card text-[var(--navy)] shadow-sm'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                off && 'cursor-not-allowed opacity-40',
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ').pop()}</span>
              <Badge
                variant="secondary"
                className={cn(
                  'h-4 min-w-4 justify-center px-1 text-[10px]',
                  active && 'bg-[var(--lime-lt)] text-[var(--navy)]',
                )}
              >
                {count}
              </Badge>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground sm:max-w-[45%] sm:text-right">{contextLine}</p>
    </div>
  )
}

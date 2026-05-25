import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DeudaTecnica, JiraStatusResumen } from '@/types/itArquitectura'

const categoryStyle: Record<string, string> = {
  new: 'bg-slate-100 text-slate-800 border-slate-300',
  indeterminate: 'bg-blue-100 text-blue-900 border-blue-300',
  done: 'bg-emerald-100 text-emerald-900 border-emerald-300',
}

export function JiraStatusBadge({ deuda }: { deuda: DeudaTecnica }) {
  if (!deuda.jira_issue_key) return null

  if (!deuda.jira_status_name) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        Jira: sin sincronizar
      </Badge>
    )
  }

  const cat = deuda.jira_status_category ?? ''
  const style = categoryStyle[cat] ?? 'bg-muted text-muted-foreground border-border'

  return (
    <Badge variant="outline" className={cn('gap-1 border py-0 text-[10px] font-medium', style)}>
      <span className="opacity-70">Jira</span>
      {deuda.jira_status_name}
    </Badge>
  )
}

export function JiraStatusResumenPanel({
  resumen,
  syncing,
  onSync,
}: {
  resumen: JiraStatusResumen
  syncing?: boolean
  onSync?: () => void
}) {
  const { por_categoria, total_vinculados } = resumen
  if (total_vinculados === 0) return null

  const tiles = [
    { label: 'Por hacer', count: por_categoria.todo, className: 'bg-slate-50 text-slate-800' },
    { label: 'En curso', count: por_categoria.in_progress, className: 'bg-blue-50 text-blue-900' },
    { label: 'Hecho', count: por_categoria.done, className: 'bg-emerald-50 text-emerald-900' },
  ]

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--navy)]">
          Estado en Jira ({total_vinculados} vinculadas)
        </p>
        {onSync && (
          <button
            type="button"
            disabled={syncing}
            onClick={onSync}
            className="text-xs font-medium text-[var(--navy)] underline-offset-2 hover:underline disabled:opacity-50"
          >
            {syncing ? 'Actualizando…' : 'Actualizar desde Jira'}
          </button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:max-w-md">
        {tiles.map((t) => (
          <div key={t.label} className={cn('rounded-md px-2 py-1.5 text-center', t.className)}>
            <p className="text-lg font-semibold leading-none">{t.count}</p>
            <p className="mt-0.5 text-[10px]">{t.label}</p>
          </div>
        ))}
      </div>
      {por_categoria.sin_sync > 0 && (
        <p className="mt-2 text-[10px] text-muted-foreground">
          {por_categoria.sin_sync} pendiente(s) de primera sincronización — usa «Actualizar desde Jira».
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Si Jira marca la tarea como hecha, el estado RCJ pasa a «Resuelta» automáticamente al sincronizar.
      </p>
    </div>
  )
}

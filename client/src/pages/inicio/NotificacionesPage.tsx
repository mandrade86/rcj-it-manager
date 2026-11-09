import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatDateDMY } from '@/lib/format'
import {
  fetchNotificaciones, guardarLeidas, leerLeidas, type NotificacionItem,
} from '@/lib/notificaciones'

export function NotificacionesPage() {
  const [items, setItems] = useState<NotificacionItem[]>([])
  const [vistas, setVistas] = useState<Set<string>>(() => leerLeidas())
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    void fetchNotificaciones()
      .then((rows) => { if (!cancel) setItems(rows) })
      .catch((e) => { if (!cancel) setErr(e instanceof Error ? e.message : 'Error') })
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [])

  function marcar(id: string) {
    const next = new Set(vistas)
    next.add(id)
    setVistas(next)
    guardarLeidas(next)
  }

  function marcarTodas() {
    const next = new Set(vistas)
    for (const it of items) next.add(it.id)
    setVistas(next)
    guardarLeidas(next)
  }

  const pendientes = items.filter((it) => !vistas.has(it.id)).length

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Notificaciones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Proyectos a los que te agregaron, tareas vencidas o por vencer en 7 días, y evaluaciones que aún no tienen todas las firmas.
          </p>
        </div>
        {items.length > 0 && (
          <button type="button" className="text-xs text-[var(--navy)] underline-offset-2 hover:underline" onClick={marcarTodas}>
            Marcar leídas ({pendientes})
          </button>
        )}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 && !err ? (
        <p className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-muted-foreground">
          No hay avisos pendientes. Las tareas del día siguen en{' '}
          <Link to="/" className="text-[var(--navy)] underline-offset-2 hover:underline">Mi día</Link>.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
          {items.map((it) => {
            const leida = vistas.has(it.id)
            return (
              <li key={it.id}>
                <Link
                  to={it.href}
                  onClick={() => marcar(it.id)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40"
                >
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${leida ? 'bg-transparent' : 'bg-[var(--lime)]'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--navy)]">{it.titulo}</span>
                    <span className="block text-xs text-muted-foreground">{it.detalle}</span>
                    {it.fecha && (
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatDateDMY(it.fecha)}</span>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

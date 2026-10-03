import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { formatDateDMY } from '@/lib/format'

type Item = {
  id: string
  tipo: string
  titulo: string
  detalle: string
  fecha: string | null
  href: string
}

const LEIDAS = 'rcj_notif_leidas'

function leidas(): Set<string> {
  try {
    const raw = localStorage.getItem(LEIDAS)
    const arr = raw ? JSON.parse(raw) as string[] : []
    return new Set(arr)
  } catch {
    return new Set()
  }
}

function guardarLeidas(set: Set<string>) {
  localStorage.setItem(LEIDAS, JSON.stringify([...set].slice(-400)))
}

export function NotificacionesPage() {
  const [items, setItems] = useState<Item[]>([])
  const [vistas, setVistas] = useState<Set<string>>(() => leidas())
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    void fetch('/api/dashboard/notificaciones')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudieron cargar las notificaciones')
        return res.json() as Promise<{ items: Item[] }>
      })
      .then((data) => { if (!cancel) setItems(data.items ?? []) })
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
            Tareas vencidas o por vencer en 7 días, y evaluaciones que aún no tienen todas las firmas.
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

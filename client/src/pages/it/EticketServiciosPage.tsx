import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateDMY } from '@/lib/format'

type Servicio = {
  _id: string
  externalId: string
  ticketNumber?: string
  title: string
  status?: string
  priority?: string
  system?: string
  department?: string
  requesterEmail?: string
  requesterName?: string
  assigneeEmail?: string
  sourceUrl?: string
  markedBy?: string
  markedAt?: string
  importedAt?: string
}

type SyncResult = {
  ok?: boolean
  configurado?: boolean
  consultados?: number
  creados?: number
  actualizados?: number
  confirmados?: number
  ya_confirmados?: number
  errores?: Array<{ externalId: string; error: string }>
  error?: string
}

export function EticketServiciosPage() {
  const [items, setItems] = useState<Servicio[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [configurado, setConfigurado] = useState<boolean | null>(null)

  const load = useCallback(async (term: string) => {
    setLoading(true)
    setErr(null)
    try {
      const url = term.trim()
        ? `/api/eticket/servicios?q=${encodeURIComponent(term.trim())}`
        : '/api/eticket/servicios'
      const res = await fetch(url)
      if (!res.ok) throw new Error('No se pudo cargar los servicios')
      const data = (await res.json()) as { items: Servicio[] }
      setItems(data.items ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load('')
    void fetch('/api/eticket/servicios/status')
      .then(async (r) => {
        if (!r.ok) return
        const d = (await r.json()) as { configurado?: boolean }
        setConfigurado(Boolean(d.configurado))
      })
      .catch(() => setConfigurado(null))
  }, [load])

  async function syncNow() {
    setSyncing(true)
    setSyncMsg(null)
    setErr(null)
    try {
      const res = await fetch('/api/eticket/servicios/sync', { method: 'POST' })
      const data = (await res.json()) as SyncResult
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar')
      const parts = [
        `Consultados: ${data.consultados ?? 0}`,
        `nuevos: ${data.creados ?? 0}`,
        `actualizados: ${data.actualizados ?? 0}`,
        `confirmados en eTicket: ${data.confirmados ?? 0}`,
      ]
      if (data.errores?.length) parts.push(`errores: ${data.errores.length}`)
      setSyncMsg(parts.join(' · '))
      await load(q)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Servicios eTicket (desarrollo)</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tickets de desarrollo marcados en eTicket e importados aquí como servicios.
            Clave única: <code className="text-xs">externalId</code>.
          </p>
          {configurado === false && (
            <p className="mt-2 text-sm text-amber-700">
              Falta configurar <code>ETICKET_API_BASE_URL</code> y <code>ETICKET_API_KEY</code> en el servidor.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void load(q)
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ticket, título, sistema…"
              className="h-9 w-56"
            />
            <Button type="submit" variant="outline" className="h-9">
              Buscar
            </Button>
          </form>
          <Button
            type="button"
            className="h-9 gap-1.5 bg-[var(--lime)] text-[var(--navy)] hover:bg-[var(--lime)]/90"
            disabled={syncing || configurado === false}
            onClick={() => void syncNow()}
          >
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
          </Button>
        </div>
      </div>

      {syncMsg && <p className="text-sm text-[var(--navy)]">{syncMsg}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b bg-[var(--gray-lt)] text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Ticket</th>
                <th className="px-3 py-2 font-medium">Título</th>
                <th className="px-3 py-2 font-medium">Sistema</th>
                <th className="px-3 py-2 font-medium">Prioridad</th>
                <th className="px-3 py-2 font-medium">Solicitante</th>
                <th className="px-3 py-2 font-medium">Importado</th>
                <th className="px-3 py-2 font-medium">eTicket</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No hay servicios importados. Marca tickets en eTicket y pulsa Sincronizar.
                  </td>
                </tr>
              ) : (
                items.map((s) => (
                  <tr key={s._id} className="border-b last:border-0 hover:bg-[var(--gray-bg)]">
                    <td className="px-3 py-2 font-mono text-xs">{s.ticketNumber || s.externalId.slice(-8)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[var(--text)]">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.status}</div>
                    </td>
                    <td className="px-3 py-2">{s.system || '—'}</td>
                    <td className="px-3 py-2 capitalize">{s.priority || '—'}</td>
                    <td className="px-3 py-2">
                      <div>{s.requesterName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{s.requesterEmail}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.importedAt ? formatDateDMY(s.importedAt) : '—'}
                      {s.markedBy ? (
                        <div className="text-muted-foreground">marcado por {s.markedBy}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {s.sourceUrl ? (
                        <a
                          href={s.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--navy)] underline-offset-2 hover:underline"
                        >
                          Abrir <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

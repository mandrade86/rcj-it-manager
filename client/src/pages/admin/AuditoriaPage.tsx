import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateDMY } from '@/lib/format'

type Fila = {
  _id: string
  usuario_nombre: string
  accion: string
  entidad: string
  entidad_id: string
  detalle: string
  ip: string
  createdAt?: string
}

const ACCION: Record<string, string> = {
  login: 'Inició sesión',
  crear: 'Creó',
  editar: 'Editó',
  eliminar: 'Eliminó',
}

export function AuditoriaPage() {
  const [rows, setRows] = useState<Fila[]>([])
  const [q, setQ] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load(term: string) {
    setLoading(true)
    setErr(null)
    try {
      const url = term.trim() ? `/api/auditoria?q=${encodeURIComponent(term.trim())}` : '/api/auditoria'
      const res = await fetch(url)
      if (!res.ok) throw new Error('No se pudo cargar la auditoría')
      setRows(await res.json() as Fila[])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load('')
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--navy)]">Auditoría</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Quién hizo qué, cuándo y desde qué IP. Cubre inicios de sesión y cambios.
            El historial de estado de cada proyecto sigue en su ficha.
          </p>
        </div>
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
            placeholder="Usuario, acción, IP…"
            className="h-9 w-56"
          />
          <Button type="submit" variant="outline" className="h-9">Buscar</Button>
        </form>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Cuándo</th>
              <th className="px-3 py-2">Quién</th>
              <th className="px-3 py-2">Qué</th>
              <th className="px-3 py-2">Detalle</th>
              <th className="px-3 py-2">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  Aún no hay eventos. Aparecen al iniciar sesión o al guardar cambios.
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r._id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                  {r.createdAt ? formatDateDMY(r.createdAt) : '—'}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {r.createdAt ? new Date(r.createdAt).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">{r.usuario_nombre}</td>
                <td className="px-3 py-2">
                  {ACCION[r.accion] ?? r.accion} {r.entidad}
                  {r.entidad_id ? <span className="block text-[11px] text-muted-foreground">{r.entidad_id}</span> : null}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-muted-foreground" title={r.detalle}>{r.detalle || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        <Link to="/proyectos" className="text-[var(--navy)] underline-offset-2 hover:underline">Proyectos</Link>
        {' '}conservan su propio historial de cambios de estado.
      </p>
    </div>
  )
}

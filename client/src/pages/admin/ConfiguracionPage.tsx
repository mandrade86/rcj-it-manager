import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchDepartamentos, updateDepartamento } from '@/lib/api/departamentos'
import { fetchWorkspaceNombre, updateWorkspaceNombre } from '@/lib/api/workspace'
import { cn } from '@/lib/utils'
import type { DepartamentoDoc } from '@/types/departamento'

function empresaLabel(d: DepartamentoDoc): string {
  if (typeof d.empresa_id === 'object' && d.empresa_id != null && 'nombre' in d.empresa_id) {
    return d.empresa_id.nombre
  }
  return '—'
}

export function ConfiguracionPage() {
  const [list, setList] = useState<DepartamentoDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [nombre, setNombre] = useState('')
  const [nombreGuardado, setNombreGuardado] = useState('')
  const [guardandoNombre, setGuardandoNombre] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setList(await fetchDepartamentos({ todos: true }))
      const n = await fetchWorkspaceNombre()
      setNombre(n)
      setNombreGuardado(n)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudieron cargar los departamentos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    if (!s) return base
    return base.filter((d) =>
      d.nombre.toLowerCase().includes(s)
      || d.codigo.toLowerCase().includes(s)
      || empresaLabel(d).toLowerCase().includes(s),
    )
  }, [list, q])

  async function toggle(d: DepartamentoDoc) {
    const next = d.activo === false
    setList((prev) => prev.map((x) => (x._id === d._id ? { ...x, activo: next } : x)))
    setBusyId(d._id)
    try {
      await updateDepartamento(d._id, { activo: next })
    } catch (e) {
      setList((prev) => prev.map((x) => (x._id === d._id ? { ...x, activo: d.activo } : x)))
      window.alert(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setBusyId(null)
    }
  }

  const visibles = list.filter((d) => d.activo !== false).length

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h1 className="text-xl font-semibold text-[var(--navy)]">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nombre del área en el menú y visibilidad de departamentos.
        </p>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const next = nombre.trim()
            if (!next || next === nombreGuardado) return
            setGuardandoNombre(true)
            void updateWorkspaceNombre(next)
              .then((saved) => {
                setNombre(saved)
                setNombreGuardado(saved)
                window.dispatchEvent(new CustomEvent('rcj-workspace-nombre', { detail: saved }))
              })
              .catch((err) => window.alert(err instanceof Error ? err.message : 'No se pudo guardar'))
              .finally(() => setGuardandoNombre(false))
          }}
        >
          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">Nombre del área</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              className="h-9 w-72 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
            />
          </label>
          <button
            type="submit"
            disabled={guardandoNombre || !nombre.trim() || nombre.trim() === nombreGuardado}
            className="h-9 rounded-md bg-[var(--navy)] px-3 text-sm text-white disabled:opacity-50"
          >
            {guardandoNombre ? 'Guardando…' : 'Guardar nombre'}
          </button>
        </form>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--navy)]">Departamentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Un clic en la fila muestra u oculta el departamento en selectores y reportes.
            {list.length > 0 ? ` ${visibles} de ${list.length} visibles.` : ''}
          </p>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar departamento…"
          className="h-9 w-full max-w-xs rounded-full border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--navy)]/20"
        />
      </div>

      {err && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando departamentos…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Departamento</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="w-28 px-4 py-2 text-right">Mostrar</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay departamentos con esa búsqueda.
                  </td>
                </tr>
              ) : (
                rows.map((d) => {
                  const on = d.activo !== false
                  return (
                    <tr key={d._id} className={cn(!on && 'opacity-60')}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-[var(--navy)]">{d.nombre}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{d.codigo}</p>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{empresaLabel(d)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={on ? `Ocultar ${d.nombre}` : `Mostrar ${d.nombre}`}
                          disabled={busyId === d._id}
                          onClick={() => void toggle(d)}
                          className={cn(
                            'relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50',
                            on ? 'bg-[var(--lime)]' : 'bg-[#c5c7d0]',
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 size-5 rounded-full bg-white shadow transition',
                              on ? 'left-5' : 'left-0.5',
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

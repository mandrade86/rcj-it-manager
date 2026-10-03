import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Users } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateDMY } from '@/lib/format'

type Admin = {
  usuarios_activos: number
  usuarios_inactivos: number
  roles: number
  accesos: Array<{ nombre: string; ultimo_acceso: string | null }>
  auditoria: Array<{
    _id: string
    usuario_nombre: string
    accion: string
    entidad: string
    ip: string
    createdAt?: string
  }>
}

export function DashboardAdmin() {
  const [data, setData] = useState<Admin | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void fetch('/api/dashboard/paneles')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el panel de administración')
        return res.json() as Promise<{ admin?: Admin }>
      })
      .then((j) => { if (!cancel) setData(j.admin ?? null) })
      .catch((e) => { if (!cancel) setErr(e instanceof Error ? e.message : 'Error') })
    return () => { cancel = true }
  }, [])

  if (err) return <p className="text-sm text-destructive">{err}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Cargando panel de administración…</p>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--navy)]">Dashboard de administración</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuentas, roles y los últimos movimientos registrados.
        </p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Usuarios activos</CardTitle>
            <Users className="size-4 text-[var(--navy)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-[var(--navy)]">{data.usuarios_activos}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data.usuarios_inactivos} inactivos</p>
            <Link to="/admin/usuarios" className="mt-2 inline-block text-xs font-medium text-[var(--navy)] hover:underline">Abrir usuarios</Link>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Roles</CardTitle>
            <Shield className="size-4 text-[var(--navy)]" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-[var(--navy)]">{data.roles}</p>
            <p className="mt-1 text-xs text-muted-foreground">Perfiles de acceso</p>
            <Link to="/admin/roles" className="mt-2 inline-block text-xs font-medium text-[var(--navy)] hover:underline">Abrir roles</Link>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Últimos accesos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.accesos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin inicios de sesión registrados.</p>
            ) : data.accesos.map((a) => (
              <p key={a.nombre} className="flex justify-between gap-2 text-xs">
                <span className="truncate font-medium">{a.nombre}</span>
                <span className="text-muted-foreground">{a.ultimo_acceso ? formatDateDMY(a.ultimo_acceso) : '—'}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h3 className="text-sm font-semibold text-[var(--navy)]">Actividad reciente</h3>
          <Link to="/admin/auditoria" className="text-xs font-medium text-[var(--navy)] hover:underline">Ver auditoría</Link>
        </div>
        <ul className="divide-y">
          {data.auditoria.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">Todavía no hay eventos. El registro empieza con el próximo inicio de sesión o cambio.</li>
          ) : data.auditoria.map((r) => (
            <li key={r._id} className="px-4 py-2 text-sm">
              <span className="font-medium">{r.usuario_nombre}</span>
              <span className="text-muted-foreground"> {r.accion} {r.entidad}</span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {r.createdAt ? formatDateDMY(r.createdAt) : ''} · {r.ip}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

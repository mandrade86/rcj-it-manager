import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, UsersRound } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Rrhh = {
  empleados_activos: number
  empleados_inactivos: number
  capacitaciones_en_progreso: number
  evaluaciones_sin_firma: number
}

export function DashboardRrhh() {
  const [data, setData] = useState<Rrhh | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    void fetch('/api/dashboard/paneles')
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo cargar el panel de RRHH')
        return res.json() as Promise<{ rrhh?: Rrhh }>
      })
      .then((j) => { if (!cancel) setData(j.rrhh ?? null) })
      .catch((e) => { if (!cancel) setErr(e instanceof Error ? e.message : 'Error') })
    return () => { cancel = true }
  }, [])

  if (err) return <p className="text-sm text-destructive">{err}</p>
  if (!data) return <p className="text-sm text-muted-foreground">Cargando panel de RRHH…</p>

  const tiles = [
    { label: 'Empleados activos', value: data.empleados_activos, hint: `${data.empleados_inactivos} inactivos`, href: '/maestros/empleados', icon: UsersRound },
    { label: 'Capacitaciones en curso', value: data.capacitaciones_en_progreso, hint: 'Planes que siguen abiertos', href: '/capacitaciones', icon: GraduationCap },
    { label: 'Evaluaciones sin firma', value: data.evaluaciones_sin_firma, hint: 'Falta colaborador, jefe o RRHH', href: '/equipo', icon: UsersRound },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--navy)]">Dashboard de RRHH</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Dotación, capacitaciones y firmas pendientes del talento.
        </p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</CardTitle>
              <t.icon className="size-4 text-[var(--navy)]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-[var(--navy)]">{t.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
              <Link to={t.href} className="mt-2 inline-block text-xs font-medium text-[var(--navy)] hover:underline">Abrir</Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}

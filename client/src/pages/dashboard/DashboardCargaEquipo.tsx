import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateDMY } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CargaTrabajoRow, DashboardPortfolio, TareaCargaDetalle } from '@/types/dashboard'

const COLORS = {
  pendientes: '#94A3B8',
  en_progreso: '#F59E0B',
  bloqueadas: '#C00000',
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-[var(--navy)]">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex justify-between gap-6">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="tabular-nums font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function estadoTone(estado: string, vencida: boolean) {
  if (vencida) return 'text-destructive'
  if (estado === 'Bloqueado') return 'text-destructive'
  if (estado === 'En progreso') return 'text-amber-600'
  return 'text-muted-foreground'
}

export function DashboardCargaEquipo({ portfolio }: { portfolio: DashboardPortfolio }) {
  const carga = portfolio.carga
  const [modo, setModo] = useState<'persona' | 'equipo'>('persona')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = modo === 'persona' ? (carga?.por_persona ?? []) : (carga?.por_equipo ?? [])
  const chartRows = useMemo(() => rows.filter((r) => r.abiertas > 0).slice(0, 12), [rows])

  const selected = rows.find((r) => r.id === selectedId) ?? null
  const detalle: TareaCargaDetalle[] = useMemo(() => {
    if (!carga || !selected) return []
    return carga.detalle.filter((t) =>
      modo === 'persona' ? t.persona_id === selected.id : t.equipo_id === selected.id,
    )
  }, [carga, selected, modo])

  if (!carga || (carga.por_persona.length === 0 && carga.por_equipo.length === 0)) {
    return null
  }

  const chartH = Math.max(220, Math.min(420, chartRows.length * 32 + 40))

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold text-[var(--navy)]">
            Carga de trabajo del equipo
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Tareas abiertas por {modo === 'persona' ? 'persona' : 'equipo'}. Clic en una fila para ver el detalle.
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 font-medium',
              modo === 'persona' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => {
              setModo('persona')
              setSelectedId(null)
            }}
          >
            Por persona
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 font-medium',
              modo === 'equipo' ? 'bg-white text-[var(--navy)] shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => {
              setModo('equipo')
              setSelectedId(null)
            }}
          >
            Por equipo
          </button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div>
          {chartRows.length === 0 ? (
            <p className="flex h-[220px] items-center justify-center text-center text-xs text-muted-foreground">
              No hay tareas abiertas asignadas en este alcance.
            </p>
          ) : (
            <div style={{ height: chartH }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="nombre"
                    width={128}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="pendientes" name="Pendiente" stackId="a" fill={COLORS.pendientes} barSize={16} />
                  <Bar dataKey="en_progreso" name="En progreso" stackId="a" fill={COLORS.en_progreso} barSize={16} />
                  <Bar
                    dataKey="bloqueadas"
                    name="Bloqueada"
                    stackId="a"
                    fill={COLORS.bloqueadas}
                    barSize={16}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: COLORS.pendientes }} /> Pendiente
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: COLORS.en_progreso }} /> En progreso
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: COLORS.bloqueadas }} /> Bloqueada
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="max-h-[280px] overflow-auto rounded-md border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 font-medium">{modo === 'persona' ? 'Persona' : 'Equipo'}</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Abiertas</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Vencidas</th>
                  <th className="px-2 py-2 font-medium tabular-nums">Bloq.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <CargaRowLine
                    key={r.id}
                    row={r}
                    modo={modo}
                    active={selectedId === r.id}
                    onSelect={() => setSelectedId((prev) => (prev === r.id ? null : r.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {selected ? (
            <div className="mt-3 rounded-md border bg-muted/20">
              <p className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--navy)]">
                Abiertas de {selected.nombre} ({detalle.length})
              </p>
              {detalle.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">Sin tareas abiertas en este corte.</p>
              ) : (
                <ul className="max-h-[220px] divide-y overflow-auto">
                  {detalle.slice(0, 20).map((t) => (
                    <li key={t._id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{t.nombre}</p>
                        <Link
                          to={`/proyectos/${encodeURIComponent(t.proyecto_id)}`}
                          className="text-[11px] text-[var(--navy)] hover:underline"
                        >
                          {t.proyecto_nombre}
                        </Link>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn('text-[11px] font-medium', estadoTone(t.estado, t.vencida))}>
                          {t.vencida ? 'Vencida' : t.estado}
                        </p>
                        <p className="text-[11px] tabular-nums text-muted-foreground">
                          {formatDateDMY(t.fecha_fin)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Selecciona una {modo === 'persona' ? 'persona' : 'área'} para ver sus tareas abiertas.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CargaRowLine({
  row,
  modo,
  active,
  onSelect,
}: {
  row: CargaTrabajoRow
  modo: 'persona' | 'equipo'
  active: boolean
  onSelect: () => void
}) {
  return (
    <tr
      className={cn(
        'cursor-pointer border-b last:border-0 hover:bg-muted/40',
        active && 'bg-[var(--blue-lt)]/70',
      )}
      onClick={onSelect}
    >
      <td className="px-3 py-2">
        <span className="font-medium text-[var(--navy)]">{row.nombre}</span>
        {modo === 'persona' && row.extra ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{row.extra}</span>
        ) : null}
      </td>
      <td className="px-2 py-2 tabular-nums">{row.abiertas}</td>
      <td className="px-2 py-2">
        {row.vencidas > 0 ? (
          <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
            {row.vencidas}
          </Badge>
        ) : (
          <span className="tabular-nums text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-2 py-2 tabular-nums text-muted-foreground">{row.bloqueadas}</td>
    </tr>
  )
}

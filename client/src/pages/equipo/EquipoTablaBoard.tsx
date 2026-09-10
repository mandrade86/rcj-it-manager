import { useMemo, useState } from 'react'
import { BadgeCheck, Crown, FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BOARD,
  BoardDistBar,
  BoardGroup,
  BoardPill,
  BoardShell,
  BoardTable,
  BoardTh,
  BoardToolbar,
} from '@/components/board/BoardPrimitives'
import { Avatar } from '@/pages/maestros/OrgChart'
import type { EmpleadoDoc } from '@/types/empleado'
import {
  empleadoEmpresaId,
  empresaNombrePorId,
} from '@/lib/deptoEmpresaFilter'

import type { VacacionesResumenItem } from '@/types/vacacion'

type Props = {
  empleados: EmpleadoDoc[]
  myEmpleadoId?: string | null
  rootIdSet: Set<string>
  vacResumen: Record<string, VacacionesResumenItem>
  deptToEmpresaId: Map<string, string>
  empresasCatalog: Array<{ _id: string; nombre: string }>
  openingPerfil: string | null
  onOpenPerfil: (id: string) => void
  onVacaciones: (id: string) => void
}

export function EquipoTablaBoard({
  empleados,
  myEmpleadoId,
  rootIdSet,
  vacResumen,
  deptToEmpresaId,
  empresasCatalog,
  openingPerfil,
  onOpenPerfil,
  onVacaciones,
}: Props) {
  const [busqueda, setBusqueda] = useState('')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return empleados
    return empleados.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q)
        || e.codigo.toLowerCase().includes(q)
        || (e.puesto ?? '').toLowerCase().includes(q)
        || (typeof e.departamento_id !== 'string' && e.departamento_id?.nombre
          ? e.departamento_id.nombre.toLowerCase().includes(q)
          : (e.departamento ?? '').toLowerCase().includes(q)),
    )
  }, [empleados, busqueda])

  const grupos = useMemo(() => {
    const map = new Map<string, { label: string; color: string; rows: EmpleadoDoc[] }>()
    for (const e of filtrados) {
      const dept =
        e.departamento_id && typeof e.departamento_id !== 'string' ? e.departamento_id : null
      const key = dept?._id ?? (e.departamento?.trim() || 'sin-depto')
      const label = dept?.nombre ?? (e.departamento?.trim() || 'Sin departamento')
      const color = dept?.color ?? BOARD.primary
      const cur = map.get(key) ?? { label, color, rows: [] }
      cur.rows.push(e)
      map.set(key, cur)
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'es'))
  }, [filtrados])

  return (
    <BoardShell>
      <BoardToolbar
        search={busqueda}
        onSearchChange={setBusqueda}
        filterSlot={<span />}
        right={
          <span className="text-xs" style={{ color: BOARD.muted }}>
            {filtrados.length} persona{filtrados.length === 1 ? '' : 's'}
          </span>
        }
      />

      {filtrados.length === 0 ? (
        <p className="rounded-md border border-dashed bg-white px-4 py-8 text-center text-sm" style={{ color: BOARD.muted, borderColor: BOARD.border }}>
          No hay personas para mostrar.
        </p>
      ) : (
        grupos.map(([key, g]) => {
          const activos = g.rows.filter((e) => e.activo).length
          const inactivos = g.rows.length - activos
          return (
            <BoardGroup
              key={key}
              label={g.label}
              color={g.color}
              count={g.rows.length}
              summary={
                <div
                  className="flex items-center gap-4 border-t px-3 py-2 text-[11px]"
                  style={{ backgroundColor: BOARD.bg, borderColor: BOARD.borderSoft, color: BOARD.muted }}
                >
                  <span>{g.rows.length} persona{g.rows.length === 1 ? '' : 's'}</span>
                  <div className="w-36">
                    <BoardDistBar
                      items={[
                        { key: 'Activo', count: activos, color: BOARD.green },
                        { key: 'Inactivo', count: inactivos, color: BOARD.gray },
                      ]}
                    />
                  </div>
                </div>
              }
            >
              <BoardTable minWidth="900px">
                <thead>
                  <tr className="border-b" style={{ borderColor: BOARD.borderSoft }}>
                    <BoardTh className="w-8" />
                    <BoardTh>Persona</BoardTh>
                    <BoardTh>Puesto</BoardTh>
                    <BoardTh>Empresa</BoardTh>
                    <BoardTh>Reporta a</BoardTh>
                    <BoardTh>Vacaciones</BoardTh>
                    <BoardTh>Estado</BoardTh>
                    <BoardTh className="text-right">Acciones</BoardTh>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((e) => {
                    const dept =
                      e.departamento_id && typeof e.departamento_id !== 'string'
                        ? e.departamento_id
                        : null
                    const jefe = e.jefe_id && typeof e.jefe_id !== 'string' ? e.jefe_id : null
                    const v = vacResumen[e._id]
                    return (
                      <tr
                        key={e._id}
                        className="border-b hover:bg-[#f0f3ff]/80"
                        style={{ borderColor: BOARD.borderSoft }}
                      >
                        <td className="px-2 py-1.5">
                          <span className="inline-block h-8 w-1 rounded-sm" style={{ backgroundColor: g.color }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <Avatar nombre={e.nombre} fotoUrl={e.foto_url} bg={dept?.color} size="sm" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-[13px] font-medium" style={{ color: BOARD.text }}>
                                  {e.nombre}
                                </span>
                                {myEmpleadoId === e._id && (
                                  <Badge variant="secondary" className="gap-1 bg-[var(--lime)] py-0 text-[10px] text-[var(--navy)]">
                                    <BadgeCheck className="size-2.5" /> Tú
                                  </Badge>
                                )}
                                {rootIdSet.has(e._id) && myEmpleadoId !== e._id && (
                                  <Badge variant="secondary" className="gap-1 bg-[var(--navy)] py-0 text-[10px] text-white">
                                    <Crown className="size-2.5" /> Directo
                                  </Badge>
                                )}
                              </div>
                              <p className="font-mono text-[10px]" style={{ color: BOARD.muted }}>
                                {e.codigo}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5" style={{ color: BOARD.text }}>
                          {e.puesto || '—'}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: BOARD.muted }}>
                          {empresaNombrePorId(empleadoEmpresaId(e, deptToEmpresaId), empresasCatalog)}
                        </td>
                        <td className="px-2 py-1.5" style={{ color: BOARD.muted }}>
                          {jefe?.nombre ?? '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          {!e.fecha_ingreso ? (
                            <span className="text-[11px] text-amber-700">Sin ingreso</span>
                          ) : v ? (
                            <button
                              type="button"
                              className="text-left text-xs font-semibold tabular-nums hover:underline"
                              style={{
                                color:
                                  v.diasDisponibles <= 0
                                    ? BOARD.red
                                    : v.diasDisponibles >= 10
                                      ? BOARD.green
                                      : BOARD.primary,
                              }}
                              onClick={() => onVacaciones(e._id)}
                            >
                              {v.diasDisponibles} d
                            </button>
                          ) : (
                            <span style={{ color: BOARD.muted }}>—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <BoardPill
                            label={e.activo ? 'Activo' : 'Inactivo'}
                            bg={e.activo ? BOARD.green : BOARD.gray}
                            text={e.activo ? '#fff' : BOARD.text}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={openingPerfil === e._id}
                            onClick={() => onOpenPerfil(e._id)}
                          >
                            <FileText className="size-3.5" />
                            {openingPerfil === e._id ? '…' : 'Perfil'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </BoardTable>
            </BoardGroup>
          )
        })
      )}
    </BoardShell>
  )
}

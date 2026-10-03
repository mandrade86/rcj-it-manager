import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Tarea } from '@/types/tarea'

function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function ProyectoCalendario({
  tareas,
  onSelect,
}: {
  tareas: Tarea[]
  onSelect: (t: Tarea) => void
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  const celdas = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const lead = (start.getDay() + 6) % 7
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const out: Array<Date | null> = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= days; d++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [cursor])

  const porDia = useMemo(() => {
    const map = new Map<string, Tarea[]>()
    for (const t of tareas) {
      const raw = t.fecha_fin || t.fecha_inicio
      if (!raw) continue
      const key = raw.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(t)
      map.set(key, list)
    }
    return map
  }, [tareas])

  const titulo = cursor.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' })
  const hoy = ymd(new Date())

  return (
    <div className="rounded-lg border bg-white">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold capitalize text-[var(--navy)]">{titulo}</h2>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => {
            const n = new Date()
            setCursor(new Date(n.getFullYear(), n.getMonth(), 1))
          }}>
            Hoy
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b text-[11px] text-muted-foreground">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((dia, i) => {
          const key = dia ? ymd(dia) : `e-${i}`
          const items = dia ? porDia.get(key) ?? [] : []
          return (
            <div key={key} className="min-h-24 border-b border-r p-1" style={{ background: dia && key === hoy ? '#eaf5d9' : undefined }}>
              {dia && <p className="text-[11px] text-muted-foreground">{dia.getDate()}</p>}
              {items.map((t) => (
                <button
                  key={t._id}
                  type="button"
                  className="mt-1 block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-white"
                  style={{ background: '#002060' }}
                  title={t.nombre}
                  onClick={() => onSelect(t)}
                >
                  {t.nombre}
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">
        Cada tarea aparece el día de su fecha. Si no tiene fecha, no sale en el calendario.
      </p>
    </div>
  )
}

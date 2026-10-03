import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Trash2, Video } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchMiEquipo, type MiEquipoResponse } from '@/lib/api/empleados'
import type { EmpleadoDoc } from '@/types/empleado'

type Reunion = {
  id: string
  titulo: string
  fecha: string
  hora: string
  duracionMin: number
  invitados: string[]
  teamsUrl?: string
}

function storageKey(userId: string) {
  return `rcj_mi_dia_reuniones_${userId}`
}

function load(userId: string): Reunion[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => x as Record<string, unknown>)
      .filter((x) => typeof x.id === 'string' && typeof x.titulo === 'string')
      .map((x) => ({
        id: x.id as string,
        titulo: x.titulo as string,
        fecha: typeof x.fecha === 'string' ? x.fecha : '',
        hora: typeof x.hora === 'string' ? x.hora : '',
        duracionMin: typeof x.duracionMin === 'number' ? x.duracionMin : 60,
        invitados: Array.isArray(x.invitados) ? x.invitados.filter((n) => typeof n === 'string') : [],
        teamsUrl: typeof x.teamsUrl === 'string' ? x.teamsUrl : undefined,
      }))
  } catch {
    return []
  }
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `r-${Date.now()}`
}

function hoyIso() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function correoDe(e: EmpleadoDoc): string {
  return (e.email ?? '').trim().toLowerCase()
}

function jefeIdDe(e: EmpleadoDoc): string {
  const jefe = e.jefe_id
  if (!jefe) return ''
  return typeof jefe === 'string' ? jefe : jefe._id
}

/** Quien no es admin ve su equipo. Un admin ve toda la empresa: solo se invitan sus reportes directos. */
function miembrosEquipo(data: MiEquipoResponse): EmpleadoDoc[] {
  const self = data.myEmpleadoId
  const conCorreo = (e: EmpleadoDoc) => e._id !== self && correoDe(e).includes('@')
  if (data.scope === 'mio') return data.empleados.filter(conCorreo)
  if (!self) return []
  return data.empleados.filter((e) => jefeIdDe(e) === self && conCorreo(e))
}

function isoTegucigalpa(fecha: string, hora: string, plusMin = 0): string {
  const start = new Date(`${fecha}T${hora}:00-06:00`)
  const when = new Date(start.getTime() + plusMin * 60_000)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Tegucigalpa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(when).map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00-06:00`
}

function teamsMeetingUrl(opts: {
  subject: string
  start: string
  end: string
  attendees: string[]
}): string {
  const q = new URLSearchParams()
  q.set('subject', opts.subject)
  q.set('startTime', opts.start)
  q.set('endTime', opts.end)
  q.set('content', 'Reunión del equipo. Organizada desde RCJ IT Manager.')
  if (opts.attendees.length) q.set('attendees', opts.attendees.join(','))
  return `https://teams.microsoft.com/l/meeting/new?${q.toString()}`
}

export function MiDiaReuniones({ userId }: { userId: string }) {
  const [items, setItems] = useState<Reunion[]>([])
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState(hoyIso)
  const [hora, setHora] = useState('09:00')
  const [duracionMin, setDuracionMin] = useState(60)
  const [equipo, setEquipo] = useState<EmpleadoDoc[]>([])
  const [scope, setScope] = useState<MiEquipoResponse['scope'] | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [equipoMsg, setEquipoMsg] = useState<string | null>(null)

  useEffect(() => {
    setItems(load(userId))
  }, [userId])

  useEffect(() => {
    void fetchMiEquipo()
      .then((data) => {
        const list = miembrosEquipo(data)
        setEquipo(list)
        setScope(data.scope)
        setSel(list.map((e) => e._id))
        if (list.length === 0) {
          setEquipoMsg(
            data.scope === 'all'
              ? 'No hay reportes directos con correo. La reunión se abre en Teams sin invitados.'
              : 'Tu equipo no tiene correos en la ficha. La reunión se abre en Teams sin invitados.',
          )
        }
      })
      .catch(() => setEquipoMsg('No se pudo cargar el equipo. Puedes crear la reunión sin invitados.'))
  }, [])

  function persist(next: Reunion[]) {
    setItems(next)
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(next))
    } catch {
      /* noop */
    }
  }

  const invitados = useMemo(
    () => equipo.filter((e) => sel.includes(e._id)),
    [equipo, sel],
  )

  function crearEnTeams(e: FormEvent) {
    e.preventDefault()
    const text = titulo.trim()
    if (!text || !fecha || !hora) return
    const url = teamsMeetingUrl({
      subject: text,
      start: isoTegucigalpa(fecha, hora),
      end: isoTegucigalpa(fecha, hora, duracionMin),
      attendees: invitados.map(correoDe),
    })
    window.open(url, '_blank', 'noopener,noreferrer')
    persist([
      ...items,
      {
        id: newId(),
        titulo: text,
        fecha,
        hora,
        duracionMin,
        invitados: invitados.map((p) => p.nombre),
        teamsUrl: url,
      },
    ])
    setTitulo('')
  }

  const hoy = hoyIso()
  const visibles = [...items].sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))

  return (
    <section className="overflow-hidden rounded-lg border bg-white">
      <div className="border-b px-3 py-2">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Reuniones</h2>
        <p className="text-xs text-muted-foreground">
          Se abre Teams con la reunión y los invitados de tu equipo. En Teams pulsa Enviar para crear la reunión y mandar la invitación.
          {scope === 'all' ? ' Como administrador, se invitan tus reportes directos, no toda la empresa.' : ''}
        </p>
      </div>
      <form className="space-y-2 border-b px-3 py-2" onSubmit={crearEnTeams}>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Tema de la reunión"
            className="h-8 min-w-[180px] flex-1 text-sm"
          />
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8 w-[150px] text-sm" required />
          <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="h-8 w-[120px] text-sm" required />
          <select
            value={duracionMin}
            onChange={(e) => setDuracionMin(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-white px-2 text-sm"
            aria-label="Duración"
          >
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 hora</option>
            <option value={90}>1 h 30</option>
          </select>
          <Button type="submit" size="sm" className="h-8 gap-1 bg-[var(--lime)] text-[var(--navy)]">
            <Video className="size-3.5" />
            Crear en Teams
          </Button>
        </div>
        {equipoMsg && equipo.length === 0 && (
          <p className="text-[11px] text-muted-foreground">{equipoMsg}</p>
        )}
        {equipo.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded-md border px-2 py-1">
            <p className="py-1 text-[11px] text-muted-foreground">
              Invitados ({invitados.length} de {equipo.length})
            </p>
            {equipo.map((persona) => {
              const on = sel.includes(persona._id)
              return (
                <label key={persona._id} className="flex items-center gap-2 py-0.5 text-xs">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      setSel((prev) => (
                        on ? prev.filter((id) => id !== persona._id) : [...prev, persona._id]
                      ))
                    }}
                  />
                  <span className="truncate">{persona.nombre}</span>
                  <span className="truncate text-muted-foreground">{correoDe(persona)}</span>
                </label>
              )
            })}
          </div>
        )}
      </form>
      {visibles.length === 0 ? (
        <p className="px-3 py-6 text-xs text-muted-foreground">No hay reuniones anotadas.</p>
      ) : (
        visibles.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-[var(--navy)]">{r.titulo}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.fecha === hoy ? 'Hoy' : r.fecha || 'Sin fecha'}
                {r.hora ? ` · ${r.hora}` : ''}
                {r.duracionMin ? ` · ${r.duracionMin} min` : ''}
                {r.invitados.length > 0 ? ` · ${r.invitados.join(', ')}` : ''}
              </p>
            </div>
            {r.teamsUrl && (
              <a
                href={r.teamsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[var(--navy)] underline-offset-2 hover:underline"
              >
                <Video className="size-3.5" />
                Teams
              </a>
            )}
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Quitar reunión"
              onClick={() => persist(items.filter((x) => x.id !== r.id))}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))
      )}
    </section>
  )
}

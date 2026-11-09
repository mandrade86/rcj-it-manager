import { useEffect, useState } from 'react'

export type NotificacionItem = {
  id: string
  tipo: string
  titulo: string
  detalle: string
  fecha: string | null
  href: string
}

const LEIDAS = 'rcj_notif_leidas'
const EVENTO = 'rcj-notif-leidas'
const INTERVALO_MS = 2 * 60 * 1000

export function leerLeidas(): Set<string> {
  try {
    const raw = localStorage.getItem(LEIDAS)
    const arr = raw ? JSON.parse(raw) as string[] : []
    return new Set(arr)
  } catch {
    return new Set()
  }
}

export function guardarLeidas(set: Set<string>) {
  localStorage.setItem(LEIDAS, JSON.stringify([...set].slice(-400)))
  window.dispatchEvent(new Event(EVENTO))
}

export async function fetchNotificaciones(): Promise<NotificacionItem[]> {
  const res = await fetch('/api/dashboard/notificaciones')
  if (!res.ok) throw new Error('No se pudieron cargar las notificaciones')
  const data = (await res.json()) as { items?: NotificacionItem[] }
  return data.items ?? []
}

/** Cantidad de notificaciones no leídas; se refresca periódicamente y al marcar leídas. */
export function useNotificacionesPendientes(activo: boolean): number {
  const [items, setItems] = useState<NotificacionItem[]>([])
  const [leidas, setLeidas] = useState<Set<string>>(() => leerLeidas())

  useEffect(() => {
    if (!activo) return
    let cancel = false
    const cargar = () => {
      void fetchNotificaciones()
        .then((rows) => { if (!cancel) setItems(rows) })
        .catch(() => undefined)
    }
    cargar()
    const id = window.setInterval(cargar, INTERVALO_MS)
    const onLeidas = () => setLeidas(leerLeidas())
    window.addEventListener(EVENTO, onLeidas)
    window.addEventListener('focus', cargar)
    return () => {
      cancel = true
      window.clearInterval(id)
      window.removeEventListener(EVENTO, onLeidas)
      window.removeEventListener('focus', cargar)
    }
  }, [activo])

  return items.filter((it) => !leidas.has(it.id)).length
}

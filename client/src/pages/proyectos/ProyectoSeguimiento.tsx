import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  addProyectoRiesgo,
  deleteProyectoRiesgo,
  fetchProyectoRiesgos,
  saveProyectoSeguimiento,
} from '@/lib/api/proyectos'
import type {
  Proyecto,
  ProyectoDocumento,
  ProyectoHito,
  ProyectoIncidencia,
  ProyectoRiesgoRegistro,
} from '@/types/proyecto'

function fechaInput(v?: string | null) {
  return v ? v.slice(0, 10) : ''
}

export function ProyectoSeguimiento({
  proyecto,
  puedeEditar,
  onSaved,
}: {
  proyecto: Proyecto
  puedeEditar: boolean
  onSaved: () => void | Promise<void>
}) {
  const [hitos, setHitos] = useState<ProyectoHito[]>(proyecto.hitos ?? [])
  const [incidencias, setIncidencias] = useState<ProyectoIncidencia[]>(proyecto.incidencias ?? [])
  const [documentos, setDocumentos] = useState<ProyectoDocumento[]>(proyecto.documentos ?? [])
  const [riesgos, setRiesgos] = useState<ProyectoRiesgoRegistro[]>([])
  const [riesgoTexto, setRiesgoTexto] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setHitos(proyecto.hitos ?? [])
    setIncidencias(proyecto.incidencias ?? [])
    setDocumentos(proyecto.documentos ?? [])
  }, [proyecto])

  useEffect(() => {
    void fetchProyectoRiesgos(proyecto._id).then(setRiesgos).catch(() => setRiesgos([]))
  }, [proyecto._id])

  async function guardar() {
    setSaving(true)
    try {
      await saveProyectoSeguimiento(proyecto._id, { hitos, incidencias, documentos })
      await onSaved()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-3">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Hitos</h2>
        {hitos.map((h, i) => (
          <div key={h._id ?? i} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="checkbox" checked={Boolean(h.hecho)} disabled={!puedeEditar} onChange={(e) => setHitos(hitos.map((x, n) => n === i ? { ...x, hecho: e.target.checked } : x))} />
            <Input value={h.nombre} disabled={!puedeEditar} className="h-8 flex-1" onChange={(e) => setHitos(hitos.map((x, n) => n === i ? { ...x, nombre: e.target.value } : x))} />
            <Input type="date" value={fechaInput(h.fecha)} disabled={!puedeEditar} className="h-8 w-40" onChange={(e) => setHitos(hitos.map((x, n) => n === i ? { ...x, fecha: e.target.value } : x))} />
            {puedeEditar && <button type="button" className="text-xs text-destructive" onClick={() => setHitos(hitos.filter((_, n) => n !== i))}>Quitar</button>}
          </div>
        ))}
        {puedeEditar && (
          <Button type="button" variant="outline" size="sm" className="mt-2 h-8" onClick={() => setHitos([...hitos, { nombre: '', fecha: '', hecho: false }])}>
            Agregar hito
          </Button>
        )}
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Riesgos</h2>
        {riesgos.map((r) => (
          <div key={r._id} className="mt-2 flex items-start justify-between gap-2 text-sm">
            <p><span className="font-medium">{r.nivel}.</span> {r.texto}</p>
            {puedeEditar && (
              <button type="button" className="text-xs text-destructive" onClick={() => void deleteProyectoRiesgo(proyecto._id, r._id).then(() => setRiesgos(riesgos.filter((x) => x._id !== r._id)))}>
                Quitar
              </button>
            )}
          </div>
        ))}
        {puedeEditar && (
          <form className="mt-2 flex gap-2" onSubmit={(e) => {
            e.preventDefault()
            const texto = riesgoTexto.trim()
            if (!texto) return
            void addProyectoRiesgo(proyecto._id, { texto, nivel: 'Medio' }).then((row) => {
              setRiesgos([row, ...riesgos])
              setRiesgoTexto('')
            }).catch((err) => window.alert(err instanceof Error ? err.message : 'No se pudo guardar el riesgo'))
          }}>
            <Input value={riesgoTexto} onChange={(e) => setRiesgoTexto(e.target.value)} placeholder="Describe el riesgo" className="h-8" />
            <Button type="submit" size="sm" className="h-8 bg-[var(--lime)] text-[var(--navy)]">Agregar</Button>
          </form>
        )}
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Incidencias</h2>
        {incidencias.map((inc, i) => (
          <div key={inc._id ?? i} className="mt-2 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <Input value={inc.titulo} disabled={!puedeEditar} className="h-8" onChange={(e) => setIncidencias(incidencias.map((x, n) => n === i ? { ...x, titulo: e.target.value } : x))} />
            <select
              value={inc.estado ?? 'Abierta'}
              disabled={!puedeEditar}
              className="h-8 rounded-md border px-2 text-sm"
              onChange={(e) => setIncidencias(incidencias.map((x, n) => n === i ? { ...x, estado: e.target.value as ProyectoIncidencia['estado'] } : x))}
            >
              <option value="Abierta">Abierta</option>
              <option value="En curso">En curso</option>
              <option value="Cerrada">Cerrada</option>
            </select>
            {puedeEditar && <button type="button" className="text-xs text-destructive" onClick={() => setIncidencias(incidencias.filter((_, n) => n !== i))}>Quitar</button>}
            <Input value={inc.detalle ?? ''} disabled={!puedeEditar} placeholder="Detalle" className="h-8 sm:col-span-3" onChange={(e) => setIncidencias(incidencias.map((x, n) => n === i ? { ...x, detalle: e.target.value } : x))} />
          </div>
        ))}
        {puedeEditar && (
          <Button type="button" variant="outline" size="sm" className="mt-2 h-8" onClick={() => setIncidencias([...incidencias, { titulo: '', detalle: '', estado: 'Abierta' }])}>
            Agregar incidencia
          </Button>
        )}
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="text-sm font-semibold text-[var(--navy)]">Documentos</h2>
        {documentos.map((d, i) => (
          <div key={d._id ?? i} className="mt-2 flex flex-wrap items-center gap-2">
            <Input value={d.nombre} disabled={!puedeEditar} placeholder="Nombre" className="h-8 min-w-40 flex-1" onChange={(e) => setDocumentos(documentos.map((x, n) => n === i ? { ...x, nombre: e.target.value } : x))} />
            <Input value={d.enlace ?? ''} disabled={!puedeEditar} placeholder="Enlace" className="h-8 min-w-40 flex-1" onChange={(e) => setDocumentos(documentos.map((x, n) => n === i ? { ...x, enlace: e.target.value } : x))} />
            {d.enlace && <a href={d.enlace} target="_blank" rel="noreferrer" className="text-xs text-[var(--navy)] underline">Abrir</a>}
            {puedeEditar && <button type="button" className="text-xs text-destructive" onClick={() => setDocumentos(documentos.filter((_, n) => n !== i))}>Quitar</button>}
          </div>
        ))}
        {puedeEditar && (
          <Button type="button" variant="outline" size="sm" className="mt-2 h-8" onClick={() => setDocumentos([...documentos, { nombre: '', enlace: '', notas: '' }])}>
            Agregar documento
          </Button>
        )}
      </section>

      {puedeEditar && (
        <Button type="button" disabled={saving} className="bg-[var(--navy)] text-white" onClick={() => void guardar()}>
          {saving ? 'Guardando…' : 'Guardar hitos, incidencias y documentos'}
        </Button>
      )}
    </div>
  )
}

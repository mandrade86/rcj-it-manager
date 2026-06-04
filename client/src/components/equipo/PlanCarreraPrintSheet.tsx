import { useEffect, useMemo } from 'react'

import type { PlanCarreraItem } from '@/lib/api/planCarrera'
import { formatDateDMY } from '@/lib/format'
import { planCarreraEstadoLabel } from '@/lib/planCarreraLabels'

export type PlanCarreraPrintSheetProps = {
  titulo: string
  subtitulo?: string
  colaboradorNombre?: string
  colaboradorCodigo?: string
  colaboradorPuesto?: string
  periodo_estimado?: string
  responsable_seguimiento?: string
  fecha_inicio?: string
  items: PlanCarreraItem[]
  /** Plantilla maestra: oculta columna de avance por estado real */
  modo?: 'asignado' | 'plantilla'
  onMounted?: () => void
}

function groupItems(items: PlanCarreraItem[]) {
  const map = new Map<string, PlanCarreraItem[]>()
  for (const it of items) {
    const k = it.seccion?.trim() || 'Checklist'
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(it)
  }
  return [...map.entries()]
}

export function PlanCarreraPrintSheet({
  titulo,
  subtitulo,
  colaboradorNombre,
  colaboradorCodigo,
  colaboradorPuesto,
  periodo_estimado,
  responsable_seguimiento,
  fecha_inicio,
  items,
  modo = 'asignado',
  onMounted,
}: PlanCarreraPrintSheetProps) {
  const fecha = formatDateDMY(new Date().toISOString())
  const grouped = useMemo(() => groupItems(items), [items])
  const total = items.length
  const completados = items.filter((i) => i.estado === 'Completado').length
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  useEffect(() => {
    onMounted?.()
  }, [onMounted])

  return (
    <article className="descriptor-print-sheet" aria-label="Plan de carrera para impresión">
      <header className="descriptor-print-header">
        <div className="descriptor-print-brand">
          <p className="descriptor-print-org">RCJ Corporación</p>
          <p className="descriptor-print-sub">Project Management {'&'} Talent</p>
        </div>
        <div className="descriptor-print-form-meta">
          <p className="descriptor-print-form-code">RH-TAL-PC</p>
          <p className="descriptor-print-form-title">Plan de carrera</p>
        </div>
      </header>

      <table className="descriptor-print-ident">
        <tbody>
          {colaboradorNombre && (
            <tr>
              <th>Colaborador</th>
              <td colSpan={modo === 'asignado' ? 1 : 3}>{colaboradorNombre}</td>
              {modo === 'asignado' && (
                <>
                  <th>Código</th>
                  <td className="font-mono">{colaboradorCodigo ?? '—'}</td>
                </>
              )}
            </tr>
          )}
          {colaboradorPuesto && (
            <tr>
              <th>Puesto actual</th>
              <td colSpan={3}>{colaboradorPuesto}</td>
            </tr>
          )}
          <tr>
            <th>Ruta / plantilla</th>
            <td colSpan={modo === 'asignado' ? 1 : 3}>{titulo}</td>
            {modo === 'asignado' && (
              <>
                <th>Fecha impresión</th>
                <td>{fecha}</td>
              </>
            )}
          </tr>
          {subtitulo && (
            <tr>
              <th>Descripción</th>
              <td colSpan={3}>{subtitulo}</td>
            </tr>
          )}
          {(periodo_estimado || responsable_seguimiento || fecha_inicio) && (
            <tr>
              {periodo_estimado && (
                <>
                  <th>Periodo estimado</th>
                  <td>{periodo_estimado}</td>
                </>
              )}
              {responsable_seguimiento && (
                <>
                  <th>Seguimiento</th>
                  <td>{responsable_seguimiento}</td>
                </>
              )}
            </tr>
          )}
          {fecha_inicio && (
            <tr>
              <th>Inicio del plan</th>
              <td colSpan={3}>{formatDateDMY(fecha_inicio)}</td>
            </tr>
          )}
          {modo === 'asignado' && total > 0 && (
            <tr>
              <th>Avance global</th>
              <td colSpan={3}>
                {completados} / {total} ítems completados ({pct}%)
              </td>
            </tr>
          )}
          {modo === 'plantilla' && (
            <tr>
              <th>Fecha impresión</th>
              <td colSpan={3}>{fecha}</td>
            </tr>
          )}
        </tbody>
      </table>

      {grouped.map(([seccion, secItems]) => {
        const secDone = secItems.filter((i) => i.estado === 'Completado').length
        const secPct =
          modo === 'asignado' && secItems.length > 0
            ? Math.round((secDone / secItems.length) * 100)
            : null

        return (
          <section key={seccion} className="descriptor-print-section plan-carrera-print-section">
            <h2 className="descriptor-print-h2">
              {seccion}
              {secPct !== null ? ` - ${secDone}/${secItems.length} (${secPct}%)` : ''}
            </h2>
            <table className="descriptor-print-subtable plan-carrera-print-table">
              <thead>
                <tr>
                  <th className="w-cod">Cód.</th>
                  <th>Requisito</th>
                  <th className="w-tipo">Tipo</th>
                  <th className="w-plazo">Plazo</th>
                  <th className="w-recurso">Recurso</th>
                  {modo === 'asignado' && <th className="w-estado">Estado</th>}
                  <th className="w-notas">Notas</th>
                </tr>
              </thead>
              <tbody>
                {secItems.map((item, idx) => {
                  const done = item.estado === 'Completado'
                  return (
                    <tr key={item._id ?? `${item.codigo}-${idx}`}>
                      <td className="font-mono text-xs">{item.codigo ?? '—'}</td>
                      <td className={done ? 'plan-carrera-print-done' : undefined}>{item.requisito}</td>
                      <td>{item.tipo_requisito ?? '—'}</td>
                      <td>{item.plazo_estimado ?? '—'}</td>
                      <td>{item.recurso ?? '—'}</td>
                      {modo === 'asignado' && (
                        <td>{planCarreraEstadoLabel(item.estado)}</td>
                      )}
                      <td className="text-muted">{item.notas?.trim() ? item.notas : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )
      })}

      <footer className="descriptor-print-footer">
        <div className="descriptor-print-sign">
          <span className="descriptor-print-sign-line" />
          <span>Colaborador</span>
        </div>
        <div className="descriptor-print-sign">
          <span className="descriptor-print-sign-line" />
          <span>Jefe de IT</span>
        </div>
        <div className="descriptor-print-sign">
          <span className="descriptor-print-sign-line" />
          <span>Recursos Humanos</span>
        </div>
      </footer>

      <p className="descriptor-print-footnote">
        Documento generado desde RCJ IT Manager - {fecha}
        {modo === 'plantilla' ? ' - Plantilla maestra (sin avance individual)' : ''}
      </p>
    </article>
  )
}

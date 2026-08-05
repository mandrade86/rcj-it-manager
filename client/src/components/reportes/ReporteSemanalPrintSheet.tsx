import { useEffect } from 'react'

import { formatDateDMY } from '@/lib/format'
import type { ReporteSemanalTareas } from '@/types/tarea'

type Props = {
  data: ReporteSemanalTareas
  tituloAlcance: string
  mensajeEjecutivo: string[] | null
  onMounted?: () => void
}

function AvanceBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 48,
          height: 6,
          borderRadius: 4,
          background: '#E0E4E8',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${w}%`, height: '100%', background: '#70AD47', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{w}%</span>
    </div>
  )
}

export function ReporteSemanalPrintSheet({ data, tituloAlcance, mensajeEjecutivo, onMounted }: Props) {
  useEffect(() => {
    onMounted?.()
  }, [onMounted])

  const r = data.resumen

  return (
    <article className="reporte-print-sheet" aria-label="Resumen ejecutivo de tareas PDF">
      <header className="reporte-print-header">
        <div>
          <p className="reporte-print-org">RCJ Corporación — IT Manager</p>
          <h1 className="reporte-print-title">Resumen ejecutivo de tareas</h1>
          <p className="reporte-print-sub">{data.semana.etiqueta}</p>
          <p className="reporte-print-sub">{tituloAlcance}</p>
        </div>
        <p className="reporte-print-meta">Generado: {formatDateDMY(new Date().toISOString())}</p>
      </header>

      {mensajeEjecutivo && mensajeEjecutivo.length > 0 && (
        <section className="reporte-print-section">
          <h2 className="reporte-print-h2">Mensaje para gerencia</h2>
          <ul className="reporte-print-list">
            {mensajeEjecutivo.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="reporte-print-section">
        <h2 className="reporte-print-h2">Indicadores clave</h2>
        <table className="reporte-print-kpi">
          <tbody>
            <tr>
              <td><strong>{r.total_proyectos}</strong><br /><span>Proyectos</span></td>
              <td><strong>{r.total_tareas}</strong><br /><span>Tareas</span></td>
              <td><strong>{r.completadas}</strong><br /><span>Completadas ({r.pct_completadas}%)</span></td>
              <td><strong>{r.en_progreso}</strong><br /><span>En progreso</span></td>
              <td><strong>{r.bloqueadas}</strong><br /><span>Bloqueadas</span></td>
              <td><strong>{r.vencidas}</strong><br /><span>Vencidas</span></td>
              <td><strong>{r.avance_promedio}%</strong><br /><span>Avance prom.</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      {(data.destacados.bloqueadas.length > 0 || data.destacados.vencidas.length > 0) && (
        <section className="reporte-print-section">
          <h2 className="reporte-print-h2">Atención requerida</h2>
          {data.destacados.bloqueadas.length > 0 && (
            <>
              <p className="reporte-print-label">Tareas bloqueadas</p>
              <ul className="reporte-print-list">
                {data.destacados.bloqueadas.map((t) => (
                  <li key={t.tarea_id}>
                    <strong>{t.tarea_nombre}</strong> — {t.proyecto_nombre} · {t.responsable ?? 'Sin responsable'}
                  </li>
                ))}
              </ul>
            </>
          )}
          {data.destacados.vencidas.length > 0 && (
            <>
              <p className="reporte-print-label">Tareas vencidas</p>
              <ul className="reporte-print-list">
                {data.destacados.vencidas.map((t) => (
                  <li key={t.tarea_id}>
                    <strong>{t.tarea_nombre}</strong> — {t.proyecto_nombre} · Fin {formatDateDMY(t.fecha_fin)} · {t.responsable ?? '—'}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {data.proyectos.map((proy) => (
        <section key={proy.proyecto_id} className="reporte-print-section reporte-print-break">
          <h2 className="reporte-print-h2">
            {proy.proyecto_nombre}{' '}
            <span className="reporte-print-muted">({proy.proyecto_id})</span>
          </h2>
          <p className="reporte-print-sub">
            Avance proyecto: {proy.avance_proyecto}% · Avance tareas: {proy.avance_tareas_promedio}% · {proy.tareas.length} tareas
            {proy.eje ? ` · ${proy.eje}` : ''}
          </p>
          <table className="reporte-print-table">
            <thead>
              <tr>
                <th>Tarea</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Avance</th>
                <th>Inicio</th>
                <th>Fin</th>
              </tr>
            </thead>
            <tbody>
              {proy.tareas.map((t) => (
                <tr key={t._id}>
                  <td>
                    <strong>{t.nombre}</strong>
                    {t.descripcion && (
                      <div className="reporte-print-muted" style={{ fontSize: 9, marginTop: 2 }}>{t.descripcion}</div>
                    )}
                    {t.ultimo_comentario && (
                      <div className="reporte-print-muted" style={{ fontSize: 9, fontStyle: 'italic', marginTop: 2 }}>
                        «{t.ultimo_comentario}»
                      </div>
                    )}
                  </td>
                  <td>{t.responsable ?? '—'}</td>
                  <td>{t.estado}</td>
                  <td><AvanceBar pct={t.porcentaje} /></td>
                  <td>{formatDateDMY(t.fecha_inicio)}</td>
                  <td>{formatDateDMY(t.fecha_fin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="reporte-print-footer">
        <p>Documento generado por RCJ IT Manager — uso interno gerencia</p>
      </footer>
    </article>
  )
}

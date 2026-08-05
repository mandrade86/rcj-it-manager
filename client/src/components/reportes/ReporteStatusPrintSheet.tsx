import { useEffect } from 'react'

import { formatDateDMY } from '@/lib/format'
import type { ReporteStatusProyectos } from '@/types/reporteProyectos'

type Props = {
  data: ReporteStatusProyectos
  tituloAlcance: string
  onMounted?: () => void
}

function AvanceBar({ pct }: { pct: number }) {
  const w = Math.min(100, Math.max(0, pct))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 48, height: 6, borderRadius: 4, background: '#E0E4E8', overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: '#70AD47', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{w}%</span>
    </div>
  )
}

export function ReporteStatusPrintSheet({ data, tituloAlcance, onMounted }: Props) {
  useEffect(() => {
    onMounted?.()
  }, [onMounted])

  const r = data.resumen
  const proyectos = data.departamentos.flatMap((d) =>
    d.proyectos.map((p) => ({ ...p, departamento_nombre: d.departamento_nombre })),
  )

  return (
    <article className="reporte-print-sheet" aria-label="Project Status Report PDF">
      <header className="reporte-print-header">
        <div>
          <p className="reporte-print-org">RCJ Corporación — IT Manager</p>
          <h1 className="reporte-print-title">Project Status Report</h1>
          <p className="reporte-print-sub">{tituloAlcance}</p>
        </div>
        <p className="reporte-print-meta">Generado: {formatDateDMY(data.generado_en)}</p>
      </header>

      <section className="reporte-print-section">
        <h2 className="reporte-print-h2">Resumen del portafolio</h2>
        <table className="reporte-print-kpi">
          <tbody>
            <tr>
              <td><strong>{r.total_proyectos}</strong><br /><span>Proyectos</span></td>
              <td><strong>{r.total_departamentos}</strong><br /><span>Departamentos</span></td>
              <td><strong>{r.activos}</strong><br /><span>Activos</span></td>
              <td><strong>{r.completados}</strong><br /><span>Completados</span></td>
              <td><strong>{r.avance_promedio}%</strong><br /><span>Avance prom.</span></td>
              <td><strong>{r.riesgos_registrados}</strong><br /><span>Riesgos doc.</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      {data.departamentos.map((dept) => (
        <section key={dept.departamento_id ?? 'sin'} className="reporte-print-section">
          <h2 className="reporte-print-h2">{dept.departamento_nombre}</h2>
          <p className="reporte-print-sub">
            {dept.resumen.total_proyectos} proyectos · Avance {dept.resumen.avance_promedio}%
          </p>
        </section>
      ))}

      {proyectos.map((p) => (
        <section key={p.proyecto_id} className="reporte-print-section reporte-print-break">
          <h2 className="reporte-print-h2">
            {p.nombre} <span className="reporte-print-muted">({p.proyecto_id})</span>
          </h2>
          <p className="reporte-print-sub">
            {p.departamento_nombre} · {p.estado} · Prioridad {p.prioridad} · Riesgo {p.riesgo_auto.nivel}
          </p>
          <p className="reporte-print-sub">
            Avance proyecto: {p.porcentaje_avance}% · Avance tareas: {p.avance_tareas_promedio}% ·{' '}
            {p.tareas_completadas}/{p.tareas_total} tareas completadas
            {p.riesgos_registrados > 0 ? ` · ${p.riesgos_registrados} riesgo(s) documentado(s)` : ''}
          </p>
          <p className="reporte-print-muted" style={{ fontSize: 10 }}>{p.riesgo_auto.motivo}</p>

          {p.tareas.length > 0 ? (
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
                {p.tareas.map((t) => (
                  <tr key={t.tarea_id}>
                    <td><strong>{t.nombre}</strong></td>
                    <td>{t.responsable ?? '—'}</td>
                    <td>{t.estado}</td>
                    <td><AvanceBar pct={t.porcentaje} /></td>
                    <td>{formatDateDMY(t.fecha_inicio)}</td>
                    <td>{formatDateDMY(t.fecha_fin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="reporte-print-muted">Sin tareas registradas.</p>
          )}
        </section>
      ))}

      <footer className="reporte-print-footer">
        <p>Documento generado por RCJ IT Manager — uso interno gerencia</p>
      </footer>
    </article>
  )
}

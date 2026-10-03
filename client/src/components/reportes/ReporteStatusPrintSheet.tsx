import { useEffect } from 'react'

import { formatDateDMY } from '@/lib/format'
import type { ReporteStatusProyectoItem, ReporteStatusProyectos } from '@/types/reporteProyectos'

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

function cerrado(p: ReporteStatusProyectoItem): boolean {
  return p.estado === 'Completado' || p.estado === 'Cancelado'
}

function atrasado(p: ReporteStatusProyectoItem): boolean {
  if (cerrado(p) || !p.fecha_fin) return false
  const fin = new Date(p.fecha_fin)
  if (Number.isNaN(fin.getTime())) return false
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return fin.getTime() < hoy.getTime()
}

export function ReporteStatusPrintSheet({ data, tituloAlcance, onMounted }: Props) {
  useEffect(() => {
    onMounted?.()
  }, [onMounted])

  const r = data.resumen
  const proyectos = data.departamentos.flatMap((d) =>
    d.proyectos.map((p) => ({ ...p, departamento_nombre: d.departamento_nombre })),
  )
  const nAtrasados = proyectos.filter(atrasado).length
  const nAlto = proyectos.filter((p) => p.riesgo_auto.nivel === 'Alto').length
  const atencion = proyectos.filter(
    (p) => !cerrado(p) && (atrasado(p) || p.riesgo_auto.nivel === 'Alto' || p.estado === 'Bloqueado'),
  )

  return (
    <article className="reporte-print-sheet" aria-label="Resumen general de proyectos PDF">
      <header className="reporte-print-header">
        <div>
          <p className="reporte-print-org">RCJ Corporación — IT Manager</p>
          <h1 className="reporte-print-title">Resumen general de proyectos</h1>
          <p className="reporte-print-sub">{tituloAlcance}</p>
        </div>
        <p className="reporte-print-meta">Generado: {formatDateDMY(data.generado_en)}</p>
      </header>

      <section className="reporte-print-section">
        <h2 className="reporte-print-h2">Portafolio</h2>
        <table className="reporte-print-kpi">
          <tbody>
            <tr>
              <td><strong>{r.total_proyectos}</strong><br /><span>Proyectos</span></td>
              <td><strong>{r.activos}</strong><br /><span>Activos</span></td>
              <td><strong>{r.completados}</strong><br /><span>Completados</span></td>
              <td><strong>{r.avance_promedio}%</strong><br /><span>Avance prom.</span></td>
              <td><strong>{nAtrasados}</strong><br /><span>Atrasados</span></td>
              <td><strong>{nAlto}</strong><br /><span>Riesgo alto</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="reporte-print-section">
        <h2 className="reporte-print-h2">Todos los proyectos</h2>
        <table className="reporte-print-table">
          <thead>
            <tr>
              <th>Proyecto</th>
              <th>Depto</th>
              <th>Estado</th>
              <th>Avance</th>
              <th>Vence</th>
              <th>Riesgo</th>
              <th>Tareas</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map((p) => (
              <tr key={p.proyecto_id}>
                <td>
                  <strong>{p.nombre}</strong>
                  <div className="reporte-print-muted">{p.propietario || p.responsable || '—'}</div>
                </td>
                <td>{p.departamento_nombre}</td>
                <td>{p.estado}</td>
                <td><AvanceBar pct={p.porcentaje_avance} /></td>
                <td>{formatDateDMY(p.fecha_fin)}</td>
                <td>
                  <strong style={{ color: p.riesgo_auto.color }}>{p.riesgo_auto.nivel}</strong>
                </td>
                <td>
                  {p.tareas_completadas}/{p.tareas_total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {atencion.length > 0 && (
        <section className="reporte-print-section">
          <h2 className="reporte-print-h2">Atención inmediata</h2>
          <table className="reporte-print-table">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Señal</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {atencion.map((p) => (
                <tr key={p.proyecto_id}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>
                    {p.estado === 'Bloqueado' ? 'Bloqueado' : atrasado(p) ? 'Atrasado' : p.riesgo_auto.nivel}
                  </td>
                  <td>{p.riesgo_auto.motivo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="reporte-print-footer">
        <p>Documento generado por RCJ IT Manager — uso interno gerencia</p>
      </footer>
    </article>
  )
}

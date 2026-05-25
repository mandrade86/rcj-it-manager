import { useEffect } from 'react'

import { formatDateDMY } from '@/lib/format'
import type { PerfilPuestoDoc } from '@/types/perfilPuesto'
import { deptFromPerfil } from '@/types/perfilPuesto'

export type DescriptorPuestoPrintSheetProps = {
  perfil: PerfilPuestoDoc
  /** Si se imprime desde el perfil de un colaborador. */
  colaboradorNombre?: string
  colaboradorCodigo?: string
  onMounted?: () => void
}

function ListaSeccion({
  titulo,
  items,
  numero,
}: {
  titulo: string
  items: string[]
  numero: number
}) {
  if (!items.length) return null
  return (
    <section className="descriptor-print-section">
      <h2 className="descriptor-print-h2">
        {numero}. {titulo}
      </h2>
      <ul className="descriptor-print-list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

export function DescriptorPuestoPrintSheet({
  perfil,
  colaboradorNombre,
  colaboradorCodigo,
  onMounted,
}: DescriptorPuestoPrintSheetProps) {
  const dept = deptFromPerfil(perfil)
  const fecha = formatDateDMY(new Date().toISOString())

  useEffect(() => {
    onMounted?.()
  }, [onMounted])

  let sectionNum = 1
  const nextNum = () => sectionNum++

  return (
    <article className="descriptor-print-sheet" aria-label="Descriptor de puesto para impresión">
      <header className="descriptor-print-header">
        <div className="descriptor-print-brand">
          <p className="descriptor-print-org">RCJ Corporación</p>
          <p className="descriptor-print-sub">Project Management {'&'} Talent</p>
        </div>
        <div className="descriptor-print-form-meta">
          <p className="descriptor-print-form-code">RH-F-04</p>
          <p className="descriptor-print-form-title">Descriptor de puesto</p>
        </div>
      </header>

      <table className="descriptor-print-ident">
        <tbody>
          <tr>
            <th>Código de puesto</th>
            <td className="font-mono font-semibold">{perfil.codigo}</td>
            <th>Fecha de impresión</th>
            <td>{fecha}</td>
          </tr>
          <tr>
            <th>Título del puesto</th>
            <td colSpan={3}>{perfil.titulo}</td>
          </tr>
          <tr>
            <th>Reporta a</th>
            <td>{perfil.reporta_a || '—'}</td>
            <th>Departamento</th>
            <td>{dept ? `${dept.nombre} (${dept.codigo})` : '—'}</td>
          </tr>
          <tr>
            <th>Nivel</th>
            <td>{perfil.nivel || '—'}</td>
            <th>Personal a cargo</th>
            <td>{perfil.tiene_personal_a_cargo ? 'Sí' : 'No'}</td>
          </tr>
          {colaboradorNombre ? (
            <tr>
              <th>Colaborador</th>
              <td colSpan={3}>
                {colaboradorNombre}
                {colaboradorCodigo ? ` · ${colaboradorCodigo}` : ''}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {perfil.objetivo ? (
        <section className="descriptor-print-section">
          <h2 className="descriptor-print-h2">{nextNum()}. Objetivo del puesto</h2>
          <p className="descriptor-print-body whitespace-pre-wrap">{perfil.objetivo}</p>
        </section>
      ) : null}

      <ListaSeccion titulo="Requisitos" items={perfil.requisitos ?? []} numero={nextNum()} />
      <ListaSeccion
        titulo="Responsabilidades"
        items={perfil.responsabilidades ?? []}
        numero={nextNum()}
      />
      <ListaSeccion
        titulo="Autoridad y toma de decisiones"
        items={perfil.autoridad ?? []}
        numero={nextNum()}
      />

      {(perfil.educacion || perfil.experiencia) && (
        <section className="descriptor-print-section">
          <h2 className="descriptor-print-h2">{nextNum()}. Educación y experiencia</h2>
          <table className="descriptor-print-subtable">
            <tbody>
              {perfil.educacion ? (
                <tr>
                  <th>Educación requerida</th>
                  <td>{perfil.educacion}</td>
                </tr>
              ) : null}
              {perfil.experiencia ? (
                <tr>
                  <th>Experiencia requerida</th>
                  <td>{perfil.experiencia}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      )}

      {(perfil.competencias?.length ?? 0) > 0 && (
        <section className="descriptor-print-section">
          <h2 className="descriptor-print-h2">{nextNum()}. Competencias clave</h2>
          <p className="descriptor-print-competencias">
            {(perfil.competencias ?? []).join(' · ')}
          </p>
        </section>
      )}

      {perfil.notas ? (
        <section className="descriptor-print-section">
          <h2 className="descriptor-print-h2">{nextNum()}. Notas adicionales</h2>
          <p className="descriptor-print-body whitespace-pre-wrap text-muted">{perfil.notas}</p>
        </section>
      ) : null}

      <footer className="descriptor-print-footer">
        <div className="descriptor-print-sign">
          <span className="descriptor-print-sign-line" />
          <span>Firma jefe de área</span>
        </div>
        <div className="descriptor-print-sign">
          <span className="descriptor-print-sign-line" />
          <span>Firma Recursos Humanos</span>
        </div>
        <div className="descriptor-print-sign">
          <span className="descriptor-print-sign-line" />
          <span>Fecha</span>
        </div>
      </footer>

      <p className="descriptor-print-footnote">
        Documento generado desde RCJ IT Manager. Uso interno — RCJ Corporación.
      </p>
    </article>
  )
}

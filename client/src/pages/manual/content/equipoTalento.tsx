import type { ManualSection } from '@/pages/manual/manualTypes'

export const equipoTalentoSections: ManualSection[] = [
  {
    id: 'equipo',
    title: 'Módulo Equipo',
    content: (
      <>
        <p>Para jefes y coordinadores que supervisan personas del área.</p>
        <ul>
          <li>
            <strong>Organigrama</strong> — dibujo del equipo; los puestos “por contratar” aparecen en gris.
            Clic en una persona abre su perfil.
          </li>
          <li>
            <strong>Tabla</strong> — lista con filtros; desde aquí puede agregar o editar colaboradores si tiene
            permiso.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'perfil',
    title: 'Perfil de una persona',
    content: (
      <p>Al abrir un colaborador verá pestañas: datos generales, descripción del puesto, evaluaciones, plan de
        carrera y capacitaciones. Use las pestañas según lo que necesite revisar o actualizar.</p>
    ),
  },
  {
    id: 'evaluacion',
    title: 'Hacer una evaluación de desempeño',
    content: (
      <ol>
        <li>Entre al perfil del colaborador → pestaña <strong>Evaluaciones</strong>.</li>
        <li>Pulse <strong>Nueva evaluación</strong>.</li>
        <li>Califique cada criterio (No cumple, En desarrollo, Cumple, Supera).</li>
        <li>Agregue comentarios si hace falta.</li>
        <li>Al final elija la decisión: Promover, Continuar o Plan de mejora.</li>
        <li>Marque las firmas cuando cada parte haya revisado.</li>
        <li>Guarde.</li>
      </ol>
    ),
  },
  {
    id: 'carrera',
    title: 'Plan de carrera',
    content: (
      <p>
        Es una lista de requisitos (checklist) para un ascenso, por ejemplo de soporte N2 a coordinador. Marque
        cada ítem como Pendiente, En progreso o Completado y agregue notas. La barra superior muestra el
        progreso total.
      </p>
    ),
  },
  {
    id: 'empleados',
    title: 'Talento → Empleados',
    content: (
      <p>
        Catálogo más amplio de empleados y organigrama corporativo. Use <strong>Equipo</strong> para el día a
        día del área IT; use <strong>Empleados</strong> si su rol es de talento humano o maestros.
      </p>
    ),
  },
]

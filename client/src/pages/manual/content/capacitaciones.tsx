import type { ManualSection } from '@/pages/manual/manualTypes'

export const capacitacionesSections: ManualSection[] = [
  {
    id: 'intro',
    title: 'Qué registra este módulo',
    content: (
      <p>
        Aquí se crean cursos o entrenamientos y se asignan a una o varias personas. Cada persona puede ver los
        suyos en <strong>Mis capacitaciones</strong>.
      </p>
    ),
  },
  {
    id: 'crear',
    title: 'Crear una capacitación',
    content: (
      <ol>
        <li>Menú → <strong>Talento</strong> → <strong>Capacitaciones</strong>.</li>
        <li>Pulse el botón para agregar nueva.</li>
        <li>Complete nombre, proveedor (Udemy, interno, etc.), fechas y costo si aplica.</li>
        <li>Guarde.</li>
      </ol>
    ),
  },
  {
    id: 'asignar',
    title: 'Asignar personas al curso',
    content: (
      <ol>
        <li>Abra la capacitación en la lista.</li>
        <li>Use la opción de <strong>asignar</strong> o editar asignados.</li>
        <li>Marque a los colaboradores que deben tomar el curso.</li>
        <li>Para cada uno puede indicar si está Pendiente, En progreso o Completado.</li>
      </ol>
    ),
  },
  {
    id: 'seguimiento',
    title: 'Dar seguimiento',
    content: (
      <p>
        Revise la tabla de avance o las tarjetas por colaborador. Actualice el estado cuando alguien termine;
        así el Dashboard y los reportes muestran el porcentaje real de cumplimiento formativo.
      </p>
    ),
  },
]

import type { ManualSection } from '@/pages/manual/manualTypes'

export const miEspacioSections: ManualSection[] = [
  {
    id: 'desempeno',
    title: 'Mi desempeño',
    content: (
      <>
        <p>Aquí consulta sus evaluaciones de desempeño sin depender de su jefe para mostrarle papeles.</p>
        <ol>
          <li>
            Clic en sus <strong>iniciales</strong> (arriba a la derecha) → <strong>Mi desempeño</strong>.
          </li>
          <li>Revise fechas, resultados y comentarios de evaluaciones pasadas.</li>
          <li>Si no ve nada, aún no le han registrado una evaluación en el sistema.</li>
        </ol>
      </>
    ),
  },
  {
    id: 'capacitaciones',
    title: 'Mis capacitaciones',
    content: (
      <>
        <p>Cursos o entrenamientos asignados a usted.</p>
        <ol>
          <li>Iniciales (arriba a la derecha) → <strong>Mis capacitaciones</strong>.</li>
          <li>Vea el estado: Pendiente, En progreso o Completado.</li>
          <li>Cuando termine un curso, avise a su coordinador para que actualicen el estado en el sistema.</li>
        </ol>
      </>
    ),
  },
]

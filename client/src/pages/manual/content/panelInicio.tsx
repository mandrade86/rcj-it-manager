import type { ManualSection } from '@/pages/manual/manualTypes'

export const panelInicioSections: ManualSection[] = [
  {
    id: 'resumen',
    title: 'Para qué sirve el Dashboard',
    content: (
      <p>
        Es su “tablero” al entrar: le muestra de un vistazo cómo van los proyectos, las tareas urgentes, los
        indicadores y las capacitaciones, sin tener que abrir cada módulo por separado. Los números se ajustan
        automáticamente según su <strong>rol</strong> y los <strong>departamentos asignados</strong> en
        Maestros → Roles (no verá datos de áreas a las que no tiene acceso).
      </p>
    ),
  },
  {
    id: 'tarjetas',
    title: 'Las tarjetas de arriba',
    content: (
      <ul>
        <li>
          <strong>Proyectos activos</strong> — en marcha dentro de su alcance (personales, de equipo o de
          departamento según su perfil).
        </li>
        <li>
          <strong>Tareas vencidas</strong> — en esos mismos proyectos, con fecha límite pasada.
        </li>
        <li>
          <strong>Cumplimiento KPI</strong> — promedio de los KPIs de sus departamentos (o de toda la
          organización si es administrador).
        </li>
        <li>
          <strong>Capacitaciones</strong> — cursos en progreso según el mismo alcance.
        </li>
      </ul>
    ),
  },
  {
    id: 'graficas',
    title: 'Gráficas y listas',
    content: (
      <ul>
        <li>
          <strong>Avance por fase</strong> — cómo avanza el plan en Fase 1, 2 y 3.
        </li>
        <li>
          <strong>Tareas por vencer</strong> — lo que vence en los próximos 14 días.
        </li>
        <li>
          <strong>Metas del año</strong> — círculos de colores con el % de cumplimiento de cada meta
          estratégica.
        </li>
      </ul>
    ),
  },
  {
    id: 'pendientes',
    title: 'Mi lista de pendientes',
    content: (
      <p>
        Si aparece una lista de tareas personales, úsela como recordatorio diario. Marque lo completado según
        avance en el módulo de Proyectos.
      </p>
    ),
  },
]

import { ManualFlujoProyectosKpiMetas } from '@/pages/manual/ManualFlujoProyectosKpiMetas'
import type { ManualSection } from '@/pages/manual/manualTypes'

export const kpisMetasSections: ManualSection[] = [
  {
    id: 'conceptos',
    title: 'Metas e indicadores, en palabras simples',
    content: (
      <>
        <ul>
          <li>
            <strong>Meta estratégica</strong> — un gran objetivo del año (ejemplo: “Continuidad operativa” o
            “Equipo”).
          </li>
          <li>
            <strong>KPI</strong> — un número o porcentaje que usted mide (ejemplo: “Uptime 99,7%” o
            “Coordinadores contratados: 2”).
          </li>
          <li>
            <strong>Proyecto</strong> — el trabajo que hace el equipo para acercarse a ese indicador.
          </li>
        </ul>
        <p>
          Varios KPIs pueden colgar de una misma meta. Varios proyectos pueden apoyar un mismo KPI si comparten
          categoría y departamento.
        </p>
      </>
    ),
  },
  {
    id: 'configurar-metas',
    title: 'Configurar las metas del departamento',
    content: (
      <ol>
        <li>En <strong>KPIs</strong>, elija un departamento en el filtro.</li>
        <li>Pulse <strong>Registrar metas</strong> (o en Maestros → Departamentos, ícono de diana).</li>
        <li>
          Complete título, objetivo y valor meta. Si el departamento está vacío, puede usar{' '}
          <strong>Usar plantilla de 5 metas (RH)</strong> como punto de partida — no se cargan solas.
        </li>
        <li>Guarde. Luego vincule cada KPI a una meta al crearlo o editarlo.</li>
      </ol>
    ),
  },
  {
    id: 'registrar',
    title: 'Registrar el valor de un indicador',
    content: (
      <ol>
        <li>Menú → <strong>KPIs</strong>.</li>
        <li>Busque el indicador en la lista (puede filtrar por departamento).</li>
        <li>Pulse <strong>Registrar valor</strong>.</li>
        <li>Indique la <strong>fecha</strong>, el <strong>número</strong> medido y, si quiere, una nota breve.</li>
        <li>Guarde. La gráfica de tendencia mostrará el historial.</li>
      </ol>
    ),
  },
  {
    id: 'flujo',
    title: 'Cómo conectar proyecto, KPI y meta',
    content: <ManualFlujoProyectosKpiMetas />,
  },
  {
    id: 'dashboard-meta',
    title: 'Ver el resultado en el Dashboard',
    content: (
      <p>
        En la pantalla de inicio, los círculos de colores son las <strong>metas del año</strong>. Su porcentaje
        sube cuando los KPIs vinculados a esa meta tienen buenos valores o cuando los proyectos enlazados
        avanzan (según cómo esté configurado cada indicador).
      </p>
    ),
  },
]

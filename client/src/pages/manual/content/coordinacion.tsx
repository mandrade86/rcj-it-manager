import type { ManualSection } from '@/pages/manual/manualTypes'

export const coordinacionSections: ManualSection[] = [
  {
    id: 'para-quien',
    title: '¿Para quién es esta guía?',
    content: (
      <p>
        Para jefes de área, coordinadores y personal que configura catálogos antes de que el equipo use
        proyectos e indicadores. Si solo ejecuta tareas, con las guías de Proyectos y KPIs basta.
      </p>
    ),
  },
  {
    id: 'metas',
    title: 'Definir metas del departamento',
    content: (
      <ol>
        <li>Menú → <strong>Estructura</strong> → <strong>Objetivos estratégicos</strong>.</li>
        <li>Seleccione su departamento.</li>
        <li>Revise las metas del año (Continuidad, Modernización, etc.) y ajústelas si su plan cambió.</li>
        <li>Cada meta agrupa indicadores (KPIs) en la pantalla de KPIs.</li>
      </ol>
    ),
  },
  {
    id: 'ejes',
    title: 'Categorías de proyecto (ejes)',
    content: (
      <p>
        En <strong>Estructura → Ejes de proyecto</strong> define las categorías (Infraestructura, Seguridad,
        etc.). Los proyectos y los KPIs deben usar la misma categoría para poder vincularse.
      </p>
    ),
  },
  {
    id: 'departamentos',
    title: 'Departamentos y empresas',
    content: (
      <ul>
        <li>
          <strong>Departamentos</strong> — unidades del grupo; indique si ese departamento maneja gastos TI.
        </li>
        <li>
          <strong>Empresas</strong> — sociedades del holding para asociar proyectos cuando aplique.
        </li>
      </ul>
    ),
  },
  {
    id: 'usuarios',
    title: 'Usuarios y permisos (administradores)',
    content: (
      <ol>
        <li>Menú → <strong>Administración</strong> → <strong>Usuarios</strong>.</li>
        <li>Cree o edite usuarios con correo, rol y departamento.</li>
        <li>En <strong>Roles y permisos</strong> defina qué puede ver cada rol (proyectos, gastos, etc.).</li>
        <li>Si alguien no ve un menú, casi siempre es porque su rol no tiene ese permiso.</li>
      </ol>
    ),
  },
]

import type { ManualSection } from '@/pages/manual/manualTypes'

export const preguntasFrecuentesSections: ManualSection[] = [
  {
    id: 'acceso',
    title: 'No puedo entrar al sistema',
    content: (
      <ul>
        <li>Revise que escribió bien el correo y la contraseña (mayúsculas cuentan).</li>
        <li>Si el mensaje dice usuario inactivo, pida a administración que active su cuenta.</li>
        <li>Si la página no abre, verifique internet o VPN corporativa y avise a TI.</li>
      </ul>
    ),
  },
  {
    id: 'menu-falta',
    title: 'No veo un módulo en el menú',
    content: (
      <p>
        Su rol no incluye ese permiso. Pídale a su jefe o al administrador que revise su rol en{' '}
        <strong>Administración → Roles y permisos</strong>. No es un fallo de la aplicación en su computadora.
      </p>
    ),
  },
  {
    id: 'kpi-proyecto',
    title: 'No encuentro KPI al crear un proyecto',
    content: (
      <ul>
        <li>El proyecto debe tener <strong>departamento</strong> asignado.</li>
        <li>La <strong>categoría (eje)</strong> del proyecto debe ser la misma que la del KPI.</li>
        <li>El KPI debe existir antes en la pantalla <strong>KPIs</strong>.</li>
      </ul>
    ),
  },
  {
    id: 'avance',
    title: 'El avance del proyecto no cambia',
    content: (
      <p>
        Actualice las <strong>tareas</strong> dentro del proyecto (estado o porcentaje). El proyecto no sube
        solo por cambiar el estado general sin tareas.
      </p>
    ),
  },
  {
    id: 'gastos-vacio',
    title: 'Gastos aparece vacío',
    content: (
      <p>
        Pulse <strong>Sincronizar</strong>. Si sigue vacío, TI debe colocar o actualizar el archivo Excel de
        gastos; usted no puede cargarlo desde esta pantalla.
      </p>
    ),
  },
  {
    id: 'ayuda',
    title: '¿A quién pedir ayuda?',
    content: (
      <ul>
        <li>
          <strong>Uso del sistema (proyectos, KPIs, equipo):</strong> su jefe de IT o coordinador.
        </li>
        <li>
          <strong>Usuario, contraseña, permisos:</strong> administrador del sistema.
        </li>
        <li>
          <strong>La página no carga o error técnico:</strong> soporte TI (guía “Soporte técnico” en este centro
          de ayuda).
        </li>
      </ul>
    ),
  },
]

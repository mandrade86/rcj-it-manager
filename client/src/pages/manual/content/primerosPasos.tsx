import type { ManualSection } from '@/pages/manual/manualTypes'

export const primerosPasosSections: ManualSection[] = [
  {
    id: 'que-es',
    title: '¿Qué es esta plataforma?',
    content: (
      <>
        <p>
          Es la herramienta de RCJ para planificar proyectos, dar seguimiento a indicadores (KPIs), cuidar el
          talento del equipo y, cuando corresponde, revisar gastos de tecnología.
        </p>
        <p>
          No necesita instalar nada usted mismo: el área de TI le indica la dirección web (enlace) y su usuario
          de acceso.
        </p>
      </>
    ),
  },
  {
    id: 'entrar',
    title: 'Cómo entrar al sistema',
    content: (
      <ol>
        <li>Abra el enlace que le envió TI (por ejemplo, desde su navegador Chrome o Edge).</li>
        <li>Escriba su <strong>correo corporativo</strong> y su <strong>contraseña</strong>.</li>
        <li>Pulse el botón para iniciar sesión.</li>
        <li>Si olvidó la contraseña, pida al administrador que la restablezca.</li>
      </ol>
    ),
  },
  {
    id: 'menu',
    title: 'El menú de la izquierda',
    content: (
      <>
        <p>A la izquierda verá las secciones disponibles según su rol. Los grupos más comunes son:</p>
        <ul>
          <li>
            <strong>Dashboard</strong> — pantalla de inicio con resumen.
          </li>
          <li>
            <strong>Operación</strong> — Proyectos, Equipo, KPIs y a veces Gastos.
          </li>
          <li>
            <strong>Mi espacio</strong> — su desempeño y sus capacitaciones.
          </li>
          <li>
            <strong>Talento</strong> — empleados, capacitaciones, perfiles (si su rol lo permite).
          </li>
        </ul>
        <p>
          Si no ve una opción, es porque su usuario no tiene permiso; solicítelo a su jefe o a
          administración.
        </p>
        <p>
          La flecha junto al logo <strong>RCJ</strong> permite achicar el menú para ganar espacio en pantalla.
        </p>
      </>
    ),
  },
  {
    id: 'salir',
    title: 'Cerrar sesión',
    content: (
      <p>
        Arriba a la derecha, haga clic en las iniciales de su nombre y elija <strong>Cerrar sesión</strong>.
        Hágalo siempre si usa una computadora compartida.
      </p>
    ),
  },
]

import { FlowDiagram } from '@/components/manual/FlowDiagram'
import type { ManualSection } from '@/pages/manual/manualTypes'

const FLUJO_PROYECTO_TAREAS = `flowchart TD
  A([Nuevo proyecto]) --> B[Completar datos\ny guardar]
  B --> C[Abrir detalle\ndel proyecto]
  C --> D[Agregar tareas]
  D --> E[Actualizar estado\no % de avance]
  E --> F["Avance del proyecto\nse actualiza solo"]
  F --> G{¿Vinculado a un KPI?}
  G -->|Sí| H[Puede reflejarse\nen el indicador]
  G -->|No| I[Solo seguimiento\ninterno del proyecto]`

export const proyectosSections: ManualSection[] = [
  {
    id: 'intro',
    title: 'Qué es un proyecto aquí',
    content: (
      <p>
        Un proyecto es una iniciativa del plan (por ejemplo, “Migración de correo” o “Renovación de
        firewall”). Dentro lleva <strong>tareas</strong> con fechas y responsables. El avance del proyecto se
        calcula según cómo van esas tareas.
      </p>
    ),
  },
  {
    id: 'ver-lista',
    title: 'Ver la lista de proyectos',
    content: (
      <ol>
        <li>En el menú, pulse <strong>Proyectos</strong>.</li>
        <li>Use los filtros arriba (fase, categoría/eje, estado, prioridad) para encontrar el suyo.</li>
        <li>
          La columna <strong>Avance</strong> muestra una barra de progreso; cuanto más llena, más avanzado está.
        </li>
        <li>
          Puede cambiar entre vista <strong>Lista</strong>, <strong>Gantt</strong> (calendario) y{' '}
          <strong>Roadmap</strong> (jerárquico por departamento, fase o meta).
        </li>
      </ol>
    ),
  },
  {
    id: 'crear',
    title: 'Crear un proyecto nuevo',
    content: (
      <ol>
        <li>En Proyectos, pulse <strong>Nuevo proyecto</strong> (o similar).</li>
        <li>Complete al menos: <strong>nombre</strong>, <strong>departamento</strong>, <strong>categoría (eje)</strong> y fechas.</li>
        <li>
          Si el proyecto debe medirse con un indicador, elija el <strong>KPI</strong> en el mismo formulario
          (solo aparecen los de su departamento y categoría).
        </li>
        <li>Guarde. El proyecto aparecerá en la lista y en el Dashboard.</li>
      </ol>
    ),
  },
  {
    id: 'flujo',
    title: 'Flujo visual: del proyecto a las tareas',
    content: (
      <>
        <FlowDiagram
          chart={FLUJO_PROYECTO_TAREAS}
          caption="Primero el proyecto; luego las tareas mueven el avance; el KPI solo entra si lo vinculó antes."
        />
      </>
    ),
  },
  {
    id: 'tareas',
    title: 'Agregar y actualizar tareas',
    content: (
      <ol>
        <li>Haga clic en el nombre del proyecto para abrir el detalle.</li>
        <li>Busque la sección de <strong>Tareas</strong>.</li>
        <li>Use <strong>Agregar tarea</strong> y complete nombre, responsable y fecha de fin.</li>
        <li>
          A medida que avance, cambie el <strong>estado</strong> (Pendiente → En progreso → Completado) o el{' '}
          <strong>% de avance</strong>.
        </li>
        <li>El porcentaje del proyecto se actualiza solo con las tareas.</li>
      </ol>
    ),
  },
  {
    id: 'roadmap',
    title: 'Roadmap, timeline y Gantt',
    content: (
      <>
        <p>
          En la pestaña <strong>Roadmap</strong> hay dos partes: un <strong>timeline por fases</strong> (vista
          ejecutiva) y un <strong>Gantt jerárquico</strong> (detalle por departamento, meta o categoría).
        </p>
        <ul className="mt-2 list-disc pl-5">
          <li>
            <strong>Timeline por fases:</strong> carriles Fase 1, 2 y 3 con hitos del Plan IT; barras por
            proyecto.
          </li>
          <li>
            <strong>Gantt jerárquico:</strong> niveles colapsables; escala en meses o semanas; línea verde =
            hoy.
          </li>
          <li>La pestaña <strong>Gantt</strong> muestra todos los proyectos en lista con la misma escala.</li>
          <li>La parte clara dentro de cada barra es el % de avance.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'gantt',
    title: 'Usar el calendario (Gantt)',
    content: (
      <p>
        La vista Gantt muestra barras en el tiempo. Haga clic en una barra para abrir el proyecto. Sirve para
        presentaciones y para ver si hay muchos proyectos al mismo tiempo.
      </p>
    ),
  },
  {
    id: 'consejos',
    title: 'Consejos prácticos',
    content: (
      <ul>
        <li>Actualice las tareas cada semana para que el Dashboard refleje la realidad.</li>
        <li>Use prioridad <strong>Alta</strong> solo para lo verdaderamente urgente.</li>
        <li>Si no ve KPIs al crear el proyecto, revise que eligió el mismo departamento y categoría que el indicador.</li>
      </ul>
    ),
  },
]

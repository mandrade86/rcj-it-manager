/**
 * Diagramas visuales: Meta → KPI → Proyecto → Tareas.
 */

import { FlowDiagram } from '@/components/manual/FlowDiagram'

const CADENA_DATOS = `flowchart TB
  subgraph DEPT["Departamento"]
    M1["Meta: Continuidad operativa"]
    M2["Meta: Modernización"]
  end

  subgraph KPIs["Indicadores KPI"]
    K1["KPI: Uptime\nPertenece a Continuidad\nCategoría: Infraestructura"]
    K2["KPI: Cobertura EDR\nPertenece a Continuidad\nCategoría: Seguridad"]
  end

  subgraph PROY["Proyectos"]
    P1["Proyecto A\nCategoría: Infraestructura\nVinculado al KPI Uptime"]
    P2["Proyecto B\nCategoría: Seguridad\nVinculado al KPI EDR"]
  end

  subgraph TAR["Tareas"]
    T1["Tareas del Proyecto A"]
    T2["Tareas del Proyecto B"]
  end

  M1 --> K1
  M1 --> K2
  K1 --> P1
  K2 --> P2
  P1 --> T1
  P2 --> T2
  T1 -.->|avanza % del proyecto| P1
  T2 -.->|avanza % del proyecto| P2`

const PASOS_USUARIO = `flowchart LR
  A["1. Definir metas\nEstructura → Objetivos"] --> B["2. Crear KPIs\nDepartamento + meta + categoría"]
  B --> C["3. Crear proyectos\nMismo departamento y categoría"]
  C --> D{"4. Vincular"}
  D --> E["Desde KPI:\nmarcar proyectos"]
  D --> F["Desde Proyecto:\nelegir KPI"]
  E --> G["5. Tareas y avance"]
  F --> G
  G --> H["6. Registrar medición\no avance por proyectos"]
  H --> I["7. Panel de inicio\nver metas"]`

const REGLAS_VINCULO = `flowchart TD
  START([Quiero vincular proyecto y KPI]) --> D1{¿Mismo departamento?}
  D1 -->|No| E1["No permitido:\nindicador de otro departamento"]
  D1 -->|Sí| D2{¿Misma categoría / eje?}
  D2 -->|No| W1["No aparece en la lista:\najuste categoría del proyecto o del KPI"]
  D2 -->|Sí| OK["Vínculo permitido\nProyecto ligado al indicador"]
  OK --> SYNC["Al guardar\nse actualiza en ambos lados"]`

const CALCULO_CUMPLIMIENTO = `flowchart TB
  subgraph META_CALC["Meta en el panel de inicio"]
    MA["Promedio de los %\nde sus indicadores"]
  end

  subgraph KPI_CALC["Cada indicador KPI"]
    direction TB
    R["Mediciones manuales\nfecha y valor"]
    PV["Proyectos vinculados\n% de avance"]
    R --> C1["Cálculo con registros"]
    PV --> C2["Cálculo con avance\nde proyectos"]
    C1 --> PCT["% cumplimiento del KPI"]
    C2 --> PCT
  end

  PCT --> MA
  TAR2["Tareas"] --> PROY2["% del proyecto"] --> PV`

export function ManualFlujoProyectosKpiMetas() {
  return (
    <>
      <p>
        Esta guía explica <strong>cómo se conectan</strong> las piezas del Plan IT en el sistema. Con estos
        pasos puede dejar proyectos alineados a indicadores y metas del departamento.
      </p>

      <h4 className="mt-6 font-semibold text-[var(--navy)]">¿Qué es cada cosa?</h4>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-2 font-medium">Elemento</th>
              <th className="p-2 font-medium">Para qué sirve</th>
              <th className="p-2 font-medium">Dónde se configura</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="p-2 font-medium">Meta estratégica</td>
              <td className="p-2">Objetivo anual del departamento (ej. Continuidad operativa). Agrupa varios KPIs.</td>
              <td className="p-2">Estructura → Objetivos estratégicos</td>
            </tr>
            <tr>
              <td className="p-2 font-medium">KPI</td>
              <td className="p-2">Indicador medible con meta numérica (ej. Uptime ≥ 99,7%). Pertenece a una meta.</td>
              <td className="p-2">KPIs</td>
            </tr>
            <tr>
              <td className="p-2 font-medium">Proyecto</td>
              <td className="p-2">Iniciativa del plan (ej. migración firewall). Puede vincularse a un KPI.</td>
              <td className="p-2">Proyectos</td>
            </tr>
            <tr>
              <td className="p-2 font-medium">Tarea</td>
              <td className="p-2">Actividad dentro del proyecto; su avance alimenta el % del proyecto.</td>
              <td className="p-2">Detalle del proyecto → Tareas</td>
            </tr>
            <tr>
              <td className="p-2 font-medium">Categoría / eje</td>
              <td className="p-2">
                Tipo común (Infraestructura, Seguridad, etc.). Debe coincidir en proyecto y KPI para
                vincularlos.
              </td>
              <td className="p-2">Proyecto y KPI; catálogo en Estructura → Ejes de proyecto</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 className="mt-6 font-semibold text-[var(--navy)]">Cadena de datos (de arriba hacia abajo)</h4>
      <FlowDiagram
        chart={CADENA_DATOS}
        caption="Las metas agrupan indicadores; los indicadores se vinculan a proyectos; las tareas mueven el avance del proyecto."
      />

      <p className="text-sm text-muted-foreground">
        El <strong>panel de inicio</strong> muestra el cumplimiento de cada meta según sus indicadores. Cada KPI
        puede medirse con valores que usted registra o con el avance de los proyectos enlazados.
      </p>

      <h4 className="mt-6 font-semibold text-[var(--navy)]">Flujo recomendado (paso a paso)</h4>
      <FlowDiagram
        chart={PASOS_USUARIO}
        caption="Orden sugerido para configurar metas, indicadores, proyectos y mediciones."
      />

      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm">
        <li>
          <strong>Metas del departamento</strong> — En <em>Estructura → Objetivos estratégicos</em>, revise las
          metas del año. Cada KPI debe colgar de una de ellas.
        </li>
        <li>
          <strong>Crear el KPI</strong> — En <em>KPIs</em>: departamento, meta estratégica, categoría (igual a la
          del proyecto), nombre y meta numérica. Guarde.
        </li>
        <li>
          <strong>Crear el proyecto</strong> — Mismo departamento y misma categoría que el KPI.
        </li>
        <li>
          <strong>Vincular proyecto ↔ KPI</strong> — Desde el KPI (marque proyectos) o desde el proyecto
          (elija el indicador). Si no marca proyectos, el sistema puede enlazar los del mismo departamento y
          categoría al guardar el KPI.
        </li>
        <li>
          <strong>Tareas</strong> — El % del proyecto se calcula con las tareas, no directamente en el KPI.
        </li>
        <li>
          <strong>Medir el KPI</strong> — Registre valores o use el avance de proyectos vinculados, según cómo
          esté configurado el indicador.
        </li>
        <li>
          <strong>Panel de inicio</strong> — Revise los círculos de metas y el resumen general.
        </li>
      </ol>

      <h4 className="mt-6 font-semibold text-[var(--navy)]">Reglas al vincular proyecto e indicador</h4>
      <FlowDiagram
        chart={REGLAS_VINCULO}
        caption="El sistema valida departamento y categoría antes de permitir el vínculo."
      />

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
        <li>El proyecto debe tener <strong>departamento</strong> asignado.</li>
        <li>El KPI debe ser del <strong>mismo departamento</strong>.</li>
        <li>La <strong>categoría</strong> del proyecto y del KPI debe coincidir.</li>
        <li>Las <strong>tareas</strong> no se ligan al KPI directamente: actualizan el avance del proyecto.</li>
      </ul>

      <h4 className="mt-6 font-semibold text-[var(--navy)]">Cómo se calcula el cumplimiento</h4>
      <FlowDiagram
        chart={CALCULO_CUMPLIMIENTO}
        caption="Desde las tareas sube el avance del proyecto; del KPI y sus proyectos sube el % de la meta."
      />

      <div className="mt-4 rounded-md border border-[var(--lime)]/40 bg-[var(--lime-lt)] p-4 text-sm">
        <p className="font-medium text-[var(--navy)]">Ejemplo práctico</p>
        <p className="mt-2">
          Meta <em>Continuidad operativa</em> → KPI <em>Uptime servicios tier A</em> (categoría Infraestructura,
          meta ≥ 99,7%) → Proyecto <em>Renovación cluster</em> vinculado al KPI → Tareas al 40 % de avance → Si
          registra mediciones manuales verá 99,8 %; si el KPI usa proyectos vinculados verá ~40 % hasta terminar
          el proyecto.
        </p>
      </div>

      <h4 className="mt-6 font-semibold text-[var(--navy)]">Errores frecuentes</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>
          <strong>No veo KPIs al editar el proyecto:</strong> falta departamento o la categoría no coincide.
        </li>
        <li>
          <strong>La meta no cambia en el panel de inicio:</strong> sin mediciones, proyectos sin avance, o KPI
          no asignado a esa meta.
        </li>
        <li>
          <strong>Proyecto desvinculado:</strong> al cambiar la categoría del KPI, vuelva a marcar los
          proyectos.
        </li>
      </ul>
    </>
  )
}

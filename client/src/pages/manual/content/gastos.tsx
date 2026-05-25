import type { ManualSection } from '@/pages/manual/manualTypes'

export const gastosSections: ManualSection[] = [
  {
    id: 'que-hace',
    title: 'Qué hace esta pantalla',
    content: (
      <p>
        Muestra los gastos de tecnología (presupuesto) que ya están en un archivo Excel administrado por TI o
        finanzas. <strong>Usted no escribe montos a mano</strong> en esta pantalla: solo consulta y actualiza
        la lectura del archivo.
      </p>
    ),
  },
  {
    id: 'actualizar',
    title: 'Cómo ver datos actualizados',
    content: (
      <ol>
        <li>Finanzas o TI actualiza el archivo Excel de gastos (según el proceso interno de su empresa).</li>
        <li>Entre al menú <strong>Gastos</strong>.</li>
        <li>Pulse el botón <strong>Sincronizar</strong>.</li>
        <li>Espere unos segundos; verán las cifras y gráficas nuevas.</li>
      </ol>
    ),
  },
  {
    id: 'leer',
    title: 'Cómo leer la información',
    content: (
      <ul>
        <li>
          <strong>Total OPEX</strong> — gasto operativo del año.
        </li>
        <li>
          <strong>Meta de reducción</strong> — objetivo de ahorro (por ejemplo −20%).
        </li>
        <li>
          <strong>Gráficas por categoría</strong> — salarios, licencias, nube, etc.
        </li>
        <li>
          <strong>Tabla mensual</strong> — detalle mes a mes.
        </li>
      </ul>
    ),
  },
  {
    id: 'problemas',
    title: 'Si no ve datos',
    content: (
      <p>
        Aparecerá un mensaje indicando que falta el archivo. Contacte a TI o al responsable de presupuesto; no
        es un error de su usuario. Solo quienes tienen permiso de gastos ven este menú.
      </p>
    ),
  },
]

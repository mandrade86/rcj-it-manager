import type { ManualSection } from '@/pages/manual/manualTypes'

/** Solo personal de TI / quien instala o mantiene el servidor local. */
export const soporteTecnicoSections: ManualSection[] = [
  {
    id: 'aviso',
    title: 'Guía para personal de TI',
    content: (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
        Esta sección es para quien instala y mantiene la aplicación en el servidor o PC local. El resto de
        usuarios no necesita leerla.
      </p>
    ),
  },
  {
    id: 'requisitos',
    title: 'Requisitos',
    content: (
      <ul>
        <li>MongoDB Community (puerto 27017), base <strong>rcj_it_manager</strong>.</li>
        <li>Node.js LTS.</li>
        <li>En la carpeta del proyecto: <code className="rounded bg-muted px-1 text-xs">npm install</code> en raíz y en <code className="rounded bg-muted px-1 text-xs">client</code>.</li>
      </ul>
    ),
  },
  {
    id: 'iniciar',
    title: 'Iniciar en desarrollo',
    content: (
      <ol>
        <li>
          <code className="rounded bg-muted px-1 text-xs">npm run dev</code> — levanta API (3001) y Vite (5173).
        </li>
        <li>Proxy: peticiones <code className="rounded bg-muted px-1 text-xs">/api</code> van al backend.</li>
        <li>
          Datos iniciales: <code className="rounded bg-muted px-1 text-xs">npm run seed</code>.
        </li>
      </ol>
    ),
  },
  {
    id: 'gastos-archivo',
    title: 'Archivo de gastos',
    content: (
      <p>
        Excel en <code className="rounded bg-muted px-1 text-xs">data/gastos.xlsx</code> o por departamento{' '}
        <code className="rounded bg-muted px-1 text-xs">data/gastos-{'{codigo}'}.xlsx</code>. El módulo Gastos
        lee con SheetJS al sincronizar.
      </p>
    ),
  },
  {
    id: 'errores',
    title: 'Errores frecuentes (TI)',
    content: (
      <ul>
        <li>
          <strong>ECONNREFUSED MongoDB:</strong> iniciar servicio <code className="rounded bg-muted px-1 text-xs">mongod</code>.
        </li>
        <li>
          <strong>API 401:</strong> revisar JWT y login; usuario en colección Usuario.
        </li>
        <li>
          <strong>Build frontend:</strong>{' '}
          <code className="rounded bg-muted px-1 text-xs">npm run build</code> en client.
        </li>
      </ul>
    ),
  },
]

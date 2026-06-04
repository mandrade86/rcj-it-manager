import { createRoot } from 'react-dom/client'

import {
  PlanCarreraPrintSheet,
  type PlanCarreraPrintSheetProps,
} from '@/components/equipo/PlanCarreraPrintSheet'

export type PrintPlanCarreraOptions = Omit<PlanCarreraPrintSheetProps, 'onMounted'>

/**
 * Abre el cuadro de impresión del navegador con el plan de carrera (checklist).
 */
export function printPlanCarrera(options: PrintPlanCarreraOptions): void {
  const host = document.createElement('div')
  host.className = 'descriptor-print-host'
  host.setAttribute('data-plan-carrera-print', 'true')
  document.body.appendChild(host)

  const root = createRoot(host)

  const cleanup = () => {
    root.unmount()
    host.remove()
    document.body.classList.remove('descriptor-print-active')
  }

  document.body.classList.add('descriptor-print-active')

  const runPrint = () => {
    const after = () => {
      window.removeEventListener('afterprint', after)
      cleanup()
    }
    window.addEventListener('afterprint', after)
    window.print()
    window.setTimeout(() => {
      if (document.body.contains(host)) cleanup()
    }, 60_000)
  }

  root.render(
    <PlanCarreraPrintSheet
      {...options}
      onMounted={() => {
        requestAnimationFrame(() => {
          window.setTimeout(runPrint, 200)
        })
      }}
    />,
  )
}

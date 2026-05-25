import { createRoot } from 'react-dom/client'

import {
  DescriptorPuestoPrintSheet,
  type DescriptorPuestoPrintSheetProps,
} from '@/components/equipo/DescriptorPuestoPrintSheet'

export type PrintDescriptorPuestoOptions = Omit<DescriptorPuestoPrintSheetProps, 'onMounted'>

/**
 * Abre el cuadro de impresión del navegador con el formato RH-F-04.
 */
export function printDescriptorPuesto(options: PrintDescriptorPuestoOptions): void {
  const host = document.createElement('div')
  host.className = 'descriptor-print-host'
  host.setAttribute('data-descriptor-print', 'true')
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
    // Fallback si afterprint no dispara (algunos navegadores)
    window.setTimeout(() => {
      if (document.body.contains(host)) cleanup()
    }, 60_000)
  }

  root.render(
    <DescriptorPuestoPrintSheet
      {...options}
      onMounted={() => {
        requestAnimationFrame(() => {
          window.setTimeout(runPrint, 200)
        })
      }}
    />,
  )
}

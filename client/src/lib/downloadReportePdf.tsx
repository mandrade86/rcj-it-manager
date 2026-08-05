import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { ReactElement } from 'react'

/**
 * Renderiza una hoja de reporte off-screen y la descarga como PDF multipágina.
 */
export async function downloadReportePdf(
  renderSheet: (onMounted: () => void) => ReactElement,
  filename: string,
): Promise<void> {
  const host = document.createElement('div')
  host.className = 'reporte-pdf-host'
  host.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
  document.body.appendChild(host)

  const root = createRoot(host)

  try {
    await new Promise<void>((resolve) => {
      root.render(renderSheet(() => {
        requestAnimationFrame(() => {
          window.setTimeout(resolve, 250)
        })
      }))
    })

    const sheet = host.querySelector('.reporte-print-sheet') as HTMLElement | null
    if (!sheet) throw new Error('No se pudo generar la hoja del reporte')

    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 8
    const contentWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * contentWidth) / canvas.width

    let heightLeft = imgHeight
    let position = margin

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2

    while (heightLeft > 0) {
      pdf.addPage()
      position = margin - (imgHeight - heightLeft)
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight)
      heightLeft -= pageHeight - margin * 2
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
  } finally {
    root.unmount()
    host.remove()
  }
}

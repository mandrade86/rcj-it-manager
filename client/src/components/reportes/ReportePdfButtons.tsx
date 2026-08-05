import { useState } from 'react'
import { Download, Loader2, Printer } from 'lucide-react'
import type { ReactElement } from 'react'

import { Button } from '@/components/ui/button'
import { downloadReportePdf } from '@/lib/downloadReportePdf'

type Props = {
  filename: string
  renderPrintSheet: (onMounted: () => void) => ReactElement
  onPrint?: () => void
  size?: 'default' | 'sm'
  variant?: 'secondary' | 'outline'
}

export function ReportePdfButtons({
  filename,
  renderPrintSheet,
  onPrint,
  size = 'default',
  variant = 'secondary',
}: Props) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadReportePdf(renderPrintSheet, filename)
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant={variant}
        size={size}
        className="gap-2 border-0 bg-white/95 text-[var(--navy)] shadow-lg hover:bg-white"
        disabled={downloading}
        onClick={() => void handleDownload()}
      >
        {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {downloading ? 'Generando PDF…' : 'Descargar PDF'}
      </Button>
      <Button
        type="button"
        variant={variant}
        size={size}
        className="gap-2 border-0 bg-white/90 text-[var(--navy)] shadow-md hover:bg-white"
        onClick={onPrint ?? (() => window.print())}
      >
        <Printer className="size-4" />
        Imprimir
      </Button>
    </div>
  )
}

import { BarChart3, FileText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReporteSemanalTareasPage } from '@/pages/proyectos/ReporteSemanalTareasPage'
import { ReporteStatusProyectosPage } from '@/pages/reportes/ReporteStatusProyectosPage'

export function ReportesPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'status' ? 'status' : 'semanal'

  function setTab(value: string) {
    setParams(value === 'semanal' ? {} : { tab: value }, { replace: true })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--navy)]">
          <FileText className="size-7" />
          Reportería
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reportes ejecutivos para gerencia: avance semanal de tareas y estado general del portafolio.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="print:hidden">
          <TabsTrigger value="semanal" className="gap-1.5">
            <FileText className="size-3.5" />
            Reporte semanal de tareas
          </TabsTrigger>
          <TabsTrigger value="status" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Project Status Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="semanal" className="mt-4">
          <ReporteSemanalTareasPage embedded />
        </TabsContent>
        <TabsContent value="status" className="mt-4">
          <ReporteStatusProyectosPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  )
}

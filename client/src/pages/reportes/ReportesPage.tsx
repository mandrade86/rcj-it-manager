import { BarChart3, FileText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReporteSemanalTareasPage } from '@/pages/proyectos/ReporteSemanalTareasPage'
import { ReporteStatusProyectosPage } from '@/pages/reportes/ReporteStatusProyectosPage'

export function ReportesPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'semanal' ? 'semanal' : 'status'

  function setTab(value: string) {
    setParams(value === 'status' ? {} : { tab: value }, { replace: true })
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--navy)]">
          <FileText className="size-7" />
          Reportería
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Un clic: resumen de todo el portafolio. El detalle semanal de tareas queda en la segunda pestaña.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="print:hidden">
          <TabsTrigger value="status" className="gap-1.5">
            <BarChart3 className="size-3.5" />
            Resumen de proyectos
          </TabsTrigger>
          <TabsTrigger value="semanal" className="gap-1.5">
            <FileText className="size-3.5" />
            Tareas de la semana
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4">
          <ReporteStatusProyectosPage embedded />
        </TabsContent>
        <TabsContent value="semanal" className="mt-4">
          <ReporteSemanalTareasPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { Map, Server, CheckSquare, AlertTriangle, Network } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiReference } from '@/pages/it/components/ApiReference'
import { DevChecklist } from '@/pages/it/components/DevChecklist'
import { InfrastructureMap } from '@/pages/it/components/InfrastructureMap'
import { SystemsMap } from '@/pages/it/components/SystemsMap'
import { TechDebtTracker } from '@/pages/it/components/TechDebtTracker'

export function ArquitecturaDashboardPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--navy)]">Arquitectura IT</h1>
        <p className="text-sm text-muted-foreground">
          SAP B1 Cloud (HANA), Active Directory, portales internos y capa de integración — RCJ Corp.
        </p>
      </div>

      <Tabs defaultValue="sistemas" className="w-full">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/50 p-1">
          <TabsTrigger value="sistemas" className="gap-1.5 text-xs sm:text-sm">
            <Map className="size-4" />
            Mapa de Sistemas
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5 text-xs sm:text-sm">
            <Server className="size-4" />
            API Reference
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5 text-xs sm:text-sm">
            <CheckSquare className="size-4" />
            Dev Checklist
          </TabsTrigger>
          <TabsTrigger value="deuda" className="gap-1.5 text-xs sm:text-sm">
            <AlertTriangle className="size-4" />
            Tech Debt
          </TabsTrigger>
          <TabsTrigger value="infra" className="gap-1.5 text-xs sm:text-sm">
            <Network className="size-4" />
            Integración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sistemas" className="mt-4">
          <SystemsMap />
        </TabsContent>
        <TabsContent value="api" className="mt-4">
          <ApiReference />
        </TabsContent>
        <TabsContent value="checklist" className="mt-4">
          <DevChecklist />
        </TabsContent>
        <TabsContent value="deuda" className="mt-4">
          <TechDebtTracker />
        </TabsContent>
        <TabsContent value="infra" className="mt-4">
          <InfrastructureMap />
        </TabsContent>
      </Tabs>
    </div>
  )
}

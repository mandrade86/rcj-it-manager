import { Navigate, Route, Routes } from 'react-router-dom'

import { HomeRedirect } from '@/components/auth/HomeRedirect'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SoloBiCosteoGuard } from '@/components/auth/SoloBiCosteoGuard'
import { MaestrosRedirect } from '@/components/auth/MaestrosRedirect'
import { MainLayout } from '@/components/layout/MainLayout'
import { CapacitacionesPage } from '@/pages/capacitaciones/CapacitacionesPage'
import { MisCapacitacionesPage } from '@/pages/capacitaciones/MisCapacitacionesPage'
import { ColaboradorPerfilPage } from '@/pages/equipo/ColaboradorPerfilPage'
import { EvaluacionDesarrolloPage } from '@/pages/equipo/EvaluacionDesarrolloPage'
import { EvaluacionKpiPage } from '@/pages/equipo/EvaluacionKpiPage'
import { EquipoPage } from '@/pages/equipo/EquipoPage'
import { MiEvaluacionPage } from '@/pages/equipo/MiEvaluacionPage'
import { ResumenDepartamentoPage } from '@/pages/resumen/ResumenDepartamentoPage'
import { GastosPage } from '@/pages/gastos/GastosPage'
import { KpisPage } from '@/pages/kpis/KpisPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ProyectoDetailPage } from '@/pages/proyectos/ProyectoDetailPage'
import { ProyectoFormPage } from '@/pages/proyectos/ProyectoFormPage'
import { ProyectosPage } from '@/pages/proyectos/ProyectosPage'
import { ReportesPage } from '@/pages/reportes/ReportesPage'
import { DepartamentosPage } from '@/pages/maestros/DepartamentosPage'
import { MetasPage } from '@/pages/maestros/MetasPage'
import { EmpresasPage } from '@/pages/maestros/EmpresasPage'
import { EmpleadosPage } from '@/pages/maestros/EmpleadosPage'
import { PlantillasCarreraPage } from '@/pages/maestros/PlantillasCarreraPage'
import { PerfilesPuestoPage } from '@/pages/maestros/PerfilesPuestoPage'
import { ProveedoresCapacitacionPage } from '@/pages/maestros/ProveedoresCapacitacionPage'
import { RolesPage } from '@/pages/maestros/RolesPage'
import { UsuariosPage } from '@/pages/maestros/UsuariosPage'
import { ArquitecturaDashboardPage } from '@/pages/it/ArquitecturaDashboardPage'
import { CosteoMuestrasPage } from '@/pages/bi/CosteoMuestrasPage'
import { CostosItPage } from '@/pages/gastos-it/CostosItPage'
import { GastosDashboardPage } from '@/pages/gastos-it/GastosDashboardPage'
import { GastosPresupuestoPage } from '@/pages/gastos-it/GastosPresupuestoPage'
import { ManualGuidePage } from '@/pages/manual/ManualGuidePage'
import { ManualHubPage } from '@/pages/manual/ManualHubPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { MiDiaPage } from '@/pages/inicio/MiDiaPage'
import { ConfiguracionPage } from '@/pages/admin/ConfiguracionPage'
import { AuditoriaPage } from '@/pages/admin/AuditoriaPage'
import { NotificacionesPage } from '@/pages/inicio/NotificacionesPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<HomeRedirect />} />

          {/* Mi espacio y ayuda — no disponible para perfil solo BI Costeo */}
          <Route element={<SoloBiCosteoGuard />}>
            <Route path="mi-evaluacion" element={<MiEvaluacionPage />} />
            <Route path="mis-capacitaciones" element={<MisCapacitacionesPage />} />
            <Route path="manual" element={<ManualHubPage />} />
            <Route path="manual/:slug" element={<ManualGuidePage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="dashboard:ver" />}>
            <Route path="mi-dia" element={<MiDiaPage />} />
            <Route path="mis-tareas" element={<MiDiaPage soloPendientes />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="notificaciones" element={<NotificacionesPage />} />
            <Route path="resumen-departamento" element={<ResumenDepartamentoPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="usuarios:editar" />}>
            <Route
              path="admin/configuracion"
              element={<ConfiguracionPage />}
            />
          </Route>
          <Route element={<ProtectedRoute permiso="roles:ver" />}>
            <Route path="admin/auditoria" element={<AuditoriaPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="proyectos:ver" />}>
            <Route path="proyectos/:id" element={<ProyectoDetailPage />} />
            <Route path="proyectos" element={<ProyectosPage />} />
            <Route path="reportes" element={<ReportesPage />} />
            <Route path="proyectos-reporte-semanal" element={<Navigate to="/reportes" replace />} />
          </Route>

          <Route element={<ProtectedRoute permiso="proyectos:editar" />}>
            <Route path="proyectos/nuevo" element={<ProyectoFormPage />} />
            <Route path="proyectos/:id/editar" element={<ProyectoFormPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="equipo:ver" />}>
            <Route path="equipo" element={<EquipoPage />} />
            <Route path="equipo/organigrama" element={<Navigate to="/equipo" replace />} />
            <Route path="equipo/:id/evaluaciones/nueva" element={<EvaluacionDesarrolloPage />} />
            <Route path="equipo/:id/evaluaciones/:evaluacionId" element={<EvaluacionDesarrolloPage />} />
            <Route path="equipo/:id/evaluaciones-kpi/nueva" element={<EvaluacionKpiPage />} />
            <Route path="equipo/:id/evaluaciones-kpi/:evaluacionId" element={<EvaluacionKpiPage />} />
            <Route path="equipo/:id" element={<ColaboradorPerfilPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="capacitaciones:ver" />}>
            <Route path="capacitaciones" element={<CapacitacionesPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="gastos:ver" allowGastosDept />}>
            <Route path="gastos" element={<GastosPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="kpis:ver" />}>
            <Route path="kpis" element={<KpisPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="bi:costeo:ver" />}>
            <Route path="bi/costeo-muestras" element={<CosteoMuestrasPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="it:gastos:ver" />}>
            <Route path="it/gastos-control" element={<CostosItPage />} />
            <Route path="it/gastos-dashboard" element={<GastosDashboardPage />} />
            <Route path="it/gastos-presupuesto" element={<GastosPresupuestoPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="it:arquitectura:ver" />}>
            <Route path="it/arquitectura" element={<ArquitecturaDashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="maestros:ver" />}>
            <Route path="maestros/metas" element={<MetasPage />} />
            <Route path="maestros/ejes-proyecto" element={<Navigate to="/maestros/departamentos" replace />} />
            <Route path="maestros/empresas" element={<EmpresasPage />} />
            <Route path="maestros/planes-carrera" element={<PlantillasCarreraPage />} />
            <Route path="maestros/perfiles-puesto" element={<PerfilesPuestoPage />} />
            <Route path="maestros/proveedores-capacitacion" element={<ProveedoresCapacitacionPage />} />
            <Route path="maestros/departamentos" element={<DepartamentosPage />} />
          </Route>

          <Route element={<ProtectedRoute permiso="empleados:ver" />}>
            <Route path="maestros/empleados" element={<EmpleadosPage />} />
          </Route>

          <Route path="maestros" element={<MaestrosRedirect />} />

          <Route element={<ProtectedRoute permiso="usuarios:ver" />}>
            <Route path="admin/usuarios" element={<UsuariosPage />} />
          </Route>
          <Route element={<ProtectedRoute permiso="roles:ver" />}>
            <Route path="admin/roles" element={<RolesPage />} />
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Route>
      </Route>
    </Routes>
  )
}

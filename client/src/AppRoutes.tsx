import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { MainLayout } from '@/components/layout/MainLayout'
import { CapacitacionesPage } from '@/pages/capacitaciones/CapacitacionesPage'
import { MisCapacitacionesPage } from '@/pages/capacitaciones/MisCapacitacionesPage'
import { ColaboradorPerfilPage } from '@/pages/equipo/ColaboradorPerfilPage'
import { EvaluacionDesarrolloPage } from '@/pages/equipo/EvaluacionDesarrolloPage'
import { EvaluacionKpiPage } from '@/pages/equipo/EvaluacionKpiPage'
import { EquipoPage } from '@/pages/equipo/EquipoPage'
import { MiEvaluacionPage } from '@/pages/equipo/MiEvaluacionPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ResumenDepartamentoPage } from '@/pages/resumen/ResumenDepartamentoPage'
import { GastosPage } from '@/pages/gastos/GastosPage'
import { KpisPage } from '@/pages/kpis/KpisPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ProyectoDetailPage } from '@/pages/proyectos/ProyectoDetailPage'
import { ProyectoFormPage } from '@/pages/proyectos/ProyectoFormPage'
import { ProyectosPage } from '@/pages/proyectos/ProyectosPage'
import { DepartamentosPage } from '@/pages/maestros/DepartamentosPage'
import { MetasPage } from '@/pages/maestros/MetasPage'
import { EjesProyectoPage } from '@/pages/maestros/EjesProyectoPage'
import { EmpresasPage } from '@/pages/maestros/EmpresasPage'
import { EmpleadosPage } from '@/pages/maestros/EmpleadosPage'
import { PlantillasCarreraPage } from '@/pages/maestros/PlantillasCarreraPage'
import { PerfilesPuestoPage } from '@/pages/maestros/PerfilesPuestoPage'
import { ProveedoresCapacitacionPage } from '@/pages/maestros/ProveedoresCapacitacionPage'
import { RolesPage } from '@/pages/maestros/RolesPage'
import { UsuariosPage } from '@/pages/maestros/UsuariosPage'
import { ArquitecturaDashboardPage } from '@/pages/it/ArquitecturaDashboardPage'
import { ManualGuidePage } from '@/pages/manual/ManualGuidePage'
import { ManualHubPage } from '@/pages/manual/ManualHubPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="resumen-departamento" element={<ResumenDepartamentoPage />} />
          <Route path="proyectos/nuevo" element={<ProyectoFormPage />} />
          <Route path="proyectos/:id/editar" element={<ProyectoFormPage />} />
          <Route path="proyectos/:id" element={<ProyectoDetailPage />} />
          <Route path="proyectos" element={<ProyectosPage />} />
          <Route path="equipo" element={<EquipoPage />} />
          <Route path="equipo/organigrama" element={<Navigate to="/equipo" replace />} />
          <Route path="mi-evaluacion" element={<MiEvaluacionPage />} />
          <Route path="equipo/:id/evaluaciones/nueva" element={<EvaluacionDesarrolloPage />} />
          <Route path="equipo/:id/evaluaciones/:evaluacionId" element={<EvaluacionDesarrolloPage />} />
          <Route path="equipo/:id/evaluaciones-kpi/nueva" element={<EvaluacionKpiPage />} />
          <Route path="equipo/:id/evaluaciones-kpi/:evaluacionId" element={<EvaluacionKpiPage />} />
          <Route path="equipo/:id" element={<ColaboradorPerfilPage />} />
          <Route path="capacitaciones" element={<CapacitacionesPage />} />
          <Route path="mis-capacitaciones" element={<MisCapacitacionesPage />} />
          <Route path="gastos" element={<GastosPage />} />
          <Route path="kpis" element={<KpisPage />} />
          <Route path="manual" element={<ManualHubPage />} />
          <Route path="manual/:slug" element={<ManualGuidePage />} />

          <Route element={<ProtectedRoute permiso="it:arquitectura:ver" />}>
            <Route path="it/arquitectura" element={<ArquitecturaDashboardPage />} />
          </Route>

          {/* Maestros */}
          <Route path="maestros" element={<Navigate to="/maestros/departamentos" replace />} />
          <Route path="maestros/departamentos" element={<DepartamentosPage />} />
          <Route path="maestros/metas" element={<MetasPage />} />
          <Route path="maestros/ejes-proyecto" element={<EjesProyectoPage />} />
          <Route path="maestros/empresas" element={<EmpresasPage />} />
          <Route path="maestros/empleados" element={<EmpleadosPage />} />
          <Route path="maestros/planes-carrera" element={<PlantillasCarreraPage />} />
          <Route path="maestros/perfiles-puesto" element={<PerfilesPuestoPage />} />
          <Route path="maestros/proveedores-capacitacion" element={<ProveedoresCapacitacionPage />} />

          {/* Administración (require permiso) */}
          <Route element={<ProtectedRoute permiso="usuarios:ver" />}>
            <Route path="admin/usuarios" element={<UsuariosPage />} />
          </Route>
          <Route element={<ProtectedRoute permiso="roles:ver" />}>
            <Route path="admin/roles" element={<RolesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}

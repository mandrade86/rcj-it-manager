export type PermisoCatalogoItem = {
  clave: string
  descripcion: string
  grupo: string
}

/** Catálogo canónico de permisos (RBAC). No hardcodear roles; sí estas claves. */
export const PERMISOS_CATALOGO: PermisoCatalogoItem[] = [
  { clave: '*', descripcion: 'Administrador — acceso completo', grupo: 'Administración' },

  { clave: 'dashboard:ver', descripcion: 'Ver inicio, Mi día y dashboards', grupo: 'Inicio' },

  { clave: 'proyectos:ver', descripcion: 'Ver proyectos, tareas y reportería (alcance propio)', grupo: 'Project Management' },
  { clave: 'proyectos:ver-todos', descripcion: 'Ver proyectos de todos los departamentos', grupo: 'Project Management' },
  { clave: 'proyectos:editar', descripcion: 'Crear y editar proyectos y tareas', grupo: 'Project Management' },
  { clave: 'proyectos:eliminar', descripcion: 'Eliminar proyectos', grupo: 'Project Management' },
  { clave: 'tareas:asignar', descripcion: 'Asignar o cambiar el responsable de una tarea', grupo: 'Project Management' },
  { clave: 'kpis:ver', descripcion: 'Ver KPIs y metas', grupo: 'Project Management' },
  { clave: 'kpis:editar', descripcion: 'Registrar y editar valores de KPI', grupo: 'Project Management' },
  { clave: 'gastos:ver', descripcion: 'Ver gastos / OPEX del departamento', grupo: 'Project Management' },
  { clave: 'gastos:aprobar', descripcion: 'Aprobar gastos', grupo: 'Project Management' },

  { clave: 'equipo:ver', descripcion: 'Ver equipo, organigrama y evaluaciones', grupo: 'RRHH / Talento' },
  { clave: 'equipo:editar', descripcion: 'Editar colaboradores y evaluaciones', grupo: 'RRHH / Talento' },
  { clave: 'empleados:ver', descripcion: 'Ver empleados', grupo: 'RRHH / Talento' },
  { clave: 'empleados:editar', descripcion: 'Crear y editar empleados', grupo: 'RRHH / Talento' },
  { clave: 'empleados:ver-salario', descripcion: 'Ver salarios de colaboradores', grupo: 'RRHH / Talento' },
  { clave: 'capacitaciones:ver', descripcion: 'Ver capacitaciones (alcance propio)', grupo: 'RRHH / Talento' },
  { clave: 'capacitaciones:ver-todos', descripcion: 'Ver todas las capacitaciones', grupo: 'RRHH / Talento' },
  { clave: 'capacitaciones:editar', descripcion: 'Gestionar capacitaciones y asignaciones', grupo: 'RRHH / Talento' },
  { clave: 'maestros:ver', descripcion: 'Ver catálogos (puestos, planes, proveedores)', grupo: 'RRHH / Talento' },
  { clave: 'maestros:editar', descripcion: 'Editar catálogos de talento y estructura', grupo: 'RRHH / Talento' },

  { clave: 'usuarios:ver', descripcion: 'Ver usuarios de la aplicación', grupo: 'Administración' },
  { clave: 'usuarios:editar', descripcion: 'Crear, editar y desactivar usuarios', grupo: 'Administración' },
  { clave: 'roles:ver', descripcion: 'Ver roles y matriz de permisos', grupo: 'Administración' },
  { clave: 'roles:editar', descripcion: 'Crear y editar roles y permisos', grupo: 'Administración' },

  { clave: 'it:arquitectura:ver', descripcion: 'Ver arquitectura IT', grupo: 'IT / Finanzas' },
  { clave: 'it:arquitectura:editar', descripcion: 'Editar arquitectura IT', grupo: 'IT / Finanzas' },
  { clave: 'it:gastos:ver', descripcion: 'Ver gastos IT (SAP)', grupo: 'IT / Finanzas' },
  { clave: 'it:gastos:config', descripcion: 'Configurar gastos IT / SAP', grupo: 'IT / Finanzas' },
  { clave: 'bi:costeo:ver', descripcion: 'Ver BI Costeo de muestras', grupo: 'IT / Finanzas' },
  { clave: 'bi:costeo:config', descripcion: 'Configurar conexión SAP de costeo', grupo: 'IT / Finanzas' },
]

/** Filas de la matriz visual (módulo → permiso representativo). */
export const MATRIZ_MODULOS: Array<{ id: string; label: string; permiso: string }> = [
  { id: 'inicio', label: 'Inicio / Mi día', permiso: 'dashboard:ver' },
  { id: 'proyectos', label: 'Proyectos', permiso: 'proyectos:ver' },
  { id: 'tareas', label: 'Tareas', permiso: 'proyectos:ver' },
  { id: 'kpis', label: 'KPIs', permiso: 'kpis:ver' },
  { id: 'gastos', label: 'Gastos', permiso: 'gastos:ver' },
  { id: 'empleados', label: 'Empleados', permiso: 'empleados:ver' },
  { id: 'capacitaciones', label: 'Capacitaciones', permiso: 'capacitaciones:ver' },
  { id: 'evaluaciones', label: 'Evaluaciones', permiso: 'equipo:ver' },
  { id: 'roles', label: 'Roles', permiso: 'roles:ver' },
  { id: 'usuarios', label: 'Usuarios', permiso: 'usuarios:ver' },
]

export const PERMISOS_DISPONIBLES = PERMISOS_CATALOGO.map(({ clave, descripcion }) => ({
  clave,
  descripcion,
}))

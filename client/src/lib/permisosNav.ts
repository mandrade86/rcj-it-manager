/** Permisos requeridos por ruta (cualquiera del arreglo basta). */
export const RUTA_PERMISOS: Record<string, string | string[]> = {
  '/': 'dashboard:ver',
  '/resumen-departamento': 'dashboard:ver',
  '/proyectos': 'proyectos:ver',
  '/proyectos/nuevo': 'proyectos:editar',
  '/proyectos-reporte-semanal': 'proyectos:ver',
  '/reportes': 'proyectos:ver',
  '/equipo': 'equipo:ver',
  '/kpis': 'kpis:ver',
  '/gastos': 'gastos:ver',
  '/capacitaciones': 'capacitaciones:ver',
  '/maestros/departamentos': 'maestros:ver',
  '/maestros/metas': 'maestros:ver',
  '/maestros/ejes-proyecto': 'maestros:ver',
  '/maestros/empresas': 'maestros:ver',
  '/maestros/empleados': 'empleados:ver',
  '/maestros/planes-carrera': 'maestros:ver',
  '/maestros/perfiles-puesto': 'maestros:ver',
  '/maestros/proveedores-capacitacion': 'maestros:ver',
  '/admin/usuarios': 'usuarios:ver',
  '/admin/roles': 'roles:ver',
  '/it/arquitectura': 'it:arquitectura:ver',
  '/bi/costeo-muestras': 'bi:costeo:ver',
}

export function permisoParaRuta(pathname: string): string | string[] | undefined {
  if (pathname === '/proyectos/nuevo') return RUTA_PERMISOS['/proyectos/nuevo']
  if (/^\/proyectos\/.+\/editar$/.test(pathname)) return 'proyectos:editar'
  if (/^\/proyectos\/.+/.test(pathname)) return 'proyectos:ver'
  if (/^\/equipo\/.+\/evaluaciones/.test(pathname)) return 'equipo:ver'
  if (/^\/equipo\/.+/.test(pathname)) return 'equipo:ver'
  if (pathname.startsWith('/maestros/')) {
    if (pathname === '/maestros/empleados') return 'empleados:ver'
    return 'maestros:ver'
  }
  return RUTA_PERMISOS[pathname]
}

export function cumplePermiso(
  permiso: string | string[] | undefined,
  hasPermiso: (p: string) => boolean,
  opts?: { llevaGastos?: boolean },
): boolean {
  if (!permiso) return true
  const list = Array.isArray(permiso) ? permiso : [permiso]
  if (list.some(hasPermiso)) return true
  if (opts?.llevaGastos && list.includes('gastos:ver')) return true
  return false
}

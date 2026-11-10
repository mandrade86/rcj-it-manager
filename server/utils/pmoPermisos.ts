/** Acceso al briefing/chat personal del PMO. */
export function puedePmoPersonal(permisos: string[]): boolean {
  return (
    permisos.includes('*') ||
    permisos.includes('pmo:personal') ||
    permisos.includes('proyectos:ver') ||
    permisos.includes('dashboard:ver')
  )
}

/** Vista jefatura / portafolio. */
export function puedePmoPortafolio(permisos: string[]): boolean {
  return (
    permisos.includes('*') ||
    permisos.includes('pmo:portafolio') ||
    permisos.includes('proyectos:ver-todos')
  )
}

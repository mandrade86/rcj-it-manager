import type { PlanCarreraDoc } from '@/lib/api/planCarrera'

export function planCarreraTipoLabel(tipo: PlanCarreraDoc['tipo'] | string): string {
  switch (tipo) {
    case 'N2_a_Coord':
      return 'N2 → Coordinador de Infraestructura'
    case 'Jr_a_Mid':
      return 'Programador Junior → Mid-Senior'
    case 'Mid_a_Senior':
      return 'Programador Mid-Senior → Senior'
    default:
      return tipo
  }
}

export function planCarreraEstadoLabel(estado?: string): string {
  switch (estado) {
    case 'Completado':
      return 'Completado'
    case 'En progreso':
      return 'En progreso'
    case 'Pendiente':
      return 'Pendiente'
    default:
      return estado ?? 'Pendiente'
  }
}

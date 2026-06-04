/** Relaciona el eje del proyecto con el id de meta estratégica del departamento. */
export function metaIdDesdeEjeProyecto(eje: string | null | undefined): string | null {
  const n = (eje ?? '').trim().toLowerCase()
  if (!n) return null
  if (n.includes('continuidad')) return 'continuidad'
  if (n.includes('moderniz')) return 'modernizacion'
  if (n.includes('eficiencia') || n.includes('costo')) return 'eficiencia'
  if (n.includes('gobierno')) return 'gobierno'
  if (n.includes('equipo')) return 'equipo'
  return null
}

export function combinarAvanceMeta(kpiPct: number, planPct: number): number {
  if (kpiPct > 0 && planPct > 0) return Math.round((kpiPct + planPct) / 2)
  if (planPct > 0) return planPct
  return kpiPct
}

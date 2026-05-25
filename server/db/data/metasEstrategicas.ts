/** IDs de las 5 metas estratégicas (compartidos por todos los departamentos). */
export const META_ESTRATEGICA_IDS = [
  'continuidad',
  'modernizacion',
  'eficiencia',
  'gobierno',
  'equipo',
] as const

export type MetaEstrategicaId = (typeof META_ESTRATEGICA_IDS)[number]

export type MetaEstrategicaDef = {
  id: MetaEstrategicaId
  titulo: string
  objetivo: string
  valor_objetivo: string
}

export const METAS_ESTRATEGICAS_DEFAULT: MetaEstrategicaDef[] = [
  {
    id: 'continuidad',
    titulo: 'Continuidad operativa',
    objetivo: 'Uptime tier A, incidentes, EDR, MFA, SLA WAN',
    valor_objetivo: '≥ 99.7%',
  },
  {
    id: 'modernizacion',
    titulo: 'Modernización',
    objetivo: 'MTTFR P1 y resolución N1',
    valor_objetivo: '< 4h / ≥ 70%',
  },
  {
    id: 'eficiencia',
    titulo: 'Eficiencia de costos',
    objetivo: 'Reducción OPEX TI',
    valor_objetivo: '15-25%',
  },
  {
    id: 'gobierno',
    titulo: 'Gobierno IT',
    objetivo: 'Proyectos con caso de negocio',
    valor_objetivo: '100%',
  },
  {
    id: 'equipo',
    titulo: 'Equipo',
    objetivo: 'Coordinadores contratados y talento',
    valor_objetivo: '2',
  },
]

export function isMetaEstrategicaId(v: unknown): v is MetaEstrategicaId {
  return typeof v === 'string' && (META_ESTRATEGICA_IDS as readonly string[]).includes(v)
}

/** Inferencia legacy por nombre (migración y sugerencias sin meta_id). */
export function inferMetaIdFromKpiNombre(nombre: string): MetaEstrategicaId {
  if (/uptime|incidentes críticos|EDR|MFA|SLA enlace/i.test(nombre)) return 'continuidad'
  if (/MTTFR|Resolución N1/i.test(nombre)) return 'modernizacion'
  if (/OPEX|gasto operativo|costos/i.test(nombre)) return 'eficiencia'
  if (/caso de negocio|gobierno/i.test(nombre)) return 'gobierno'
  if (/rotación|vacantes|capacitación|coordinador|talento|contratad/i.test(nombre)) return 'equipo'
  return 'gobierno'
}

export function metasEstrategicasParaDocumento(
  overrides?: Partial<
    Record<
      MetaEstrategicaId,
      { titulo?: string; objetivo?: string; valor_objetivo?: string; tipo_calculo?: string }
    >
  >,
): Array<{
  id: MetaEstrategicaId
  titulo: string
  objetivo: string
  valor_objetivo: string
  tipo_calculo: string
  activa: boolean
}> {
  return METAS_ESTRATEGICAS_DEFAULT.map((m) => {
    const o = overrides?.[m.id]
    return {
      id: m.id,
      titulo: o?.titulo?.trim() || m.titulo,
      objetivo: o?.objetivo?.trim() || m.objetivo,
      valor_objetivo: o?.valor_objetivo?.trim() || m.valor_objetivo,
      tipo_calculo: o?.tipo_calculo?.trim() || 'promedio_kpis',
      activa: true,
    }
  })
}

/**
 * Catálogo de KPIs sugeridos por departamento (solo bajo demanda del usuario).
 * GET /api/kpis/sugerencias y POST /api/kpis/aplicar-sugerencias.
 * No se insertan automáticamente al iniciar el servidor.
 *
 * Match por codigo (IT, RRHH…), ehr_departamento_id o codigo DEP-# (ej. DEP-8 → IT).
 */
export type KpiSugerido = {
  eje: string
  nombre: string
  descripcion?: string
  meta: string
  unidad: string
  frecuencia: 'Mensual' | 'Trimestral' | 'Anual' | 'Único'
}

/** Depto EHR (#) → clave del catálogo legacy (Plan IT / maestros). */
export const EHR_ID_A_CATALOGO_KPI: Record<number, string> = {
  8: 'IT',
  10: 'RRHH',
  9: 'FIN',
  13: 'OPS',
  5: 'COM',
  68: 'LEG',
}

export type DeptoKpiSugeridoRef = {
  codigo?: string | null
  ehr_departamento_id?: number | null
}

export const KPIS_SUGERIDOS_POR_DEPARTAMENTO: Record<string, KpiSugerido[]> = {
  IT: [
    {
      eje: 'Infraestructura',
      nombre: 'Uptime servicios tier A',
      descripcion: 'Disponibilidad mensual de servicios críticos (ERP, AD, correo).',
      meta: '≥ 99.7%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Infraestructura',
      nombre: 'Reducción incidentes críticos',
      descripcion: 'Variación trimestral de incidentes P1 vs trimestre anterior.',
      meta: '-40%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Seguridad',
      nombre: 'Cobertura EDR',
      descripcion: 'Porcentaje de endpoints con agente EDR activo y reportando.',
      meta: '≥ 98%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Seguridad',
      nombre: 'Usuarios con MFA',
      descripcion: 'Usuarios con doble factor obligatorio habilitado.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Red',
      nombre: 'SLA enlace WAN',
      descripcion: 'Estado del acuerdo de nivel de servicio del enlace principal.',
      meta: 'Firmado',
      unidad: 'Estado',
      frecuencia: 'Único',
    },
    {
      eje: 'Software',
      nombre: 'MTTFR tickets P1',
      descripcion: 'Mean Time To First Response en incidentes prioridad 1.',
      meta: '< 4h',
      unidad: 'horas',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Software',
      nombre: 'Resolución N1',
      descripcion: 'Porcentaje de tickets resueltos en primer nivel sin escalar.',
      meta: '≥ 70%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Gobierno IT',
      nombre: 'Proyectos con caso de negocio',
      descripcion: 'Proyectos del portafolio IT con caso de negocio formal aprobado.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Gobierno IT',
      nombre: 'Reducción OPEX TI',
      descripcion: 'Variación del gasto operativo IT vs año anterior.',
      meta: '15-25%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Talento',
      nombre: 'Coordinadores contratados',
      descripcion: 'Coordinadores de Desarrollo e Infraestructura cubiertos.',
      meta: '2',
      unidad: 'personas',
      frecuencia: 'Único',
    },
  ],
  RRHH: [
    {
      eje: 'Talento',
      nombre: 'Rotación de personal',
      descripcion: 'Salidas voluntarias e involuntarias / plantilla promedio.',
      meta: '≤ 12%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Talento',
      nombre: 'Tiempo medio de cobertura de vacantes',
      descripcion: 'Días promedio desde requisición hasta ingreso.',
      meta: '≤ 30',
      unidad: 'días',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Desarrollo',
      nombre: 'Horas de capacitación por colaborador',
      descripcion: 'Horas formales de capacitación por persona en el período.',
      meta: '≥ 20',
      unidad: 'horas',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Desarrollo',
      nombre: 'Cumplimiento del plan de capacitación',
      descripcion: 'Capacitaciones ejecutadas vs planificadas.',
      meta: '≥ 90%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Clima',
      nombre: 'Índice de clima laboral',
      descripcion: 'Resultado de encuesta de clima organizacional.',
      meta: '≥ 80',
      unidad: 'puntos',
      frecuencia: 'Anual',
    },
    {
      eje: 'Clima',
      nombre: 'Cumplimiento de evaluaciones de desempeño',
      descripcion: 'Colaboradores con evaluación firmada en el ciclo.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Anual',
    },
    {
      eje: 'Cumplimiento',
      nombre: 'Cumplimiento de inducciones',
      descripcion: 'Nuevos ingresos con inducción completada antes de 30 días.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Cumplimiento',
      nombre: 'Accidentabilidad laboral',
      descripcion: 'Accidentes con incapacidad / horas trabajadas (índice).',
      meta: '0',
      unidad: 'índice',
      frecuencia: 'Mensual',
    },
  ],
  FIN: [
    {
      eje: 'Resultados',
      nombre: 'EBITDA',
      descripcion: 'Utilidad antes de intereses, impuestos, depreciación y amortización.',
      meta: '≥ presupuesto',
      unidad: 'Lps',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Resultados',
      nombre: 'Margen operativo',
      descripcion: 'Utilidad operativa / ventas netas.',
      meta: '≥ 12%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Capital de trabajo',
      nombre: 'DSO – Días de cobro',
      descripcion: 'Cuentas por cobrar / ventas promedio × días.',
      meta: '≤ 45',
      unidad: 'días',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Capital de trabajo',
      nombre: 'DPO – Días de pago',
      descripcion: 'Cuentas por pagar / compras promedio × días.',
      meta: '≥ 30',
      unidad: 'días',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Capital de trabajo',
      nombre: 'Liquidez corriente',
      descripcion: 'Activo corriente / pasivo corriente.',
      meta: '≥ 1.2',
      unidad: 'razón',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Presupuesto',
      nombre: 'Ejecución presupuestal OPEX',
      descripcion: 'Gasto operativo real vs presupuestado.',
      meta: '95-105%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Presupuesto',
      nombre: 'Ejecución CAPEX',
      descripcion: 'Inversión ejecutada vs autorizada en el período.',
      meta: '≥ 85%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Cumplimiento',
      nombre: 'Cierre contable a tiempo',
      descripcion: 'Cierre mensual entregado dentro de los 5 días hábiles.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
  ],
  OPS: [
    {
      eje: 'Servicio',
      nombre: 'OTIF – Entregas a tiempo y completas',
      descripcion: 'Pedidos entregados a tiempo y completos / pedidos totales.',
      meta: '≥ 95%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Servicio',
      nombre: 'Devoluciones de cliente',
      descripcion: 'Unidades devueltas / unidades despachadas.',
      meta: '≤ 1%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Productividad',
      nombre: 'Productividad por colaborador',
      descripcion: 'Unidades procesadas / hora-hombre.',
      meta: '≥ meta operativa',
      unidad: 'unidades/h',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Costos',
      nombre: 'Costo logístico por unidad',
      descripcion: 'Costo total logístico / unidades movidas.',
      meta: '≤ presupuesto',
      unidad: 'Lps/unidad',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Inventario',
      nombre: 'Rotación de inventario',
      descripcion: 'Costo de ventas / inventario promedio.',
      meta: '≥ 6',
      unidad: 'veces/año',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Inventario',
      nombre: 'Exactitud de inventario',
      descripcion: 'Coincidencia entre conteo físico y sistema.',
      meta: '≥ 98%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Calidad',
      nombre: 'Tasa de errores en despacho',
      descripcion: 'Despachos con error / despachos totales.',
      meta: '≤ 0.5%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
  ],
  COM: [
    {
      eje: 'Ventas',
      nombre: 'Cumplimiento de meta de ventas',
      descripcion: 'Ventas reales / meta del período.',
      meta: '≥ 100%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Ventas',
      nombre: 'Crecimiento de ventas YoY',
      descripcion: 'Variación de ventas vs mismo período año anterior.',
      meta: '≥ 10%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Pipeline',
      nombre: 'Tasa de conversión de leads',
      descripcion: 'Oportunidades ganadas / oportunidades calificadas.',
      meta: '≥ 25%',
      unidad: '%',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Pipeline',
      nombre: 'Cobertura de pipeline',
      descripcion: 'Pipeline activo / cuota del período.',
      meta: '≥ 3x',
      unidad: 'veces',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Clientes',
      nombre: 'Ticket promedio',
      descripcion: 'Venta promedio por cliente / transacción.',
      meta: '↑ vs período anterior',
      unidad: 'Lps',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Clientes',
      nombre: 'Retención de clientes',
      descripcion: 'Clientes activos al cierre / clientes activos al inicio.',
      meta: '≥ 90%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Clientes',
      nombre: 'NPS – Net Promoter Score',
      descripcion: 'Indicador de recomendación neta del cliente.',
      meta: '≥ 50',
      unidad: 'puntos',
      frecuencia: 'Trimestral',
    },
  ],
  LEG: [
    {
      eje: 'Cumplimiento',
      nombre: 'Casos legales resueltos a tiempo',
      descripcion: 'Casos cerrados dentro del plazo / casos cerrados.',
      meta: '≥ 90%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Cumplimiento',
      nombre: 'Contratos vigentes revisados',
      descripcion: 'Contratos con revisión legal al día.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Cumplimiento',
      nombre: 'Auditorías cumplidas sin observaciones críticas',
      descripcion: 'Auditorías cerradas sin hallazgos críticos abiertos.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Anual',
    },
    {
      eje: 'Servicio',
      nombre: 'Tiempo medio de respuesta a consultas legales',
      descripcion: 'Promedio de días para responder consultas internas.',
      meta: '≤ 3',
      unidad: 'días',
      frecuencia: 'Mensual',
    },
    {
      eje: 'Riesgo',
      nombre: 'Exposición a riesgo regulatorio',
      descripcion: 'Sanciones, multas o procesos abiertos en el período.',
      meta: '0',
      unidad: 'casos',
      frecuencia: 'Trimestral',
    },
    {
      eje: 'Riesgo',
      nombre: 'Capacitación en compliance al personal',
      descripcion: 'Colaboradores con curso de compliance vigente.',
      meta: '100%',
      unidad: '%',
      frecuencia: 'Anual',
    },
  ],
}

/** Clave de catálogo (IT, RRHH…) o null si no hay sugerencias para ese departamento. */
export function catalogoClaveParaDepartamento(dept: DeptoKpiSugeridoRef): string | null {
  const cod = String(dept.codigo ?? '').trim().toUpperCase()
  if (cod && KPIS_SUGERIDOS_POR_DEPARTAMENTO[cod]?.length) return cod

  if (dept.ehr_departamento_id != null) {
    const legacy = EHR_ID_A_CATALOGO_KPI[dept.ehr_departamento_id]
    if (legacy && KPIS_SUGERIDOS_POR_DEPARTAMENTO[legacy]?.length) return legacy
  }

  const depMatch = /^DEP-(\d+)$/i.exec(cod)
  if (depMatch) {
    const ehr = Number(depMatch[1])
    const legacy = EHR_ID_A_CATALOGO_KPI[ehr]
    if (legacy && KPIS_SUGERIDOS_POR_DEPARTAMENTO[legacy]?.length) return legacy
  }

  return null
}

export function kpisSugeridosParaDepartamento(dept: DeptoKpiSugeridoRef): KpiSugerido[] {
  const clave = catalogoClaveParaDepartamento(dept)
  if (!clave) return []
  return KPIS_SUGERIDOS_POR_DEPARTAMENTO[clave] ?? []
}

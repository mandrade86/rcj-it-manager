/**
 * Catálogo de empresas y departamentos alineado al EHR RCJ (ID empresa / ID departamento).
 * `ehr_departamento_id` es único en todo el grupo (Depto # en listados de empleados).
 */
export type EmpresaEhrSeed = {
  ehr_empresa_id: number
  codigo: string
  nombre: string
}

export type DepartamentoEhrSeed = {
  ehr_empresa_id: number
  ehr_departamento_id: number
  nombre: string
}

export const EMPRESAS_EHR_SEED: EmpresaEhrSeed[] = [
  { ehr_empresa_id: 1, codigo: 'EHR-1', nombre: 'Tecno Supplier S.A De C.V.' },
  { ehr_empresa_id: 2, codigo: 'EHR-2', nombre: 'CentroQuim Honduras S.A De C.V.' },
  { ehr_empresa_id: 3, codigo: 'EHR-3', nombre: 'Agroindustrial Exports, S.A. de C.V.' },
  { ehr_empresa_id: 4, codigo: 'EHR-4', nombre: 'RCJ Logistics S.A De C.V.' },
  {
    ehr_empresa_id: 5,
    codigo: 'EHR-5',
    nombre: 'Inversiones Agroindustriales de Centroamerica S.A De C.V.',
  },
  { ehr_empresa_id: 6, codigo: 'EHR-6', nombre: 'Tecno República Dominicana S.R.L.' },
  { ehr_empresa_id: 7, codigo: 'EHR-7', nombre: 'Tecno Supplier Distribuidora S.R.L.' },
  { ehr_empresa_id: 8, codigo: 'EHR-8', nombre: 'Tecno Supplier Servicios S.A De C.V.' },
  { ehr_empresa_id: 10, codigo: 'EHR-10', nombre: 'Harmony Care Labs. S.A de C.V' },
  { ehr_empresa_id: 11, codigo: 'EHR-11', nombre: 'Tecno Supplier El Salvador' },
  { ehr_empresa_id: 12, codigo: 'EHR-12', nombre: 'Tecno Supplier Guatemala' },
]

export const DEPARTAMENTOS_EHR_SEED: DepartamentoEhrSeed[] = [
  // Empresa 1 — Tecno Supplier
  { ehr_empresa_id: 1, ehr_departamento_id: 1, nombre: 'Creditos y Cobranzas' },
  { ehr_empresa_id: 1, ehr_departamento_id: 2, nombre: 'Mantenimiento Operaciones' },
  { ehr_empresa_id: 1, ehr_departamento_id: 3, nombre: 'Inventario & despacho' },
  { ehr_empresa_id: 1, ehr_departamento_id: 4, nombre: 'Presidencia' },
  { ehr_empresa_id: 1, ehr_departamento_id: 5, nombre: 'Comercial' },
  { ehr_empresa_id: 1, ehr_departamento_id: 6, nombre: 'Gerencia General' },
  { ehr_empresa_id: 1, ehr_departamento_id: 7, nombre: 'RSE' },
  { ehr_empresa_id: 1, ehr_departamento_id: 8, nombre: 'IT' },
  { ehr_empresa_id: 1, ehr_departamento_id: 9, nombre: 'Finanzas/Administracion' },
  { ehr_empresa_id: 1, ehr_departamento_id: 10, nombre: 'Recursos Humanos' },
  { ehr_empresa_id: 1, ehr_departamento_id: 11, nombre: 'Produccion Sal Industrial' },
  { ehr_empresa_id: 1, ehr_departamento_id: 12, nombre: 'Produccion Quimicos' },
  { ehr_empresa_id: 1, ehr_departamento_id: 13, nombre: 'Administracion de Operaciones' },
  { ehr_empresa_id: 1, ehr_departamento_id: 14, nombre: 'Contabilidad' },
  { ehr_empresa_id: 1, ehr_departamento_id: 15, nombre: 'Mercadeo' },
  { ehr_empresa_id: 1, ehr_departamento_id: 16, nombre: 'Logistica' },
  { ehr_empresa_id: 1, ehr_departamento_id: 17, nombre: 'Compras' },
  { ehr_empresa_id: 1, ehr_departamento_id: 18, nombre: 'Quimicos Industriales' },
  { ehr_empresa_id: 1, ehr_departamento_id: 19, nombre: 'HESQ' },
  { ehr_empresa_id: 1, ehr_departamento_id: 20, nombre: 'IMPEX/Aduana' },
  { ehr_empresa_id: 1, ehr_departamento_id: 21, nombre: 'Producción Bioseguridad' },
  { ehr_empresa_id: 1, ehr_departamento_id: 22, nombre: 'Auditoria' },
  { ehr_empresa_id: 1, ehr_departamento_id: 23, nombre: 'Tesoreria' },
  { ehr_empresa_id: 1, ehr_departamento_id: 46, nombre: 'Produccion Sulfato' },
  { ehr_empresa_id: 1, ehr_departamento_id: 47, nombre: 'Sistemas Integrados de Gestion' },
  { ehr_empresa_id: 1, ehr_departamento_id: 48, nombre: 'Cafeteria' },
  { ehr_empresa_id: 1, ehr_departamento_id: 49, nombre: 'Logistica Barco' },
  { ehr_empresa_id: 1, ehr_departamento_id: 50, nombre: 'Seguridad Industrial' },
  { ehr_empresa_id: 1, ehr_departamento_id: 51, nombre: 'Proyectos' },
  { ehr_empresa_id: 1, ehr_departamento_id: 68, nombre: 'Legal' },
  {
    ehr_empresa_id: 1,
    ehr_departamento_id: 69,
    nombre: 'Division de Quimica Aplicada y Desarrollo Integral',
  },
  { ehr_empresa_id: 1, ehr_departamento_id: 72, nombre: 'Sal Industrial' },
  // Empresa 2 — CentroQuim
  { ehr_empresa_id: 2, ehr_departamento_id: 24, nombre: 'Presidencia' },
  { ehr_empresa_id: 2, ehr_departamento_id: 25, nombre: 'Tesoreria' },
  { ehr_empresa_id: 2, ehr_departamento_id: 26, nombre: 'Creditos y Cobranzas' },
  { ehr_empresa_id: 2, ehr_departamento_id: 27, nombre: 'Inventario & despacho' },
  { ehr_empresa_id: 2, ehr_departamento_id: 28, nombre: 'Comercial' },
  { ehr_empresa_id: 2, ehr_departamento_id: 29, nombre: 'Sal Grado Alimenticio C.domestico' },
  { ehr_empresa_id: 2, ehr_departamento_id: 52, nombre: 'Gerencia General' },
  { ehr_empresa_id: 2, ehr_departamento_id: 82, nombre: 'Mantenimiento Operaciones' },
  // Empresa 3 — Agroindustrial Exports
  { ehr_empresa_id: 3, ehr_departamento_id: 30, nombre: 'Comercial' },
  { ehr_empresa_id: 3, ehr_departamento_id: 31, nombre: 'Administración/Finanzas' },
  // Empresa 4 — RCJ Logistics
  { ehr_empresa_id: 4, ehr_departamento_id: 32, nombre: 'Contabilidad' },
  { ehr_empresa_id: 4, ehr_departamento_id: 33, nombre: 'Mantenimiento Operaciones' },
  { ehr_empresa_id: 4, ehr_departamento_id: 34, nombre: 'Logistica' },
  // Empresa 5 — Inversiones Agroindustriales
  { ehr_empresa_id: 5, ehr_departamento_id: 35, nombre: 'No Definido' },
  { ehr_empresa_id: 5, ehr_departamento_id: 36, nombre: 'Laboratorio Fisico Quimico' },
  { ehr_empresa_id: 5, ehr_departamento_id: 37, nombre: 'Laboratorio Microbiologia' },
  { ehr_empresa_id: 5, ehr_departamento_id: 38, nombre: 'Laboratorio' },
  { ehr_empresa_id: 5, ehr_departamento_id: 39, nombre: 'Comercial' },
  { ehr_empresa_id: 5, ehr_departamento_id: 40, nombre: 'Mantenimiento Operaciones' },
  { ehr_empresa_id: 5, ehr_departamento_id: 41, nombre: 'Recursos Humanos' },
  { ehr_empresa_id: 5, ehr_departamento_id: 42, nombre: 'Produccion Quimicos' },
  { ehr_empresa_id: 5, ehr_departamento_id: 43, nombre: 'HESQ' },
  { ehr_empresa_id: 5, ehr_departamento_id: 44, nombre: 'Quimicos Industriales' },
  { ehr_empresa_id: 5, ehr_departamento_id: 45, nombre: 'Inventario & despacho' },
  // Empresa 6 — Tecno RD
  { ehr_empresa_id: 6, ehr_departamento_id: 53, nombre: 'Logistica e Inventario' },
  { ehr_empresa_id: 6, ehr_departamento_id: 54, nombre: 'Finanza' },
  { ehr_empresa_id: 6, ehr_departamento_id: 55, nombre: 'Produccion' },
  { ehr_empresa_id: 6, ehr_departamento_id: 70, nombre: 'Recursos Humanos' },
  { ehr_empresa_id: 6, ehr_departamento_id: 78, nombre: 'No Definido' },
  // Empresa 7 — Distribuidora
  { ehr_empresa_id: 7, ehr_departamento_id: 56, nombre: 'Comercial' },
  { ehr_empresa_id: 7, ehr_departamento_id: 57, nombre: 'Finanzas' },
  { ehr_empresa_id: 7, ehr_departamento_id: 58, nombre: 'Produccion' },
  { ehr_empresa_id: 7, ehr_departamento_id: 71, nombre: 'Recursos Humanos' },
  { ehr_empresa_id: 7, ehr_departamento_id: 79, nombre: 'Logistica' },
  { ehr_empresa_id: 7, ehr_departamento_id: 81, nombre: 'No Definido' },
  // Empresa 8 — Servicios
  { ehr_empresa_id: 8, ehr_departamento_id: 59, nombre: 'RSE' },
  { ehr_empresa_id: 8, ehr_departamento_id: 60, nombre: 'Cafeteria' },
  { ehr_empresa_id: 8, ehr_departamento_id: 61, nombre: 'Descarga Barco' },
  { ehr_empresa_id: 8, ehr_departamento_id: 62, nombre: 'Inventario & despacho' },
  { ehr_empresa_id: 8, ehr_departamento_id: 63, nombre: 'Logistica' },
  { ehr_empresa_id: 8, ehr_departamento_id: 64, nombre: 'Mantenimiento Operaciones' },
  { ehr_empresa_id: 8, ehr_departamento_id: 65, nombre: 'Produccion Quimicos' },
  { ehr_empresa_id: 8, ehr_departamento_id: 66, nombre: 'Produccion Sal Industrial' },
  { ehr_empresa_id: 8, ehr_departamento_id: 67, nombre: 'Recursos Humanos' },
  // Empresa 10 — Harmony Care Labs
  {
    ehr_empresa_id: 10,
    ehr_departamento_id: 73,
    nombre: 'Division de Quimica Aplicada y Desarrollo Integral',
  },
  { ehr_empresa_id: 10, ehr_departamento_id: 74, nombre: 'Producción Bioseguridad' },
  // Empresa 11 — El Salvador
  { ehr_empresa_id: 11, ehr_departamento_id: 75, nombre: 'Comercial' },
  { ehr_empresa_id: 11, ehr_departamento_id: 76, nombre: 'Finanzas/Administración' },
  { ehr_empresa_id: 11, ehr_departamento_id: 77, nombre: 'Operaciones' },
  // Empresa 12 — Guatemala
  { ehr_empresa_id: 12, ehr_departamento_id: 80, nombre: 'Compras' },
]

/** IDs de departamento que manejan Excel de gastos (configurable en UI después). */
export const EHR_DEPARTAMENTOS_LLEVA_GASTOS_DEFAULT = new Set<number>([8, 9, 31])

/** Ejes de proyecto por defecto sólo para el departamento corporativo de TI (Depto #8). */
export const EJES_PROYECTO_IT_DEFAULT = [
  'Infraestructura',
  'Seguridad',
  'Red',
  'Software',
  'Gobierno IT',
  'Talento',
]

/** Semilla de nombres de eje para el catálogo global (antes derivado del maestro departamentos reducido). */
export const EJES_CATALOGO_SEMILLA_NOMBRES: string[] = [
  ...EJES_PROYECTO_IT_DEFAULT,
  'Clima organizacional',
  'Capacitación',
  'Reclutamiento',
  'Cumplimiento laboral',
  'Presupuesto',
  'OPEX',
  'Cuentas por pagar',
  'Tesorería',
  'Control interno',
  'Procesos',
  'Logística',
  'Inventario',
  'Calidad',
  'Eficiencia operativa',
  'Ventas',
  'Clientes',
  'Marketing',
  'Crecimiento',
  'Servicio al cliente',
  'Contratos',
  'Compliance',
  'Riesgos',
  'Gobierno corporativo',
  'Normativa',
]

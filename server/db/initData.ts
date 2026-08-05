/**
 * Initializes required reference data on every server start.
 * Safe to run multiple times — uses upsert.
 */
import mongoose from 'mongoose'

import { Config } from './models/Config.js'
import { Capacitacion } from './models/Capacitacion.js'
import { Colaborador } from './models/Colaborador.js'
import { Departamento } from './models/Departamento.js'
import { Empresa } from './models/Empresa.js'
import { EjeProyecto } from './models/EjeProyecto.js'
import { DescriptorPuesto } from './models/DescriptorPuesto.js'
import { KPI } from './models/KPI.js'
import { PerfilPuesto } from './models/PerfilPuesto.js'
import { PlantillaCarrera } from './models/PlantillaCarrera.js'
import { Proyecto } from './models/Proyecto.js'
import { ApiEndpointIT } from './models/ApiEndpointIT.js'
import { ChecklistItemIT } from './models/ChecklistItemIT.js'
import { DeudaTecnica } from './models/DeudaTecnica.js'
import { Rol } from './models/Rol.js'
import { SistemaIT } from './models/SistemaIT.js'
import { Usuario } from './models/Usuario.js'
import { Empleado } from './models/Empleado.js'
import {
  DEFAULT_EHR_EMPLOYEE_URL,
  DEFAULT_EHR_LOGIN_URL,
  normalizeEhrLoginUrl,
} from '../utils/ehrAuth.js'
import {
  CONFIG_CLAVE_EHR_COMPANY_LIST,
  DEFAULT_EHR_COMPANY_LIST_URL,
} from '../utils/ehrCompanyList.js'
import {
  DEPARTAMENTOS_EHR_SEED,
  EMPRESAS_EHR_SEED,
  EHR_DEPARTAMENTOS_LLEVA_GASTOS_DEFAULT,
  EJES_CATALOGO_SEMILLA_NOMBRES,
  EJES_PROYECTO_IT_DEFAULT,
} from './data/departamentosEhrCatalog.js'

const DESCRIPTORES_INICIALES = [
  {
    codigo_puesto: 'IT-01',
    titulo: 'Jefe de IT',
    reporta_a: 'Gerencia General',
    objetivo:
      'Dirección estratégica del área de tecnología del grupo RCJ: alinear TI con el negocio, asegurar continuidad operativa, ciberseguridad y eficiencia del gasto.',
    requisitos: [
      'Título universitario en Ingeniería en Sistemas, Informática o afín.',
      'Mínimo 5 años de experiencia en liderazgo de TI en entornos corporativos o multisociedad.',
      'Visión integral de arquitectura, seguridad, operaciones y gestión de proyectos.',
      'Comunicación ejecutiva fluida y capacidad de presentar ante presidencia.',
    ],
    autoridad: [
      'Definir prioridades del portafolio IT y elevar decisiones estratégicas a dirección.',
      'Aprobar políticas operativas de TI.',
      'Coordinar con RRHH en procesos de selección y desarrollo de talento IT.',
      'Autorizar cambios críticos en plataformas y proveedores estratégicos.',
    ],
    responsabilidades: [
      'Planificar y ejecutar el Plan IT Anual alineado a los objetivos del grupo RCJ.',
      'Gestionar el presupuesto OPEX y CAPEX de TI.',
      'Garantizar la continuidad operativa y los niveles de servicio acordados.',
      'Reportar avance de KPIs al equipo directivo.',
      'Supervisar los frentes de Desarrollo e Infraestructura.',
    ],
    educacion: 'Ingeniería en Sistemas, Informática, Ciencias de la Computación o afín. Posgrado deseable.',
    experiencia: 'Mínimo 5 años en roles de liderazgo TI. Experiencia en grupos empresariales valorada.',
    competencias: [
      'Liderazgo estratégico',
      'Pensamiento analítico',
      'Gestión del cambio',
      'Comunicación ejecutiva',
      'Orientación a resultados',
    ],
    notas: '',
  },
  {
    codigo_puesto: 'IT-02',
    titulo: 'Coordinador de Desarrollo IT',
    reporta_a: 'Jefe de IT',
    objetivo:
      'Liderar el frente de desarrollo de software: calidad, integraciones, prácticas de ingeniería y entrega alineada al plan corporativo.',
    requisitos: [
      'Título en Ingeniería en Sistemas o Ciencias de la Computación.',
      'Mínimo 4 años de experiencia en desarrollo de software, incluyendo 1 año en coordinación.',
      'Dominio de control de versiones (Git), CI/CD y revisiones de código.',
      'Experiencia en metodologías ágiles (Scrum, Kanban).',
    ],
    autoridad: [
      'Asignar y priorizar trabajo técnico al equipo de desarrollo.',
      'Proponer estándares de desarrollo, herramientas y arquitecturas.',
      'Aprobar merge de pull requests críticos.',
    ],
    responsabilidades: [
      'Coordinar el equipo de programadores (Junior, Mid-Senior, Senior).',
      'Garantizar calidad técnica y cumplimiento de estándares.',
      'Elaborar estimaciones y cronogramas de entrega.',
      'Mentorizar al equipo y promover el crecimiento técnico.',
      'Gestionar integraciones con sistemas ERP y aplicaciones del grupo.',
    ],
    educacion: 'Ingeniería en Sistemas, Ciencias de la Computación o afín.',
    experiencia: 'Mínimo 4 años en desarrollo de software, con experiencia en liderazgo técnico.',
    competencias: [
      'Liderazgo técnico',
      'Planificación y organización',
      'Mentoring',
      'Comunicación asertiva',
      'Resolución de problemas complejos',
    ],
    notas: '',
  },
  {
    codigo_puesto: 'IT-03',
    titulo: 'Coordinador de Infraestructura IT',
    reporta_a: 'Jefe de IT',
    objetivo:
      'Garantizar operación estable de infraestructura, redes, plataformas y soporte escalonado (N1/N2) con foco en SLA y seguridad.',
    requisitos: [
      'Título en Ingeniería en Sistemas, Redes o afín.',
      'Mínimo 4 años de experiencia en infraestructura IT.',
      'Experiencia en virtualización, redes LAN/WAN y gestión de incidentes.',
      'Conocimiento de seguridad informática y continuidad del negocio.',
    ],
    autoridad: [
      'Coordinar rotaciones, guardias y prioridad de incidentes de infraestructura.',
      'Validar y aprobar cambios de alto impacto en producción.',
      'Negociar SLAs con proveedores de conectividad y cloud bajo delegación del Jefe IT.',
    ],
    responsabilidades: [
      'Garantizar uptime de servicios tier A según KPI acordado.',
      'Gestionar el equipo de soporte técnico N1 y N2.',
      'Coordinar respuesta a incidentes críticos y ejecutar postmortems.',
      'Administrar infraestructura on-premise y servicios cloud.',
      'Implementar y mantener políticas de backup y recuperación.',
    ],
    educacion: 'Ingeniería en Sistemas, Redes, Telecomunicaciones o afín.',
    experiencia: 'Mínimo 4 años en infraestructura IT y gestión de operaciones.',
    competencias: [
      'Gestión de operaciones IT',
      'Resolución de incidentes bajo presión',
      'Liderazgo de equipos técnicos',
      'Orientación al servicio',
      'Documentación y procesos',
    ],
    notas: '',
  },
  {
    codigo_puesto: 'IT-04A',
    titulo: 'Programador Junior',
    reporta_a: 'Coordinador de Desarrollo IT',
    objetivo:
      'Desarrollar y mantener componentes de software bajo supervisión, aplicando buenas prácticas básicas y aprendiendo el dominio del negocio.',
    requisitos: [
      'Título universitario en Ingeniería en Sistemas o carrera afín (o en curso con avance > 70%).',
      'Fundamentos sólidos de programación, bases de datos y control de versiones.',
      'Actitud de aprendizaje continuo y trabajo en equipo.',
    ],
    autoridad: [
      'Ejecutar tareas técnicas asignadas por el Coordinador de Desarrollo.',
      'Documentar resultados y reportar avance diario.',
    ],
    responsabilidades: [
      'Implementar funcionalidades según requerimientos y estándares del área.',
      'Escribir código limpio, documentado y con pruebas básicas.',
      'Participar en revisiones de código y aprender de las observaciones.',
      'Registrar tickets y actualizar estado de tareas en el sistema de gestión.',
    ],
    educacion: 'Ingeniería en Sistemas, Informática o afín (título o en curso).',
    experiencia: 'Hasta 2 años de experiencia. Se acepta recién egresado.',
    competencias: [
      'Capacidad de aprendizaje',
      'Trabajo en equipo',
      'Comunicación técnica básica',
      'Organización y seguimiento',
      'Proactividad',
    ],
    notas: '',
  },
  {
    codigo_puesto: 'IT-04B',
    titulo: 'Programador Mid-Senior',
    reporta_a: 'Coordinador de Desarrollo IT',
    objetivo:
      'Diseñar e implementar soluciones de mediana complejidad, apoyar a programadores junior y asegurar calidad técnica en los módulos asignados.',
    requisitos: [
      'Título universitario en Ingeniería en Sistemas o afín.',
      'Mínimo 3 años de experiencia en desarrollo de software.',
      'Experiencia en pruebas automatizadas, revisión de código y gestión de deuda técnica.',
      'Dominio del stack tecnológico acordado por el área.',
    ],
    autoridad: [
      'Proponer y validar diseños técnicos dentro del alcance de su módulo.',
      'Orientar y revisar el trabajo técnico de programadores junior.',
    ],
    responsabilidades: [
      'Diseñar e implementar soluciones de mediana complejidad con autonomía.',
      'Garantizar la calidad técnica de los módulos bajo su responsabilidad.',
      'Mentorizar a programadores junior.',
      'Colaborar en estimaciones y planificación de sprint.',
      'Documentar decisiones técnicas y arquitecturas de componentes.',
    ],
    educacion: 'Ingeniería en Sistemas, Ciencias de la Computación o afín.',
    experiencia: 'Mínimo 3 años de experiencia en desarrollo de software.',
    competencias: [
      'Pensamiento analítico',
      'Autonomía técnica',
      'Mentoring',
      'Calidad de código',
      'Comunicación técnica',
    ],
    notas: '',
  },
  {
    codigo_puesto: 'IT-04C',
    titulo: 'Programador Senior',
    reporta_a: 'Coordinador de Desarrollo IT',
    objetivo:
      'Referencia técnica en diseño crítico, integraciones y excelencia de ingeniería; reduce riesgos en entregas de alto impacto.',
    requisitos: [
      'Título universitario en Ingeniería en Sistemas o afín.',
      'Mínimo 6 años de experiencia en desarrollo de software, con soluciones en producción.',
      'Visión de seguridad, rendimiento y observabilidad.',
      'Experiencia comprobable en arquitecturas complejas e integraciones empresariales.',
    ],
    autoridad: [
      'Liderar decisiones técnicas críticas en las iniciativas asignadas.',
      'Validar arquitecturas y apoyar a coordinación en estimaciones de alto impacto.',
      'Vetar implementaciones que incumplan estándares de seguridad o calidad.',
    ],
    responsabilidades: [
      'Diseñar y liderar la implementación de soluciones de alta complejidad.',
      'Garantizar la calidad técnica global del frente de desarrollo.',
      'Colaborar con el Coordinador de Desarrollo en la hoja de ruta técnica.',
      'Impulsar buenas prácticas de ingeniería en todo el equipo.',
      'Investigar y proponer nuevas tecnologías alineadas a la estrategia IT.',
    ],
    educacion: 'Ingeniería en Sistemas, Ciencias de la Computación o afín. Certificaciones técnicas valoradas.',
    experiencia: 'Mínimo 6 años en desarrollo de software con experiencia en proyectos críticos.',
    competencias: [
      'Liderazgo técnico',
      'Arquitectura de software',
      'Resolución de problemas complejos',
      'Mentoría y transferencia de conocimiento',
      'Visión de largo plazo',
    ],
    notas: '',
  },
  {
    codigo_puesto: 'IT-06A',
    titulo: 'Oficial de Soporte Técnico N1',
    reporta_a: 'Coordinador de Infraestructura IT',
    objetivo:
      'Primer contacto de soporte: registrar, clasificar y resolver incidencias de nivel 1 según catálogo y SLAs establecidos.',
    requisitos: [
      'Técnico universitario o título en Soporte Técnico, Redes o afín.',
      'Conocimiento de equipos de escritorio, sistemas operativos Windows y redes básicas.',
      'Manejo de sistemas de ticketing (ITSM).',
      'Comunicación clara y orientación al usuario.',
    ],
    autoridad: [
      'Ejecutar procedimientos N1 documentados en el catálogo de servicios.',
      'Escalar a N2 cuando el incidente supere el alcance N1.',
    ],
    responsabilidades: [
      'Registrar y clasificar todos los incidentes en el sistema de ticketing.',
      'Resolver incidentes de nivel 1: contraseñas, conectividad básica, impresoras, configuraciones de escritorio.',
      'Cumplir los tiempos de respuesta según SLA.',
      'Mantener la base de conocimiento actualizada con soluciones frecuentes.',
      'Comunicar al usuario el estado de su solicitud en todo momento.',
    ],
    educacion: 'Técnico universitario en Soporte Técnico, Redes o afín.',
    experiencia: 'De 0 a 2 años de experiencia en soporte técnico.',
    competencias: [
      'Orientación al servicio',
      'Comunicación efectiva',
      'Resolución de problemas básicos',
      'Trabajo bajo presión',
      'Seguimiento y documentación',
    ],
    notas: '',
  },
  {
    codigo_puesto: 'IT-06B',
    titulo: 'Oficial de Soporte Técnico N2',
    reporta_a: 'Coordinador de Infraestructura IT',
    objetivo:
      'Resolver incidentes avanzados, ejecutar cambios técnicos y apoyar a infraestructura bajo lineamientos del coordinador.',
    requisitos: [
      'Título universitario en Ingeniería en Sistemas, Redes o afín.',
      'Mínimo 2 años de experiencia en soporte técnico N2.',
      'Experiencia en troubleshooting de servidores, redes y aplicaciones corporativas.',
      'Conocimiento de Active Directory, virtualización y seguridad básica.',
    ],
    autoridad: [
      'Ejecutar cambios de complejidad media según ventanas de cambio aprobadas.',
      'Coordinar con proveedores técnicos bajo delegación del Coordinador.',
      'Escalar a N3 o proveedor cuando el incidente supere el alcance N2.',
    ],
    responsabilidades: [
      'Resolver incidentes escalados desde N1 que requieran diagnóstico avanzado.',
      'Ejecutar cambios programados en infraestructura bajo supervisión.',
      'Documentar causa raíz y proponer mejoras para evitar recurrencia.',
      'Apoyar en la administración de servidores, active directory y plataformas cloud.',
      'Participar en guardias de soporte según rotación del equipo.',
    ],
    educacion: 'Ingeniería en Sistemas, Redes, Telecomunicaciones o afín.',
    experiencia: 'Mínimo 2 años en soporte técnico N2 o administración de sistemas.',
    competencias: [
      'Diagnóstico técnico avanzado',
      'Documentación de incidentes',
      'Trabajo en equipo',
      'Gestión del tiempo',
      'Orientación a la mejora continua',
    ],
    notas: '',
  },
]

const RUBRICA_SOPORTE = [
  { categoria: 'Soporte y Servicio', criterio: 'Registro y clasificación correcta de incidentes en ITSM', descripcion: 'Categoriza correctamente cada ticket, lo que permite análisis posteriores fiables.' },
  { categoria: 'Soporte y Servicio', criterio: 'Cumplimiento de SLAs y tiempos de respuesta', descripcion: 'Cumple los tiempos pactados y alerta tempranamente cuando un caso los pone en riesgo.' },
  { categoria: 'Soporte y Servicio', criterio: 'Comunicación con usuarios finales (claridad y cordialidad)', descripcion: 'Trato cordial, lenguaje no técnico cuando aplica, deja al usuario informado del estado.' },
  { categoria: 'Soporte y Servicio', criterio: 'Tasa de resolución en primer contacto (FCR)', descripcion: 'Resuelve la mayor parte de incidencias en la primera interacción cuando es factible.' },
  { categoria: 'Infraestructura', criterio: 'Diagnóstico de hardware, software y periféricos', descripcion: 'Diagnostica y resuelve problemas en equipos de usuario final con método sistemático.' },
  { categoria: 'Infraestructura', criterio: 'Administración básica de redes (LAN/WiFi/VPN)', descripcion: 'Configura puntos de red, identifica problemas de conectividad y enrutamiento básico.' },
  { categoria: 'Infraestructura', criterio: 'Gestión de Active Directory y cuentas de usuario', descripcion: 'Crea/edita usuarios, grupos y GPOs siguiendo políticas definidas.' },
  { categoria: 'Infraestructura', criterio: 'Soporte a sistemas operativos Windows / Linux', descripcion: 'Instala, actualiza y diagnostica SO; conoce herramientas de comandos básicas.' },
  { categoria: 'Herramientas', criterio: 'Uso de sistema de ticketing (ITSM / Service Desk)', descripcion: 'Registra, categoriza y cierra tickets con calidad documental.' },
  { categoria: 'Herramientas', criterio: 'Conocimiento de herramientas de monitoreo y alerta', descripcion: 'Interpreta alertas, identifica falsos positivos y escala correctamente.' },
  { categoria: 'Herramientas', criterio: 'Documentación de procedimientos y base de conocimiento', descripcion: 'Documenta soluciones recurrentes; mantiene la KB actualizada.' },
  { categoria: 'Competencias', criterio: 'Escalamiento adecuado y trabajo colaborativo con equipo IT', descripcion: 'Reconoce sus límites y escala con contexto completo al N2 / coordinador.' },
  { categoria: 'Competencias', criterio: 'Gestión del tiempo y priorización de incidentes', descripcion: 'Atiende según severidad, no bloquea al equipo con incidentes mal priorizados.' },
  { categoria: 'Competencias', criterio: 'Iniciativa y propuesta de mejoras al proceso de soporte', descripcion: 'Identifica fricciones recurrentes y propone mejoras (automatización, FAQs, scripts).' },
]

const RUBRICA_DESARROLLO = [
  { categoria: 'Fundamentos', criterio: 'Comprensión de algoritmos y lógica de programación', descripcion: 'Resuelve problemas con lógica clara, justifica decisiones algorítmicas y comprende complejidad básica.' },
  { categoria: 'Fundamentos', criterio: 'Estructuras de datos y complejidad', descripcion: 'Elige estructuras adecuadas (listas, mapas, árboles) y entiende costos en tiempo/memoria.' },
  { categoria: 'Fundamentos', criterio: 'Fundamentos de redes y protocolos relevantes', descripcion: 'Conoce HTTP, TCP/IP, DNS y debugging de comunicación entre sistemas.' },
  { categoria: 'Desarrollo', criterio: 'Calidad de código, legibilidad y mantenibilidad', descripcion: 'Escribe código autoexplicativo, nombres claros, funciones cortas y modulares.' },
  { categoria: 'Desarrollo', criterio: 'Pruebas (unitarias / integración) y evidencias', descripcion: 'Cubre rutas críticas con pruebas, deja evidencia y mantiene la suite estable.' },
  { categoria: 'Desarrollo', criterio: 'Diseño OO / patrones y principios SOLID', descripcion: 'Aplica responsabilidad única, inversión de dependencias y patrones cuando aporta valor.' },
  { categoria: 'Desarrollo', criterio: 'Seguridad en desarrollo y manejo de secretos', descripcion: 'Maneja secretos fuera del repo, sanea entradas y conoce OWASP Top 10.' },
  { categoria: 'Herramientas', criterio: 'Control de versiones (Git) y flujo de ramas', descripcion: 'Domina rebase/merge, conflictos, PRs con revisiones, no rompe el main.' },
  { categoria: 'Herramientas', criterio: 'IDE, depuración y productividad', descripcion: 'Depura con breakpoints, perfila el código y usa atajos productivos del IDE.' },
  { categoria: 'Herramientas', criterio: 'CI/CD y automatización de build/deploy', descripcion: 'Conoce/configura pipelines básicos, automatiza pruebas y despliegues.' },
  { categoria: 'Herramientas', criterio: 'Bases de datos y consultas eficientes', descripcion: 'Diseña esquemas, lee planes de ejecución y evita problemas N+1.' },
  { categoria: 'Competencias', criterio: 'Comunicación técnica y trabajo en equipo', descripcion: 'Explica decisiones, documenta, escucha y colabora en revisiones constructivas.' },
  { categoria: 'Competencias', criterio: 'Resolución de problemas y análisis de causa raíz', descripcion: 'No parchea: investiga el porqué, propone soluciones permanentes.' },
  { categoria: 'Competencias', criterio: 'Autonomía, ownership y seguimiento a compromisos', descripcion: 'Toma responsabilidad de entregables, comunica riesgos y cumple plazos.' },
]

const RUBRICA_GESTION = [
  { categoria: 'Gestión Estratégica', criterio: 'Planificación y ejecución del portafolio alineado al negocio', descripcion: 'Define iniciativas con caso de negocio y prioriza según valor para la organización.' },
  { categoria: 'Gestión Estratégica', criterio: 'Gestión del presupuesto OPEX / CAPEX del área', descripcion: 'Controla el gasto, justifica desviaciones y optimiza costos sin afectar el servicio.' },
  { categoria: 'Gestión Estratégica', criterio: 'Cumplimiento de KPIs y metas anuales del área', descripcion: 'Hace seguimiento periódico de métricas y ajusta el plan para cumplir objetivos.' },
  { categoria: 'Gestión Estratégica', criterio: 'Gestión de riesgos y continuidad del negocio', descripcion: 'Identifica riesgos, define controles, ejecuta planes de continuidad/DR.' },
  { categoria: 'Liderazgo', criterio: 'Desarrollo de personas y mentoría del equipo a cargo', descripcion: 'Conduce evaluaciones, planes de carrera y mentorías estructuradas.' },
  { categoria: 'Liderazgo', criterio: 'Delegación efectiva y seguimiento a compromisos del equipo', descripcion: 'Asigna trabajo según fortalezas y da seguimiento sin micromanejo.' },
  { categoria: 'Liderazgo', criterio: 'Gestión del cambio y adopción de nuevas iniciativas', descripcion: 'Comunica el porqué del cambio, gestiona resistencia y asegura adopción.' },
  { categoria: 'Gestión Operativa', criterio: 'Respuesta y coordinación ante incidentes críticos', descripcion: 'Coordina respuesta, comunicación a stakeholders y postmortem accionable.' },
  { categoria: 'Gestión Operativa', criterio: 'Gestión de proveedores y contratos de servicio', descripcion: 'Negocia SLAs, supervisa entregables y maneja escalamientos.' },
  { categoria: 'Gestión Operativa', criterio: 'Adopción de estándares, políticas y buenas prácticas', descripcion: 'Mantiene normativas vigentes y promueve su uso en el equipo.' },
  { categoria: 'Competencias Directivas', criterio: 'Comunicación con stakeholders y reporte ejecutivo', descripcion: 'Presenta avances y riesgos con narrativa y datos a presidencia / gerencia.' },
  { categoria: 'Competencias Directivas', criterio: 'Toma de decisiones bajo presión e incertidumbre', descripcion: 'Decide con información parcial, asume responsabilidad y reevalúa.' },
  { categoria: 'Competencias Directivas', criterio: 'Visión técnica del frente bajo su responsabilidad', descripcion: 'Mantiene profundidad técnica suficiente para retar y validar al equipo.' },
]

const RUBRICA_COORDINACION = [
  { categoria: 'Gestión del Equipo', criterio: 'Asignación y priorización efectiva de trabajo al equipo', descripcion: 'Reparte el trabajo según habilidades y urgencia; no acumula trabajo en una persona.' },
  { categoria: 'Gestión del Equipo', criterio: 'Seguimiento al avance de tareas y compromisos del equipo', descripcion: 'Reuniones cortas de seguimiento, tablero al día, detección temprana de bloqueos.' },
  { categoria: 'Gestión del Equipo', criterio: 'Mentoría técnica y desarrollo de capacidades del equipo', descripcion: 'Apoya el crecimiento del equipo con retroalimentación y planes individuales.' },
  { categoria: 'Gestión del Equipo', criterio: 'Resolución de bloqueos y facilitación de entregas', descripcion: 'Quita obstáculos al equipo: dependencias, accesos, decisiones rápidas.' },
  { categoria: 'Gestión Técnica', criterio: 'Dominio técnico del frente bajo su coordinación', descripcion: 'Profundidad técnica suficiente para retar diseños y participar en revisiones.' },
  { categoria: 'Gestión Técnica', criterio: 'Definición y cumplimiento de estándares técnicos del área', descripcion: 'Mantiene guías, code style y arquitectura de referencia.' },
  { categoria: 'Gestión Técnica', criterio: 'Gestión de calidad y revisión de entregables técnicos', descripcion: 'Garantiza pruebas, revisiones de código y criterio de aceptación.' },
  { categoria: 'Gestión Operativa', criterio: 'Planificación de sprints / ciclos de trabajo', descripcion: 'Estima, prioriza con el Jefe IT y cumple compromisos del ciclo.' },
  { categoria: 'Gestión Operativa', criterio: 'Reporte de avance y comunicación al Jefe IT', descripcion: 'Reporta hechos, métricas y riesgos sin maquillar.' },
  { categoria: 'Gestión Operativa', criterio: 'Gestión de riesgos técnicos del frente', descripcion: 'Detecta riesgos técnicos y propone planes de mitigación con costo/beneficio.' },
  { categoria: 'Competencias', criterio: 'Comunicación efectiva con stakeholders internos', descripcion: 'Explica trade-offs y traduce términos técnicos a las áreas de negocio.' },
  { categoria: 'Competencias', criterio: 'Adaptabilidad y gestión del cambio', descripcion: 'Replanifica con calma cuando cambian prioridades; mantiene al equipo enfocado.' },
  { categoria: 'Competencias', criterio: 'Orientación a resultados y cumplimiento de SLAs', descripcion: 'Mide el cumplimiento de SLAs/OKRs y corrige proactivamente.' },
]

function clavePorPuesto(codigo: string): string {
  return `rubrica_${codigo.replace(/[^a-zA-Z0-9]/g, '_')}_json`
}

type RubricaItem = { categoria: string; criterio: string; descripcion?: string }

const RUBRICA_POR_PUESTO: Record<string, RubricaItem[]> = {
  'IT-01': RUBRICA_GESTION,
  'IT-02': RUBRICA_COORDINACION,
  'IT-03': RUBRICA_COORDINACION,
  'IT-04A': RUBRICA_DESARROLLO,
  'IT-04B': RUBRICA_DESARROLLO,
  'IT-04C': RUBRICA_DESARROLLO,
  'IT-06A': RUBRICA_SOPORTE,
  'IT-06B': RUBRICA_SOPORTE,
}

export async function ensureDescriptoresPuesto(): Promise<void> {
  for (const desc of DESCRIPTORES_INICIALES) {
    await DescriptorPuesto.findOneAndUpdate(
      { codigo_puesto: desc.codigo_puesto },
      { $setOnInsert: desc },
      { upsert: true },
    )
  }
}

export async function ensureRubricasPorPuesto(): Promise<void> {
  for (const [codigo, criterios] of Object.entries(RUBRICA_POR_PUESTO)) {
    if (criterios.length === 0) continue
    const clave = clavePorPuesto(codigo)
    const existing = await Config.findOne({ clave }).lean()
    if (!existing) {
      await Config.create({ clave, valor: JSON.stringify(criterios) })
    }
  }
}

/**
 * Para cada PerfilPuesto cuyo `codigo` esté en `RUBRICA_POR_PUESTO`, precarga
 * la rúbrica sugerida si todavía no tiene `rubrica_criterios` configurada.
 * Mapeo sugerido:
 *  - IT-01 (Jefe IT)                  → Gestión
 *  - IT-02 (Coord Desarrollo)         → Coordinación
 *  - IT-03 (Coord Infraestructura)    → Coordinación
 *  - IT-04A/B/C (Programadores)       → Desarrollo (14 criterios)
 *  - IT-06A/B (Soporte N1/N2)         → Soporte (14 criterios)
 */
export async function ensureRubricasPorPerfil(): Promise<void> {
  for (const [codigo, criterios] of Object.entries(RUBRICA_POR_PUESTO)) {
    if (criterios.length === 0) continue
    const perfil = await PerfilPuesto.findOne({ codigo }).select('_id rubrica_criterios').lean()
    if (!perfil) continue
    const tieneRubrica = Array.isArray(perfil.rubrica_criterios) && perfil.rubrica_criterios.length > 0
    if (tieneRubrica) continue
    await PerfilPuesto.findByIdAndUpdate(perfil._id, {
      $set: { rubrica_criterios: criterios },
    })
  }
}

// ─── Departamentos (catálogo EHR) ───────────────────────────────────────────

const DEPTO_PALETTE = [
  '#002060', '#70AD47', '#C00000', '#4527A0', '#0F6E56', '#7F6000', '#1F4E79', '#375623', '#6B7280',
]

function colorDeptoCatalogo(i: number): string {
  return DEPTO_PALETTE[i % DEPTO_PALETTE.length]
}

async function migrateLegacyDepartamentoRefs(): Promise<void> {
  const pairs: ReadonlyArray<readonly [string, number]> = [
    ['IT', 8],
    ['RRHH', 10],
    ['FIN', 9],
    ['OPS', 13],
    ['COM', 5],
    ['LEG', 68],
  ]
  for (const [oldCod, ehrId] of pairs) {
    const oldD = await Departamento.findOne({ codigo: oldCod }).lean()
    const newD = await Departamento.findOne({ ehr_departamento_id: ehrId }).lean()
    if (!oldD || !newD || String(oldD._id) === String(newD._id)) continue
    const oldId = oldD._id as mongoose.Types.ObjectId
    const newId = newD._id as mongoose.Types.ObjectId

    await Usuario.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })
    await Proyecto.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })
    await PerfilPuesto.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })
    await PlantillaCarrera.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })
    await KPI.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })
    await Rol.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })
    const rolesDept = await Rol.find({ departamentos_ids: oldId }).select('_id departamentos_ids').lean()
    for (const rol of rolesDept) {
      const raw = rol.departamentos_ids as unknown[]
      const ids = raw.map((x) => String(x)).filter((x) => x !== String(oldId))
      if (!ids.includes(String(newId))) ids.push(String(newId))
      await Rol.updateOne(
        { _id: rol._id },
        { $set: { departamentos_ids: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
      )
    }
    await Colaborador.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })
    await Empleado.updateMany({ departamento_id: oldId }, { $set: { departamento_id: newId } })

    const caps = await Capacitacion.find({ departamentos_ids: oldId }).select('_id departamentos_ids').lean()
    for (const c of caps) {
      const raw = c.departamentos_ids as unknown[]
      const ids = raw.map((x) => String(x)).filter((x) => x !== String(oldId))
      if (!ids.includes(String(newId))) ids.push(String(newId))
      await Capacitacion.updateOne(
        { _id: c._id },
        { $set: { departamentos_ids: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
      )
    }

    await Departamento.deleteOne({ _id: oldId })
  }
}

export async function ensureEmpresasEhrMaestro(): Promise<void> {
  for (const e of EMPRESAS_EHR_SEED) {
    await Empresa.findOneAndUpdate(
      { ehr_empresa_id: e.ehr_empresa_id },
      {
        $set: {
          codigo: e.codigo,
          nombre: e.nombre,
          descripcion: `Empresa EHR id ${e.ehr_empresa_id}`,
          origen: 'ehr',
          activo: true,
        },
      },
      { upsert: true },
    )
  }
}

function buildEjesProyectoSeed(): Array<{
  codigo: string
  nombre: string
  descripcion: string
  color: string
  orden: number
}> {
  const colorPorNombre: Record<string, string> = {
    General: '#6B7280',
    Infraestructura: '#1F4E79',
    Seguridad: '#C00000',
    Red: '#375623',
    Software: '#7F6000',
    'Gobierno IT': '#4527A0',
    Talento: '#0F6E56',
  }
  const fallback = ['#6B7280', '#002060', '#70AD47', '#2C5282', '#744210', '#285E61', '#822659']
  const vistoNombre = new Set<string>()
  const codigosUsados = new Set<string>()
  const out: Array<{
    codigo: string
    nombre: string
    descripcion: string
    color: string
    orden: number
  }> = []
  let orden = 0
  for (const rawNombre of EJES_CATALOGO_SEMILLA_NOMBRES) {
    const nombre = rawNombre.trim()
    if (!nombre || vistoNombre.has(nombre)) continue
    vistoNombre.add(nombre)
    let base = nombre
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase()
      .slice(0, 18)
    if (!base) base = `EJE${orden}`
    let codigo = base
    let suf = 0
    while (codigosUsados.has(codigo)) {
      suf++
      codigo = `${base.slice(0, 12)}_${suf}`.slice(0, 18)
    }
    codigosUsados.add(codigo)
    out.push({
      codigo,
      nombre,
      descripcion: '',
      color: colorPorNombre[nombre] ?? fallback[orden % fallback.length],
      orden: orden++,
    })
  }
  return out
}

/** Catálogo global de ejes (valores de `Proyecto.eje`). Sólo inserta si no existe el `codigo`. */
export async function ensureEjesProyecto(): Promise<void> {
  for (const e of buildEjesProyectoSeed()) {
    await EjeProyecto.findOneAndUpdate(
      { codigo: e.codigo },
      {
        $setOnInsert: {
          codigo: e.codigo,
          nombre: e.nombre,
          descripcion: e.descripcion,
          color: e.color,
          orden: e.orden,
          activo: true,
        },
      },
      { upsert: true },
    )
  }
}

export async function ensureDepartamentos(): Promise<void> {
  await ensureEmpresasEhrMaestro()
  const empresas = await Empresa.find({ ehr_empresa_id: { $exists: true, $ne: null } })
    .select('_id ehr_empresa_id')
    .lean()
  const empresaOidByEhr = new Map<number, mongoose.Types.ObjectId>(
    empresas.map((x) => [x.ehr_empresa_id as number, x._id as mongoose.Types.ObjectId]),
  )

  let idx = 0
  for (const d of DEPARTAMENTOS_EHR_SEED) {
    const empresaOid = empresaOidByEhr.get(d.ehr_empresa_id)
    const codigo = `DEP-${d.ehr_departamento_id}`
    const lleva = EHR_DEPARTAMENTOS_LLEVA_GASTOS_DEFAULT.has(d.ehr_departamento_id)
    const ejes = d.ehr_departamento_id === 8 ? [...EJES_PROYECTO_IT_DEFAULT] : []
    const empNombre =
      EMPRESAS_EHR_SEED.find((e) => e.ehr_empresa_id === d.ehr_empresa_id)?.nombre ?? ''
    await Departamento.findOneAndUpdate(
      { ehr_departamento_id: d.ehr_departamento_id },
      {
        $set: {
          codigo,
          nombre: d.nombre,
          descripcion: `${empNombre} · Depto #${d.ehr_departamento_id}`,
          color: colorDeptoCatalogo(idx),
          ehr_departamento_id: d.ehr_departamento_id,
          ehr_empresa_id: d.ehr_empresa_id,
          empresa_id: empresaOid ?? null,
          ejes_proyecto: ejes,
          lleva_gastos: lleva,
          activo: true,
        },
      },
      { upsert: true },
    )
    idx++
  }

  await migrateLegacyDepartamentoRefs()
}

// ─── URL listado empresas EHR ───────────────────────────────────────────────

export async function ensureEhrCompanyListConfig(): Promise<void> {
  await Config.findOneAndUpdate(
    { clave: CONFIG_CLAVE_EHR_COMPANY_LIST },
    { $setOnInsert: { valor: DEFAULT_EHR_COMPANY_LIST_URL } },
    { upsert: true },
  )
}

// ─── Perfiles de Puesto ───────────────────────────────────────────────────────

export async function ensurePerfilesPuesto(): Promise<void> {
  const deptIT = await Departamento.findOne({
    $or: [{ ehr_departamento_id: 8 }, { codigo: 'IT' }],
  }).lean()
  if (!deptIT) return
  const deptId = deptIT._id as mongoose.Types.ObjectId

  for (const desc of DESCRIPTORES_INICIALES) {
    await PerfilPuesto.findOneAndUpdate(
      { codigo: desc.codigo_puesto },
      {
        $setOnInsert: {
          codigo: desc.codigo_puesto,
          titulo: desc.titulo,
          departamento_id: deptId,
          nivel: '',
          reporta_a: desc.reporta_a,
          objetivo: desc.objetivo,
          requisitos: desc.requisitos,
          responsabilidades: desc.responsabilidades ?? [],
          autoridad: desc.autoridad,
          educacion: desc.educacion ?? '',
          experiencia: desc.experiencia ?? '',
          competencias: desc.competencias ?? [],
          notas: desc.notas,
        },
      },
      { upsert: true },
    )
  }
}

// ─── Plantillas de Carrera ───────────────────────────────────────────────────

const N2_ITEMS = [
  // A. Formación académica y técnica
  { codigo: 'A1', seccion: 'A. Formación académica y técnica', requisito: 'Título universitario en Ingeniería en Sistemas, Redes o afín (o avance ≥ 70%)', tipo_requisito: 'Indispensable', plazo_estimado: '0–6 meses', recurso: 'Colaborador / RRHH' },
  { codigo: 'A2', seccion: 'A. Formación académica y técnica', requisito: 'Certificación ITIL Foundation o equivalente en gestión de servicios TI', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Udemy / Proveedor externo' },
  { codigo: 'A3', seccion: 'A. Formación académica y técnica', requisito: 'Curso de liderazgo y gestión de equipos (mínimo 20 horas)', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'RRHH / Proveedor externo' },
  { codigo: 'A4', seccion: 'A. Formación académica y técnica', requisito: 'Certificación técnica en área de especialización (redes, seguridad, cloud)', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Proveedor externo' },
  { codigo: 'A5', seccion: 'A. Formación académica y técnica', requisito: 'Curso de gestión de proyectos (PMP, Prince2 o equivalente básico)', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Proveedor externo' },
  // B. Conocimiento del negocio
  { codigo: 'B1', seccion: 'B. Conocimiento del negocio y procesos RCJ', requisito: 'Conocimiento de las 9 empresas del grupo RCJ y sus operaciones', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Jefe IT / Gerencias' },
  { codigo: 'B2', seccion: 'B. Conocimiento del negocio y procesos RCJ', requisito: 'Dominio del catálogo de servicios IT y SLAs vigentes', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Documentación IT' },
  { codigo: 'B3', seccion: 'B. Conocimiento del negocio y procesos RCJ', requisito: 'Comprensión del Plan IT Anual y su alineación estratégica', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Jefe IT' },
  { codigo: 'B4', seccion: 'B. Conocimiento del negocio y procesos RCJ', requisito: 'Participación activa en al menos 2 proyectos del Plan IT', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Proyectos IT' },
  { codigo: 'B5', seccion: 'B. Conocimiento del negocio y procesos RCJ', requisito: 'Conocimiento de políticas de seguridad y cumplimiento corporativo', tipo_requisito: 'Recomendado', plazo_estimado: '6–9 meses', recurso: 'Documentación IT / Legal' },
  // C. Liderazgo
  { codigo: 'C1', seccion: 'C. Liderazgo y gestión de equipos', requisito: 'Demostrar capacidad de liderar y coordinar tareas del equipo de soporte', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Jefe IT (observación directa)' },
  { codigo: 'C2', seccion: 'C. Liderazgo y gestión de equipos', requisito: 'Mentoría documentada a al menos un técnico N1', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Colaborador / Jefe IT' },
  { codigo: 'C3', seccion: 'C. Liderazgo y gestión de equipos', requisito: 'Gestionar la distribución de carga de trabajo en ausencia del coordinador', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Jefe IT (autorización)' },
  { codigo: 'C4', seccion: 'C. Liderazgo y gestión de equipos', requisito: 'Elaborar y presentar un reporte de métricas del equipo al Jefe IT', tipo_requisito: 'Recomendado', plazo_estimado: '6–12 meses', recurso: 'Colaborador' },
  { codigo: 'C5', seccion: 'C. Liderazgo y gestión de equipos', requisito: 'Resolver conflictos internos del equipo de manera constructiva', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'RRHH / Jefe IT' },
  // D. Infraestructura y operaciones
  { codigo: 'D1', seccion: 'D. Infraestructura y operaciones', requisito: 'Dominio avanzado de administración de Active Directory y GPOs', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Autoestudio / Proveedor' },
  { codigo: 'D2', seccion: 'D. Infraestructura y operaciones', requisito: 'Gestión de servidores físicos y virtuales (VMware / Hyper-V)', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Práctica en ambiente IT' },
  { codigo: 'D3', seccion: 'D. Infraestructura y operaciones', requisito: 'Configuración y troubleshooting de redes LAN/WAN/VPN', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Práctica / Curso' },
  { codigo: 'D4', seccion: 'D. Infraestructura y operaciones', requisito: 'Administración de identidad e integración (Active Directory, M365, SAP B1 Cloud / HANA)', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Microsoft Learn / SAP Learning Hub' },
  { codigo: 'D5', seccion: 'D. Infraestructura y operaciones', requisito: 'Gestión de backup, recuperación y continuidad operativa', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Documentación IT / Práctica' },
  // E. Seguridad y cumplimiento
  { codigo: 'E1', seccion: 'E. Seguridad, cumplimiento y continuidad', requisito: 'Conocimiento de buenas prácticas de ciberseguridad (phishing, EDR, MFA)', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Capacitación IT / Interno' },
  { codigo: 'E2', seccion: 'E. Seguridad, cumplimiento y continuidad', requisito: 'Participación en simulacros de recuperación ante desastres (DR)', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Jefe IT' },
  { codigo: 'E3', seccion: 'E. Seguridad, cumplimiento y continuidad', requisito: 'Documentar al menos 3 procedimientos críticos del área de infraestructura', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Colaborador' },
  { codigo: 'E4', seccion: 'E. Seguridad, cumplimiento y continuidad', requisito: 'Conocimiento básico de marcos de referencia (ISO 27001, NIST)', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Autoestudio / Udemy' },
  { codigo: 'E5', seccion: 'E. Seguridad, cumplimiento y continuidad', requisito: 'Gestión de vulnerabilidades e implementación de parches críticos', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Práctica en ambiente IT' },
  // F. Comunicación con stakeholders
  { codigo: 'F1', seccion: 'F. Comunicación con stakeholders', requisito: 'Comunicar incidentes críticos con claridad a gerencias y usuarios clave', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Jefe IT (observación)' },
  { codigo: 'F2', seccion: 'F. Comunicación con stakeholders', requisito: 'Elaborar presentaciones técnicas para audiencias no técnicas', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Colaborador / Jefe IT' },
  { codigo: 'F3', seccion: 'F. Comunicación con stakeholders', requisito: 'Negociar SLAs o acuerdos con proveedores técnicos bajo supervisión', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Jefe IT' },
  { codigo: 'F4', seccion: 'F. Comunicación con stakeholders', requisito: 'Facilitar reuniones del equipo de infraestructura con agenda y minutas', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Colaborador' },
  { codigo: 'F5', seccion: 'F. Comunicación con stakeholders', requisito: 'Presentar métricas de desempeño del área al Jefe IT mensualmente', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Colaborador' },
]

const JR_MID_ITEMS = [
  { codigo: 'A1', seccion: 'A. Fundamentos Técnicos', requisito: 'Domina el stack tecnológico del área con autonomía (lenguajes, frameworks, herramientas)', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Coordinador Desarrollo / Autoestudio' },
  { codigo: 'A2', seccion: 'A. Fundamentos Técnicos', requisito: 'Escribe código limpio, documentado y cumpliendo estándares del equipo', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Revisiones de código / Coordinador' },
  { codigo: 'A3', seccion: 'A. Fundamentos Técnicos', requisito: 'Comprende y aplica principios SOLID, patrones de diseño básicos y clean code', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Autoestudio / Mentorías' },
  { codigo: 'A4', seccion: 'A. Fundamentos Técnicos', requisito: 'Implementa pruebas unitarias y de integración con cobertura documentada', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Coordinador Desarrollo' },
  { codigo: 'B1', seccion: 'B. Desarrollo y Calidad', requisito: 'Resuelve tareas de mediana complejidad de manera autónoma sin supervisión constante', tipo_requisito: 'Indispensable', plazo_estimado: '3–9 meses', recurso: 'Coordinador (evaluación directa)' },
  { codigo: 'B2', seccion: 'B. Desarrollo y Calidad', requisito: 'Realiza revisiones de código (code reviews) con retroalimentación constructiva', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Proceso Git del equipo' },
  { codigo: 'B3', seccion: 'B. Desarrollo y Calidad', requisito: 'Identifica y gestiona deuda técnica, propone mejoras con sustento', tipo_requisito: 'Recomendado', plazo_estimado: '6–12 meses', recurso: 'Coordinador Desarrollo' },
  { codigo: 'B4', seccion: 'B. Desarrollo y Calidad', requisito: 'Manejo avanzado de control de versiones (branching, rebase, cherry-pick, conflictos)', tipo_requisito: 'Indispensable', plazo_estimado: '3–6 meses', recurso: 'Autoestudio / Práctica diaria' },
  { codigo: 'C1', seccion: 'C. Herramientas y DevOps', requisito: 'Configura y mantiene pipelines CI/CD básicos (GitHub Actions, Jenkins u otro)', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Udemy / Coordinador' },
  { codigo: 'C2', seccion: 'C. Herramientas y DevOps', requisito: 'Usa herramientas de monitoreo, logging y alertas del ambiente de producción', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Coordinador / Infra' },
  { codigo: 'C3', seccion: 'C. Herramientas y DevOps', requisito: 'Administra y optimiza consultas en bases de datos relacionales y/o NoSQL', tipo_requisito: 'Indispensable', plazo_estimado: '6–9 meses', recurso: 'Autoestudio / Proyectos' },
  { codigo: 'D1', seccion: 'D. Competencias', requisito: 'Lidera pequeñas iniciativas técnicas o módulos asignados dentro del equipo', tipo_requisito: 'Indispensable', plazo_estimado: '9–12 meses', recurso: 'Coordinador (asignación de tarea)' },
  { codigo: 'D2', seccion: 'D. Competencias', requisito: 'Apoya con mentoría técnica puntual a programadores junior del equipo', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Coordinador' },
  { codigo: 'D3', seccion: 'D. Competencias', requisito: 'Comunica decisiones técnicas con claridad al equipo y al coordinador', tipo_requisito: 'Indispensable', plazo_estimado: '3–9 meses', recurso: 'Práctica diaria' },
]

const MID_SENIOR_ITEMS = [
  { codigo: 'A1', seccion: 'A. Liderazgo Técnico', requisito: 'Diseña arquitecturas de sistemas de mediana-alta complejidad con documentación', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Proyectos asignados / Coordinador' },
  { codigo: 'A2', seccion: 'A. Liderazgo Técnico', requisito: 'Lidera proyectos técnicos críticos de principio a fin (diseño, ejecución, entrega)', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Coordinador (asignación de proyecto)' },
  { codigo: 'A3', seccion: 'A. Liderazgo Técnico', requisito: 'Define estándares técnicos del equipo y los promueve activamente', tipo_requisito: 'Indispensable', plazo_estimado: '9–12 meses', recurso: 'Coordinador Desarrollo' },
  { codigo: 'A4', seccion: 'A. Liderazgo Técnico', requisito: 'Evalúa tecnologías emergentes y presenta recomendaciones con análisis de impacto', tipo_requisito: 'Recomendado', plazo_estimado: '9–18 meses', recurso: 'Autoestudio / Coordinador' },
  { codigo: 'B1', seccion: 'B. Calidad y Seguridad', requisito: 'Diseña estrategias completas de testing (unit, integration, e2e) para módulos críticos', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Proyectos / Coordinador' },
  { codigo: 'B2', seccion: 'B. Calidad y Seguridad', requisito: 'Implementa prácticas de seguridad en desarrollo (OWASP top 10, gestión de secretos)', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Curso seguridad / Coordinador' },
  { codigo: 'B3', seccion: 'B. Calidad y Seguridad', requisito: 'Garantiza rendimiento y observabilidad de sistemas en producción', tipo_requisito: 'Indispensable', plazo_estimado: '9–12 meses', recurso: 'Herramientas APM / Coordinador' },
  { codigo: 'B4', seccion: 'B. Calidad y Seguridad', requisito: 'Gestiona migraciones y cambios de datos críticos en producción con plan de rollback', tipo_requisito: 'Indispensable', plazo_estimado: '9–18 meses', recurso: 'Proyectos / Coordinador' },
  { codigo: 'C1', seccion: 'C. Conocimiento del Negocio', requisito: 'Comprende profundamente el dominio del negocio y los procesos empresariales del grupo', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Interacción con áreas de negocio' },
  { codigo: 'C2', seccion: 'C. Conocimiento del Negocio', requisito: 'Traduce requerimientos complejos de negocio a soluciones técnicas robustas y escalables', tipo_requisito: 'Indispensable', plazo_estimado: '9–18 meses', recurso: 'Proyectos cross-funcionales' },
  { codigo: 'C3', seccion: 'C. Conocimiento del Negocio', requisito: 'Colabora con stakeholders no técnicos para definir prioridades y alcance técnico', tipo_requisito: 'Recomendado', plazo_estimado: '9–12 meses', recurso: 'Reuniones de proyecto' },
  { codigo: 'D1', seccion: 'D. Mentoría y Liderazgo de Equipo', requisito: 'Desarrolla las capacidades técnicas del equipo de desarrollo mediante mentorías formales', tipo_requisito: 'Indispensable', plazo_estimado: '9–18 meses', recurso: 'Plan de mentoría documentado' },
  { codigo: 'D2', seccion: 'D. Mentoría y Liderazgo de Equipo', requisito: 'Apoya al Coordinador en estimaciones técnicas y planificación de sprint', tipo_requisito: 'Indispensable', plazo_estimado: '6–12 meses', recurso: 'Coordinador Desarrollo' },
  { codigo: 'D3', seccion: 'D. Mentoría y Liderazgo de Equipo', requisito: 'Es reconocido como referencia técnica de autoridad por el equipo y el coordinador', tipo_requisito: 'Indispensable', plazo_estimado: '12–18 meses', recurso: 'Evaluación 360 / Coordinador' },
]

const PLANTILLAS_INICIALES = [
  {
    nombre: 'Soporte Técnico N2 → Coordinador de Infraestructura',
    descripcion: 'Plan de carrera para promover al Oficial de Soporte Técnico N2 al puesto de Coordinador de Infraestructura IT. Duración estimada: 12 meses.',
    tipo_ruta: 'N2_a_Coord',
    items: N2_ITEMS,
  },
  {
    nombre: 'Programador Junior → Mid-Senior',
    descripcion: 'Plan de desarrollo técnico para promover al Programador Junior al nivel Mid-Senior. Duración estimada: 12 meses.',
    tipo_ruta: 'Jr_a_Mid',
    items: JR_MID_ITEMS,
  },
  {
    nombre: 'Programador Mid-Senior → Senior',
    descripcion: 'Plan de desarrollo técnico y liderazgo para promover al Programador Mid-Senior al nivel Senior. Duración estimada: 18 meses.',
    tipo_ruta: 'Mid_a_Senior',
    items: MID_SENIOR_ITEMS,
  },
]

export async function ensurePlantillasCarrera(): Promise<void> {
  const deptIT = await Departamento.findOne({
    $or: [{ ehr_departamento_id: 8 }, { codigo: 'IT' }],
  }).lean()
  const deptId = deptIT ? (deptIT._id as mongoose.Types.ObjectId) : undefined

  for (const pl of PLANTILLAS_INICIALES) {
    const existing = await PlantillaCarrera.findOne({ tipo_ruta: pl.tipo_ruta, ...(deptId ? { departamento_id: deptId } : {}) }).lean()
    if (!existing) {
      await PlantillaCarrera.create({
        nombre: pl.nombre,
        descripcion: pl.descripcion,
        departamento_id: deptId,
        tipo_ruta: pl.tipo_ruta,
        activo: true,
        items: pl.items,
      })
    }
  }
}

// ─── Roles iniciales ──────────────────────────────────────────────────────────

const ROLES_INICIALES = [
  {
    nombre: 'Administrador',
    descripcion: 'Acceso completo a todas las funciones del sistema',
    permisos: ['*'],
  },
  {
    nombre: 'Jefe IT',
    descripcion: 'Acceso completo a módulos operativos y administración de usuarios.',
    permisos: [
      'dashboard:ver', 'proyectos:ver', 'proyectos:editar',
      'equipo:ver', 'equipo:editar', 'capacitaciones:ver', 'capacitaciones:editar',
      'gastos:ver', 'kpis:ver', 'kpis:editar',
      'capacitaciones:ver-todos',
      'maestros:ver', 'maestros:editar', 'empleados:ver', 'empleados:editar',
      'usuarios:ver', 'usuarios:editar', 'roles:ver', 'roles:editar',
      'it:arquitectura:ver', 'it:arquitectura:editar',
    ],
  },
  {
    nombre: 'Coordinador',
    descripcion: 'Edición de proyectos, equipo y capacitaciones. Sin acceso a maestros.',
    permisos: [
      'dashboard:ver', 'proyectos:ver', 'proyectos:editar',
      'equipo:ver', 'equipo:editar', 'capacitaciones:ver', 'capacitaciones:editar',
      'kpis:ver', 'empleados:ver',
      'it:arquitectura:ver', 'it:arquitectura:editar',
    ],
  },
  {
    nombre: 'Consulta',
    descripcion: 'Solo lectura en todos los módulos',
    permisos: [
      'dashboard:ver', 'proyectos:ver', 'equipo:ver',
      'capacitaciones:ver', 'gastos:ver', 'kpis:ver',
      'maestros:ver', 'empleados:ver',
      'it:arquitectura:ver',
    ],
  },
]

export async function ensureRolesYAdmin(): Promise<void> {
  await normalizeEhrLoginUrl()
  await Config.findOneAndUpdate(
    { clave: 'empleados_service_url' },
    { $setOnInsert: { valor: DEFAULT_EHR_EMPLOYEE_URL } },
    { upsert: true },
  )
  await Config.findOneAndUpdate(
    { clave: 'ehr_auth_login_url' },
    { $setOnInsert: { valor: DEFAULT_EHR_LOGIN_URL } },
    { upsert: true },
  )

  for (const r of ROLES_INICIALES) {
    await Rol.findOneAndUpdate(
      { nombre: r.nombre },
      { $setOnInsert: r },
      { upsert: true },
    )
    if (r.nombre === 'Jefe IT') {
      await Rol.updateOne({ nombre: 'Jefe IT' }, { $set: { permisos: r.permisos, descripcion: r.descripcion } })
    }
  }

  const removed = await Usuario.deleteOne({ email: 'admin@rcj.hn' })
  if (removed.deletedCount) {
    console.log('Usuario demo admin@rcj.hn eliminado (ya no se crea automáticamente).')
  }
}

// ─── Metas estratégicas por departamento ─────────────────────────────────────

/** Reservado por compatibilidad; las metas ya no se precargan al iniciar. */
export async function ensureMetasDepartamentosIniciales(): Promise<void> {
  /* metas por departamento: configuración manual en la app */
}

// ─── KPIs por departamento ────────────────────────────────────────────────────

/**
 * Migraciones de KPIs al arrancar el servidor (sin crear indicadores nuevos).
 * Los KPIs se crean manualmente en el módulo o con «Sugerencias» a pedido del usuario.
 */
export async function ensureKpisIniciales(): Promise<void> {
  const departamentos = await Departamento.find().select('_id codigo ehr_departamento_id').lean()
  const porCodigo = new Map<string, mongoose.Types.ObjectId>(
    departamentos.map((d) => [d.codigo, d._id as mongoose.Types.ObjectId]),
  )
  const porEhr = new Map<number, mongoose.Types.ObjectId>()
  for (const d of departamentos) {
    if (d.ehr_departamento_id != null) {
      porEhr.set(d.ehr_departamento_id, d._id as mongoose.Types.ObjectId)
    }
  }

  const deptIT = porEhr.get(8) ?? porCodigo.get('IT')
  if (deptIT) {
    await KPI.updateMany(
      { $or: [{ departamento_id: { $exists: false } }, { departamento_id: null }] },
      { $set: { departamento_id: deptIT } },
    )
  }

}

// ─── Arquitectura IT (sistemas, deuda, APIs, checklist) ─────────────────────

const PERMISOS_ARQ_IT_EDIT = ['it:arquitectura:ver', 'it:arquitectura:editar'] as const
const PERMISO_ARQ_IT_VER = 'it:arquitectura:ver'

export async function ensureITArquitecturaData(): Promise<void> {
  await Rol.updateMany(
    { nombre: { $in: ['Jefe IT', 'Coordinador'] } },
    { $addToSet: { permisos: { $each: [...PERMISOS_ARQ_IT_EDIT] } } },
  )
  await Rol.updateMany(
    { nombre: 'Consulta' },
    { $addToSet: { permisos: PERMISO_ARQ_IT_VER } },
  )

  const [sistCount, deudaCount, epCount, clCount] = await Promise.all([
    SistemaIT.countDocuments(),
    DeudaTecnica.countDocuments(),
    ApiEndpointIT.countDocuments(),
    ChecklistItemIT.countDocuments(),
  ])

  if (sistCount === 0) {
    await SistemaIT.insertMany(sistemasITIniciales())
  }

  await migrarArquitecturaSinAWS()

  if (deudaCount === 0) {
    await DeudaTecnica.insertMany([
      { titulo: 'eProc — Sin estándares unificados', sistema: 'eProc', severidad: 'high', riesgo: 'Mantenibilidad', urgencia: 80, estado: 'abierta', trimestre_roadmap: 'Q4 2026', descripcion: 'Lógica mezclada en controllers. Sin DTOs ni validación centralizada. Difícil de extender y testear.' },
      { titulo: 'IIS Windows — Migración pendiente', sistema: 'IIS Legacy', severidad: 'high', riesgo: 'Seguridad', urgencia: 75, estado: 'en_progreso', trimestre_roadmap: 'Q3 2026', descripcion: 'Aplicaciones sin actualizar. Dependencias obsoletas. Riesgo de vulnerabilidades CVE activas.' },
      { titulo: 'eCash — Sistema parcialmente desarrollado', sistema: 'eCash', severidad: 'high', riesgo: 'Operacional', urgencia: 70, estado: 'abierta', trimestre_roadmap: 'Q4 2026', descripcion: 'Flujos incompletos. Dependencia manual en procesos de cierre. Sin auditoría de transacciones.' },
      { titulo: 'APIs sin documentación Swagger', sistema: 'Todos', severidad: 'medium', riesgo: 'Onboarding', urgencia: 50, estado: 'abierta', trimestre_roadmap: 'Q3 2026', descripcion: 'Endpoints sin documentar dificultan incorporación de nuevos devs e integración entre sistemas.' },
      { titulo: 'Sin CI/CD en sistemas internos', sistema: 'DevOps', severidad: 'medium', riesgo: 'Calidad', urgencia: 45, estado: 'abierta', trimestre_roadmap: 'Q4 2026', descripcion: 'Deploys manuales. Sin pipelines de pruebas automáticas. Riesgo de regresiones en producción.' },
      { titulo: 'Logs no estructurados en eLab', sistema: 'eLab', severidad: 'low', riesgo: 'Monitoreo', urgencia: 25, estado: 'abierta', trimestre_roadmap: 'Q1 2027', descripcion: 'console.log en producción. Sin correlación de requests. Dificulta debugging en incidentes.' },
    ])
  }

  await DeudaTecnica.deleteMany({ titulo: /AWS/i })

  if (epCount === 0) {
    await ApiEndpointIT.insertMany([
      { grupo: 'eTickets', metodo: 'GET', path: '/api/v1/tickets', descripcion: 'Listar tickets', orden: 1 },
      { grupo: 'eTickets', metodo: 'POST', path: '/api/v1/tickets', descripcion: 'Crear ticket', orden: 2 },
      { grupo: 'eTickets', metodo: 'GET', path: '/api/v1/tickets/:id', descripcion: 'Detalle de ticket', orden: 3 },
      { grupo: 'eTickets', metodo: 'PUT', path: '/api/v1/tickets/:id/status', descripcion: 'Cambiar estado', orden: 4 },
      { grupo: 'eProc', metodo: 'GET', path: '/api/v1/purchases/orders', descripcion: 'Órdenes de compra', orden: 1 },
      { grupo: 'eProc', metodo: 'POST', path: '/api/v1/purchases/approve', descripcion: 'Aprobar orden', orden: 2 },
      { grupo: 'eProc', metodo: 'GET', path: '/api/v1/suppliers', descripcion: 'Proveedores', orden: 3 },
      { grupo: 'SAP B1 Proxy', metodo: 'GET', path: '/api/v1/sap/items/:code', descripcion: 'Artículo SAP', orden: 1 },
      { grupo: 'SAP B1 Proxy', metodo: 'GET', path: '/api/v1/sap/partners/:id', descripcion: 'Business Partner', orden: 2 },
      { grupo: 'SAP B1 Proxy', metodo: 'POST', path: '/api/v1/sap/invoices', descripcion: 'Crear factura', orden: 3 },
      { grupo: 'Auth', metodo: 'POST', path: '/api/v1/auth/login', descripcion: 'Login corporativo (AD/LDAP)', orden: 1 },
      { grupo: 'Auth', metodo: 'POST', path: '/api/v1/auth/refresh', descripcion: 'Refresh token', orden: 2 },
      { grupo: 'Auth', metodo: 'DELETE', path: '/api/v1/auth/logout', descripcion: 'Cerrar sesión', orden: 3 },
      { grupo: 'Integración RCJ', metodo: 'POST', path: '/api/v1/integracion/sap/query', descripcion: 'Proxy lectura Service Layer', orden: 1 },
      { grupo: 'Integración RCJ', metodo: 'POST', path: '/api/v1/integracion/sap/document', descripcion: 'Crear/actualizar documento SAP', orden: 2 },
      { grupo: 'Integración RCJ', metodo: 'GET', path: '/api/v1/integracion/health', descripcion: 'Estado hub + SAP + AD', orden: 3 },
    ])
  }

  await ApiEndpointIT.updateMany(
    { grupo: 'SAP B1 Proxy' },
    { $set: { grupo: 'SAP Service Layer' } },
  )
  const epsIntegracion = [
    { grupo: 'Integración RCJ', metodo: 'POST', path: '/api/v1/integracion/sap/query', descripcion: 'Proxy lectura Service Layer', orden: 1 },
    { grupo: 'Integración RCJ', metodo: 'POST', path: '/api/v1/integracion/sap/document', descripcion: 'Crear/actualizar documento SAP', orden: 2 },
    { grupo: 'Integración RCJ', metodo: 'GET', path: '/api/v1/integracion/health', descripcion: 'Estado hub + SAP + AD', orden: 3 },
  ]
  for (const ep of epsIntegracion) {
    await ApiEndpointIT.updateOne(
      { grupo: ep.grupo, path: ep.path },
      { $set: ep },
      { upsert: true },
    )
  }

  if (clCount === 0) {
    await ChecklistItemIT.insertMany([
      { categoria: 'Seguridad', texto: 'No hay credenciales hardcodeadas en el código', orden: 1 },
      { categoria: 'Seguridad', texto: 'Inputs validados y sanitizados (Joi / class-validator)', orden: 2 },
      { categoria: 'Seguridad', texto: 'CORS configurado solo para dominios autorizados', orden: 3 },
      { categoria: 'Seguridad', texto: 'Rate limiting activo en endpoints públicos', orden: 4 },
      { categoria: 'Seguridad', texto: 'JWT validado correctamente (exp, iss, rol)', orden: 5 },
      { categoria: 'Base de Datos', texto: 'Sin SELECT *, campos explícitos siempre', orden: 1 },
      { categoria: 'Base de Datos', texto: 'Queries parametrizadas (no concatenación de strings)', orden: 2 },
      { categoria: 'Base de Datos', texto: 'Índices apropiados en campos de búsqueda frecuente', orden: 3 },
      { categoria: 'Arquitectura', texto: 'Lógica de negocio en Services, no en Controllers', orden: 1 },
      { categoria: 'Arquitectura', texto: 'Variables de entorno en .env (nunca en código)', orden: 2 },
      { categoria: 'Arquitectura', texto: 'Manejo de errores centralizado (filters/interceptors)', orden: 3 },
      { categoria: 'Arquitectura', texto: 'Logs estructurados con Winston (no console.log en prod)', orden: 4 },
      { categoria: 'Integraciones', texto: 'Retry logic con backoff exponencial en llamadas externas', orden: 1 },
      { categoria: 'Integraciones', texto: 'Timeout definido en todas las llamadas a servicios externos', orden: 2 },
      { categoria: 'Integraciones', texto: 'Auditoría de operaciones críticas (SAP B1, eCash)', orden: 3 },
      { categoria: 'Integraciones', texto: 'Autenticación vía AD/Entra (no usuarios locales en prod)', orden: 4 },
      { categoria: 'Integraciones', texto: 'Llamadas a SAP B1 Cloud solo por Service Layer con usuario de integración', orden: 5 },
    ])
  }
}

function sistemasITIniciales() {
  return [
    {
      nombre: 'SAP Business One Cloud (HANA)',
      estado: 'stable',
      stack: 'SAP B1 · SAP HANA Cloud · Service Layer',
      integraciones: 'eTickets, eProc, eCash, Capa integración RCJ',
      responsable: 'Equipo ERP / Partner SAP',
      notas:
        'ERP en la nube sobre HANA. Punto único de verdad financiero y maestros. Integración estándar: Service Layer (REST/OData) con usuario técnico dedicado; evitar DI API directo desde portales.',
      tags: ['ERP', 'HANA', 'Cloud', 'Crítico'],
      orden: 1,
    },
    {
      nombre: 'Active Directory (on-prem)',
      estado: 'stable',
      stack: 'AD DS · DNS · GPO · (opcional) Entra Connect',
      integraciones: 'Office 365, VPN, estaciones, apps internas (LDAP/Kerberos)',
      responsable: 'IT Infraestructura',
      notas:
        'Directorio corporativo RCJ. Fuente de identidad para usuarios internos. Sincronización híbrida con Entra ID para M365. Objetivo: SSO hacia portales vía LDAP o SAML/OIDC en la capa de integración.',
      tags: ['AD', 'Identidad', 'SSO', 'Crítico'],
      orden: 2,
    },
    {
      nombre: 'Capa de integración RCJ',
      estado: 'stable',
      stack: 'NestJS BFF · API Gateway · JWT · SQL Server (logs)',
      integraciones: 'SAP Service Layer, Active Directory, eTickets, eProc, eLab, eCash',
      responsable: 'Dev Team',
      notas:
        'Hub de integración entre sistemas: autentica contra AD, expone APIs unificadas y centraliza llamadas a SAP B1 Cloud. Patrón recomendado para nuevos desarrollos en lugar de conectar cada app directo a SAP.',
      tags: ['API', 'Integración', 'BFF', 'NestJS'],
      orden: 3,
    },
    {
      nombre: 'eTickets',
      estado: 'stable',
      stack: 'NestJS · React · SQL Server',
      integraciones: 'SAP B1 Cloud (Service Layer), Office 365, AD/SSO',
      responsable: 'Dev Team',
      notas: 'Arquitectura limpia NestJS. Modelo de referencia para otros portales. Adjuntos en file server / Azure Files (no dependencia de nube AWS).',
      tags: ['NestJS', 'React', 'Tickets', 'Estable'],
      orden: 4,
    },
    {
      nombre: 'eProc',
      estado: 'warning',
      stack: 'Node.js · React · SQL Server',
      integraciones: 'SAP B1 Cloud, proveedores externos, AD',
      responsable: 'Dev Team',
      notas: 'Lógica mezclada en controllers. Refactorizar hacia capa de integración y Service Layer SAP. Prioridad Q4 2026.',
      tags: ['Procurement', 'Deuda', 'Refactorizar'],
      orden: 5,
    },
    {
      nombre: 'eLab',
      estado: 'stable',
      stack: 'Node.js · React · MongoDB',
      integraciones: 'SQL Server, SAP B1 (lectura maestros vía integración)',
      responsable: 'Dev Team',
      notas: 'Gestión de laboratorio. Logs pendientes de estructurar. Datos operativos en MongoDB; maestros vía hub RCJ.',
      tags: ['Lab', 'MongoDB', 'React', 'Estable'],
      orden: 6,
    },
    {
      nombre: 'eCash',
      estado: 'warning',
      stack: 'Node.js · React · SQL Server',
      integraciones: 'SAP B1 Cloud, bancos, AD',
      responsable: 'Dev Team',
      notas: 'Procesos de cierre aún manuales. Toda escritura financiera debe pasar por Service Layer con trazabilidad.',
      tags: ['Cash', 'Financiero', 'Parcial'],
      orden: 7,
    },
    {
      nombre: 'IIS Windows Server',
      estado: 'legacy',
      stack: 'IIS · ASP.NET / aplicaciones legacy',
      integraciones: 'Sistemas internos legacy, SQL Server on-prem',
      responsable: 'IT Ops',
      notas: 'Sin actualizar. Migración a Ubuntu+Nginx planificada Q3 2026. Mantener fuera del perímetro SAP hasta migrar.',
      tags: ['Legacy', 'Windows', 'Migrar'],
      orden: 8,
    },
    {
      nombre: 'Office 365 / M365',
      estado: 'stable',
      stack: 'M365 · Exchange · Entra ID · Power Automate',
      integraciones: 'Active Directory, eTickets, Teams, Power BI',
      responsable: 'IT Admin',
      notas: 'Colaboración y flujos de aprobación. Identidad sincronizada desde AD. No sustituye al ERP SAP.',
      tags: ['M365', 'Entra', 'Power Automate', 'Teams'],
      orden: 9,
    },
  ]
}

/** Elimina referencias AWS y alinea catálogo con SAP Cloud + HANA + AD. */
async function migrarArquitecturaSinAWS(): Promise<void> {
  await SistemaIT.deleteMany({
    nombre: { $in: ['AWS Cloud', 'SAP Business One HANA'] },
  })

  const catalogo = sistemasITIniciales()
  for (const s of catalogo) {
    await SistemaIT.updateOne({ nombre: s.nombre }, { $set: s }, { upsert: true })
  }

  const conAws = await SistemaIT.find({
    $or: [
      { integraciones: /AWS/i },
      { stack: /AWS|EC2|S3|CloudWatch/i },
      { notas: /AWS/i },
      { tags: /AWS|EC2|S3|RDS/i },
    ],
  }).lean()

  for (const doc of conAws) {
    const patch: Record<string, unknown> = {}
    if (typeof doc.integraciones === 'string' && /AWS/i.test(doc.integraciones)) {
      patch.integraciones = doc.integraciones
        .replace(/AWS S3/gi, 'file server corporativo')
        .replace(/,?\s*AWS\b/gi, '')
        .replace(/^\s*,\s*/, '')
    }
    if (typeof doc.stack === 'string' && /AWS|EC2|S3/i.test(doc.stack)) {
      patch.stack = doc.stack.replace(/EC2 · RDS · S3 · CloudWatch/gi, 'retirado — ver SAP Cloud + AD')
    }
    if (Array.isArray(doc.tags)) {
      patch.tags = doc.tags.filter((t) => !/^(AWS|EC2|S3|RDS|CloudWatch)$/i.test(String(t)))
    }
    if (Object.keys(patch).length > 0) {
      await SistemaIT.updateOne({ _id: doc._id }, { $set: patch })
    }
  }

  const deudasNuevas = [
    {
      titulo: 'Identidad dispersa entre AD y aplicaciones',
      sistema: 'Active Directory',
      severidad: 'medium',
      riesgo: 'Seguridad',
      urgencia: 55,
      estado: 'abierta',
      trimestre_roadmap: 'Q3 2026',
      descripcion:
        'SSO no unificado en todos los portales. Algunos sistemas con credenciales locales. Objetivo: LDAP/Entra + JWT centralizado vía capa de integración.',
    },
    {
      titulo: 'Contratos de integración SAP Service Layer sin catálogo',
      sistema: 'SAP B1 Cloud',
      severidad: 'medium',
      riesgo: 'Operacional',
      urgencia: 50,
      estado: 'abierta',
      trimestre_roadmap: 'Q4 2026',
      descripcion:
        'Llamadas directas a SAP desde varias apps sin estándar único de errores, reintentos y auditoría.',
    },
  ]
  for (const d of deudasNuevas) {
    await DeudaTecnica.updateOne({ titulo: d.titulo }, { $set: d }, { upsert: true })
  }
}

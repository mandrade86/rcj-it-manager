/** Textos de descriptor de puesto (RH-F-04). Ampliable cuando se digitalicen los PDF oficiales. */
export type DescriptorPuesto = {
  codigo_puesto: string
  titulo: string
  reporta_a: string
  objetivo: string
  requisitos: string[]
  autoridad: string[]
}

const DESCRIPTORES: Record<string, DescriptorPuesto> = {
  'IT-01': {
    codigo_puesto: 'IT-01',
    titulo: 'Jefe de IT',
    reporta_a: 'Gerencia General',
    objetivo:
      'Dirección estratégica del área de tecnología del grupo RCJ: alinear TI con el negocio, asegurar continuidad operativa, ciberseguridad y eficiencia del gasto.',
    requisitos: [
      'Experiencia comprobable en liderazgo de TI en entornos multisociedad.',
      'Visión de arquitectura, seguridad, operaciones y gestión de proyectos.',
      'Comunicación ejecutiva y gestión de proveedores críticos.',
    ],
    autoridad: [
      'Definir prioridades del portafolio IT y escalamiento a dirección.',
      'Aprobar políticas operativas de TI y coordinación con RRHH en talento IT.',
    ],
  },
  'IT-02': {
    codigo_puesto: 'IT-02',
    titulo: 'Coordinador de Desarrollo IT',
    reporta_a: 'Jefe de IT',
    objetivo:
      'Liderar el frente de desarrollo de software: calidad, integraciones, prácticas de ingeniería y entrega alineada al plan corporativo.',
    requisitos: [
      'Sólida experiencia en desarrollo y arquitectura de software.',
      'Dominio de control de versiones, CI/CD y revisiones de código.',
      'Capacidad de mentoring y priorización con negocio.',
    ],
    autoridad: [
      'Asignar trabajo técnico al equipo de desarrollo bajo su frente.',
      'Proponer estándares de desarrollo y herramientas.',
    ],
  },
  'IT-03': {
    codigo_puesto: 'IT-03',
    titulo: 'Coordinador de Infraestructura IT',
    reporta_a: 'Jefe de IT',
    objetivo:
      'Garantizar operación estable de infraestructura, redes, plataformas y soporte escalonado (N1/N2) con foco en SLA y seguridad.',
    requisitos: [
      'Experiencia en infraestructura híbrida, virtualización y redes.',
      'Gestión de incidentes, cambios y continuidad del negocio.',
      'Comunicación con proveedores de hosting, conectividad y seguridad.',
    ],
    autoridad: [
      'Coordinar rotaciones, guardias y prioridad de incidentes de infraestructura.',
      'Validar cambios de alto impacto en producción.',
    ],
  },
  'IT-04A': {
    codigo_puesto: 'IT-04A',
    titulo: 'Programador Junior',
    reporta_a: 'Coordinador de Desarrollo IT',
    objetivo:
      'Desarrollar y mantener componentes de software bajo supervisión, aplicando buenas prácticas básicas y aprendiendo el dominio del negocio.',
    requisitos: [
      'Fundamentos de programación, bases de datos y control de versiones.',
      'Actitud de aprendizaje y trabajo en equipo.',
    ],
    autoridad: ['Ejecutar tareas técnicas asignadas y documentar resultados.'],
  },
  'IT-04B': {
    codigo_puesto: 'IT-04B',
    titulo: 'Programador Mid-Senior',
    reporta_a: 'Coordinador de Desarrollo IT',
    objetivo:
      'Diseñar e implementar soluciones de mediana complejidad, apoyar juniors y asegurar calidad técnica en módulos asignados.',
    requisitos: [
      'Experiencia sólida en stack acordado por el área y patrones de diseño.',
      'Pruebas automatizadas, revisión de código y resolución de deuda técnica.',
    ],
    autoridad: [
      'Proponer diseños técnicos dentro del alcance de su módulo.',
      'Mentoría técnica a programadores junior.',
    ],
  },
  'IT-04C': {
    codigo_puesto: 'IT-04C',
    titulo: 'Programador Senior',
    reporta_a: 'Coordinador de Desarrollo IT',
    objetivo:
      'Referencia técnica en diseño crítico, integraciones y excelencia de ingeniería; reduce riesgos en entregas de alto impacto.',
    requisitos: [
      'Trayectoria comprobable en soluciones complejas y producción estable.',
      'Visión de seguridad, rendimiento y observabilidad.',
    ],
    autoridad: [
      'Liderar decisiones técnicas en iniciativas asignadas.',
      'Validar arquitecturas y apoyo a coordinación en estimaciones.',
    ],
  },
  'IT-06A': {
    codigo_puesto: 'IT-06A',
    titulo: 'Oficial de Soporte Técnico N1',
    reporta_a: 'Coordinador de Infraestructura IT',
    objetivo:
      'Primer contacto de soporte: registro, clasificación y resolución de incidencias de nivel 1 según catálogo y SLAs.',
    requisitos: [
      'Conocimiento de escritorio, redes básicas y ticketing.',
      'Orientación al usuario y comunicación clara.',
    ],
    autoridad: ['Ejecutar procedimientos N1 documentados y escalar a N2 cuando aplique.'],
  },
  'IT-06B': {
    codigo_puesto: 'IT-06B',
    titulo: 'Oficial de Soporte Técnico N2',
    reporta_a: 'Coordinador de Infraestructura IT',
    objetivo:
      'Resolución de incidentes avanzados, cambios técnicos y apoyo a infraestructura bajo lineamientos del coordinador.',
    requisitos: [
      'Experiencia en troubleshooting de servidores, redes y aplicaciones corporativas.',
      'Documentación de causa raíz y propuestas de mejora.',
    ],
    autoridad: [
      'Ejecutar cambios de complejidad media según ventanas aprobadas.',
      'Coordinar con proveedores técnicos bajo delegación.',
    ],
  },
}

export function getDescriptorPuesto(codigo_puesto: string): DescriptorPuesto | null {
  return DESCRIPTORES[codigo_puesto] ?? null
}

# Resumen — Metas departamento IT y plan de trabajo

**Departamento:** IT (DEP-8) · RCJ Corporación  
**Fuente:** RCJ IT Manager (MongoDB)  
**Generado:** 01/06/2026  
**Responsable plan:** Marcela Hernández (según proyectos en sistema)

---

## Resumen ejecutivo

El departamento IT tiene **5 metas estratégicas** activas vinculadas a **10 KPIs**, pero la mayoría **aún no tiene mediciones registradas** en el período actual — conviene cargar avances en el módulo KPIs para el comité y presidencia.

El **plan de trabajo 2026** contempla **15 proyectos activos** (concentrados en **Fase 1**), con **avance promedio ~26 %** en esa fase. Hay **1 tarea vencida** que requiere seguimiento. Los proyectos con mayor impulso son **PMO Gobierno IT** (65 %), **Comité IT / KPIs** (50 %), **auditoría de licencias** y **plan de capacitación** (50 % cada uno).

---

## 1. Metas estratégicas del departamento IT

| Meta | Objetivo | Meta numérica | KPIs vinculados | Avance (sistema) |
|------|-----------|---------------|-----------------|------------------|
| **Continuidad operativa** | Uptime tier, incidentes, EDR, SLA | ≥ 97 % | 5 | Sin mediciones completas |
| **Eficiencia de costos** | Reducción OPEX TI | 20 % | 1 | Sin registro |
| **Equipo** | Capacitación del equipo | 80 % | 1 | Sin registro |
| **Gobierno** | Proyectos con caso de negocio | 95 % | 1 | Sin registro |
| **Modernización** | MTTFR P1 y resolución N1 | (texto) | 2 (EDR, MFA) | Sin registro |

### KPIs por meta (detalle)

**Continuidad operativa**

- MTTFR tickets P1 — meta &lt; 4h — *sin último valor*
- Reducción incidentes críticos — -40 % — *sin registro*
- Resolución N1 — ≥ 70 % — *sin registro*
- SLA enlace WAN — Firmado — *sin registro*
- Proyectos con caso de negocio — 100 % — valor parcial registrado (revisar unidad)

**Eficiencia de costos**

- Reducción OPEX TI — 15–25 % — *sin registro*

**Equipo**

- Capacitación de equipo — meta 6 (cursos/cert.) — *sin registro*

**Gobierno**

- Gobierno de TI — *meta no definida en KPI*

**Modernización**

- Cobertura EDR — ≥ 98 % — *sin registro*
- Usuarios con MFA — 100 % — *sin registro*

**Acción recomendada:** registrar valores mensuales en **KPIs / Metas** para habilitar gauges del dashboard y el comité IT.

---

## 2. Plan de trabajo (portafolio de proyectos)

| Indicador | Valor |
|-----------|--------|
| Proyectos totales | 15 |
| Proyectos activos | 15 |
| Tareas vencidas | 1 |
| Fase 1 — proyectos / avance prom. | 13 / **26 %** |
| Fase 2 — proyectos / avance prom. | 1 / **13 %** |
| Fase 3 | 0 proyectos |

### En progreso (prioridad alta)

| ID | Proyecto | Eje | Avance | Fin planificado |
|----|----------|-----|--------|-----------------|
| GOV-001 | PMO Gobierno IT y control de portafolio | Gobierno IT | **65 %** | 31/08/2026 |
| GOV-002 | Comité IT mensual y revisión de KPIs | Gobierno IT | **50 %** | 31/12/2026 |
| MOD-001 | Plataforma de monitoreo centralizado IT | Modernización | **13 %** | 30/09/2026 |

### Planificados con avance inicial (prioridad alta)

| ID | Proyecto | Avance | Meta / KPI del proyecto |
|----|----------|--------|-------------------------|
| EFI-001 | Auditoría y optimización de licencias IT | 50 % | Reducción ≥ 15 % licencias |
| CON-002 | Gestión formal de incidentes IT | 25 % | 0 P1 sin protocolo |
| SOF-002 | Estandarización stack tecnológico RCJ | 25 % | Stack en 100 % proyectos nuevos |
| INF-001 | Migración a Cloud | 7 % | 3 servicios/ambientes AWS Fase 1 |
| CON-001 | SLA WAN medición y cumplimiento | 8 % | WAN ≥ 99.5 % |

### Sin avance aún (0 %) — atención Q3 2026

- MOD-002 — Proceso soporte y métricas N1  
- MOD-003 — Reducción MTTFR P1  
- SOF-001 — Inventario deuda técnica  
- INF-002 — Plan DRP corporativo  

### Prioridad media (muestra)

| ID | Proyecto | Avance |
|----|----------|--------|
| EQU-001 | Plan capacitación técnica IT 2026 | 50 % |
| SOF-003 | Documentación sistemas in-house | 42 % |
| EFI-002 | Consolidación proveedores IT | 17 % |

---

## 3. Alineación metas ↔ plan de trabajo

| Meta departamento | Proyectos que la impulsan |
|-------------------|---------------------------|
| Continuidad | CON-001, CON-002, INF-002 |
| Modernización | MOD-001, MOD-002, MOD-003, SOF-001, SOF-002, INF-001 |
| Eficiencia costos | EFI-001, EFI-002 |
| Gobierno | GOV-001, GOV-002, SOF-003 |
| Equipo | EQU-001 |

---

## 4. Equipo IT en sistema

Solo **1 colaborador** aparece con `departamento_id` = IT en la ficha actual (Kevin Alexis Funes Zambrano). Otros miembros del equipo pueden estar sin departamento asignado en **Equipo → Maestros**; conviene alinear para reportes de capacitación y planes de carrera.

---

## 5. Próximos pasos sugeridos (Jefatura IT)

1. **Registrar KPIs** de mayo/junio 2026 (EDR, MFA, MTTFR, OPEX, capacitación).  
2. **Cerrar la tarea vencida** y revisar cronograma de MOD-002 / MOD-003.  
3. **Comité IT:** presentar avance GOV-001 y GOV-002 con % reales de metas.  
4. **EFI-001** en ventana jul/2026 — priorizar entregable de auditoría de licencias.  
5. Revisar asignación de **departamento IT** en colaboradores para dashboards completos.

---

*Documento generado desde `npx tsx server/scripts/resumenDeptIT.ts`. Actualizar ejecutando el script tras cambios en la app.*

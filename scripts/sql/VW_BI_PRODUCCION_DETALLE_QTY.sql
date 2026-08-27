-- =============================================================================
-- RCJ_BI — VW_BI_PRODUCCION_DETALLE_QTY
-- Detalle de OP: 1 fila por componente (plan + emitido).
-- Fuentes SAP B1: OWOR (cabecera) + WOR1 (componentes) + OITM (nombres).
--
-- IMPORTANTE
-- 1) Reemplace SCHEMA_B1 por el esquema de la compañía SAP B1 en HANA
--    (el mismo que usan VW_BI_PRODUCCION / VW_BI_CONSUMO_REAL_PRODUCCION).
-- 2) Ejecutar como usuario con CREATE VIEW en RCJ_BI y SELECT sobre SCHEMA_B1.
-- 3) Tras crear: GRANT SELECT ON "RCJ_BI"."VW_BI_PRODUCCION_DETALLE_QTY" TO B2User;
-- =============================================================================

-- Ejemplo: si la compañía está en esquema "SBODEMOUS" o "RCJHND", use ese nombre.
-- DEFINE SCHEMA_B1 = 'SU_ESQUEMA_COMPANIA';

-- =============================================================================
-- Cómo descubrir SCHEMA_B1 (si no lo conoce):
-- =============================================================================
-- SELECT DISTINCT SCHEMA_NAME, VIEW_NAME
-- FROM SYS.VIEWS
-- WHERE VIEW_NAME IN ('OWOR','WOR1') OR VIEW_NAME LIKE 'VW_BI_PRODUCCION%';
--
-- O revise la definición de una vista ya existente:
-- SELECT DEFINITION FROM SYS.VIEWS
-- WHERE SCHEMA_NAME = 'RCJ_BI' AND VIEW_NAME = 'VW_BI_PRODUCCION';
-- =============================================================================

DROP VIEW "RCJ_BI"."VW_BI_PRODUCCION_DETALLE_QTY";

CREATE VIEW "RCJ_BI"."VW_BI_PRODUCCION_DETALLE_QTY" AS
SELECT
    T0."DocEntry"                                          AS "DocEntry",
    T0."DocNum"                                            AS "DocNum",
    T0."ItemCode"                                          AS "ItemCodePT",
    IFNULL(PT."ItemName", T0."ItemCode")                   AS "ProductoTerminado",
    T0."PostDate"                                          AS "FechaContab",
    TO_VARCHAR(T0."PostDate", 'YYYY-MM')                   AS "Periodo",
    T0."Warehouse"                                         AS "AlmacenPT",
    T0."Status"                                            AS "Status",
    CASE T0."Status"
        WHEN 'P' THEN 'Planificada'
        WHEN 'R' THEN 'Liberada'
        WHEN 'L' THEN 'Cerrada'
        WHEN 'C' THEN 'Cancelada'
        ELSE TO_VARCHAR(T0."Status")
    END                                                    AS "Estado",
    IFNULL(T0."PlannedQty", 0)                             AS "CantPlanificadaPT",
    IFNULL(T0."CmpltQty", 0)                               AS "CantProducidaPT",

    /* --- Componente (siempre una fila, aunque CantEmitida = 0) --- */
    T1."LineNum"                                           AS "LineNum",
    T1."ItemCode"                                          AS "ComponenteCode",
    IFNULL(C."ItemName", T1."ItemCode")                    AS "ComponenteNombre",
    IFNULL(T1."UomCode", C."InvntryUom")                   AS "Unidad",
    T1."wareHouse"                                         AS "AlmacenComp",

    /* Plan según OP (WOR1) */
    IFNULL(T1."PlannedQty", 0)                             AS "CantPlanComponente",
    IFNULL(T1."BaseQty", 0)                                AS "CantBaseComponente",

    /* Real emitido según SAP (WOR1.IssuedQty se actualiza con las emisiones) */
    IFNULL(T1."IssuedQty", 0)                              AS "CantEmitida",

    /* Variación de cantidad: emitido − plan */
    IFNULL(T1."IssuedQty", 0) - IFNULL(T1."PlannedQty", 0) AS "VarCantidad",

    /* Costos de línea OP (si la compañía los llena; si no, quedan 0) */
    IFNULL(T1."CompTotal", 0)                              AS "CostoPlanComponente",
    /* En muchas instalaciones el costo real por componente no está en WOR1;
       se deja 0 y se puede enriquecer luego con movimientos IGE1. */
    CAST(0 AS DECIMAL(19, 6))                              AS "CostoRealComponente"

FROM "SCHEMA_B1"."OWOR" T0
INNER JOIN "SCHEMA_B1"."WOR1" T1
    ON T1."DocEntry" = T0."DocEntry"
LEFT JOIN "SCHEMA_B1"."OITM" PT
    ON PT."ItemCode" = T0."ItemCode"
LEFT JOIN "SCHEMA_B1"."OITM" C
    ON C."ItemCode" = T1."ItemCode"
WHERE T0."Status" <> 'C';   -- excluye canceladas (opcional)

-- =============================================================================
-- Permisos (ajustar usuario de la app)
-- =============================================================================
-- GRANT SELECT ON "RCJ_BI"."VW_BI_PRODUCCION_DETALLE_QTY" TO B2User;

-- =============================================================================
-- Pruebas rápidas
-- =============================================================================
-- SELECT * FROM "RCJ_BI"."VW_BI_PRODUCCION_DETALLE_QTY"
-- WHERE "DocNum" = 337728 OR TO_VARCHAR("DocNum") LIKE '%337728'
-- ORDER BY "LineNum";
--
-- Validar OP ARPFQ-029 (2 und): MPL-0079 qty plan/emitida 200, CONS-0249 200, etc.
--
-- Debe devolver TODOS los componentes del BOM de la OP (MPL, CONS, SV),
-- con CantEmitida >= 0 (nunca omitir la fila si no hubo emisión).
-- =============================================================================

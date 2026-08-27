-- =============================================================================
-- RCJ_BI — VW_BI_RECETA_COSTO
-- Fuente: Lista de materiales SAP B1 (OITT + ITT1) — misma pantalla
--   Producción → Lista de materiales → pestaña Contenido.
--
-- Incluye Artículos (ITT1.Type = 4) y Recursos (ITT1.Type = 290, ej. SV-*).
-- CantidadPorUnidad = ITT1.Quantity / OITT.Qauntity (qty por 1 und de PT).
--
-- Reemplace SCHEMA_B1 por el esquema de compañía (ej. IA_PRODHN).
-- Tras crear: GRANT SELECT ON "RCJ_BI"."VW_BI_RECETA_COSTO" TO B2User;
-- =============================================================================

DROP VIEW "RCJ_BI"."VW_BI_RECETA_COSTO";

CREATE VIEW "RCJ_BI"."VW_BI_RECETA_COSTO" AS
SELECT
    T0."Code"                                              AS "RecetaCode",
    IFNULL(P."ItemName", T0."Code")                        AS "ItemName",
    T1."ChildNum"                                          AS "LineNum",
    CASE T1."Type"
        WHEN 4   THEN 'Artículo'
        WHEN 290 THEN 'Recurso'
        ELSE TO_VARCHAR(T1."Type")
    END                                                    AS "TipoComponente",
    T1."Code"                                              AS "ComponenteCode",
    CASE
        WHEN T1."Type" = 290 THEN IFNULL(R."ResName", T1."Code")
        ELSE IFNULL(C."ItemName", T1."Code")
    END                                                    AS "ComponenteNombre",
    /* Cantidad por 1 unidad de producto terminado (Lista de materiales) */
    CASE
        WHEN IFNULL(T0."Qauntity", 0) > 0
            THEN IFNULL(T1."Quantity", 0) / T0."Qauntity"
        ELSE IFNULL(T1."Quantity", 0)
    END                                                    AS "CantidadPorUnidad",
    CASE
        WHEN T1."Type" = 290 THEN IFNULL(NULLIF(R."UnitOfMsr", ''), 'Lps/und')
        ELSE IFNULL(NULLIF(T1."Uom", ''), C."InvntryUom")
    END                                                    AS "UnidadMedida",
    CASE
        WHEN T1."Type" = 290 THEN
            IFNULL(R."StdCost1", 0) + IFNULL(R."StdCost2", 0)
            + IFNULL(R."StdCost3", 0) + IFNULL(R."StdCost4", 0)
            + IFNULL(R."StdCost5", 0) + IFNULL(R."StdCost6", 0)
            + IFNULL(R."StdCost7", 0) + IFNULL(R."StdCost8", 0)
            + IFNULL(R."StdCost9", 0) + IFNULL(R."StdCost10", 0)
        ELSE IFNULL(C."AvgPrice", 0)
    END                                                    AS "CostoUnitario",
    (
        CASE
            WHEN IFNULL(T0."Qauntity", 0) > 0
                THEN IFNULL(T1."Quantity", 0) / T0."Qauntity"
            ELSE IFNULL(T1."Quantity", 0)
        END
    )
    * (
        CASE
            WHEN T1."Type" = 290 THEN
                IFNULL(R."StdCost1", 0) + IFNULL(R."StdCost2", 0)
                + IFNULL(R."StdCost3", 0) + IFNULL(R."StdCost4", 0)
                + IFNULL(R."StdCost5", 0) + IFNULL(R."StdCost6", 0)
                + IFNULL(R."StdCost7", 0) + IFNULL(R."StdCost8", 0)
                + IFNULL(R."StdCost9", 0) + IFNULL(R."StdCost10", 0)
            ELSE IFNULL(C."AvgPrice", 0)
        END
    )                                                      AS "CostoLinea",
    CASE
        WHEN T1."Type" = 290 AND (
            IFNULL(R."StdCost1", 0) + IFNULL(R."StdCost2", 0)
            + IFNULL(R."StdCost3", 0) + IFNULL(R."StdCost4", 0)
            + IFNULL(R."StdCost5", 0) + IFNULL(R."StdCost6", 0)
            + IFNULL(R."StdCost7", 0) + IFNULL(R."StdCost8", 0)
            + IFNULL(R."StdCost9", 0) + IFNULL(R."StdCost10", 0)
        ) > 0 THEN 'OK'
        WHEN T1."Type" <> 290 AND IFNULL(C."AvgPrice", 0) > 0 THEN 'OK'
        ELSE 'SIN_COSTO'
    END                                                    AS "FlagCosto",
    IFNULL(T1."Warehouse", T0."ToWH")                      AS "Almacen",
    T0."TreeType"                                          AS "TipoLMat",
    IFNULL(T0."Qauntity", 1)                               AS "CantidadBasePT"
FROM "SCHEMA_B1"."OITT" T0
INNER JOIN "SCHEMA_B1"."ITT1" T1
    ON T1."Father" = T0."Code"
LEFT JOIN "SCHEMA_B1"."OITM" P
    ON P."ItemCode" = T0."Code"
LEFT JOIN "SCHEMA_B1"."OITM" C
    ON C."ItemCode" = T1."Code"
    AND T1."Type" = 4
LEFT JOIN "SCHEMA_B1"."ORSC" R
    ON R."VisResCode" = T1."Code"
    AND T1."Type" = 290
WHERE T0."TreeType" = 'P'   -- Solo Lista de materiales de Producción
;

-- GRANT SELECT ON "RCJ_BI"."VW_BI_RECETA_COSTO" TO B2User;

-- =============================================================================
-- Validación (debe coincidir con pantalla Lista de materiales → Contenido)
-- =============================================================================
-- SELECT "ComponenteCode", "ComponenteNombre", "TipoComponente",
--        "CantidadPorUnidad", "UnidadMedida", "CostoUnitario", "FlagCosto"
-- FROM "RCJ_BI"."VW_BI_RECETA_COSTO"
-- WHERE "RecetaCode" = 'ALMB-006'
-- ORDER BY "LineNum";
--
-- Esperado (Cantidad PT = 1 en SAP):
--   CONS-0227A  Agua Procesada Tipo II MB     141.66 ml
--   MPL-0210    Agar Baird Parker               2.44 g
--   MPL-0219    Caldo Agua Peptona              0.164 g
--   MPL-0222    Caldo Casoy                     0.012 g
--   MPL-0231    Yema de huevo con Tellurito     2.100 ml
--   MPL-0239    Coagulasa plasma …              1 ml
--   MPL-0308 … MPL-0388, SV-C0008               1 und / Lps/und
-- =============================================================================
-- SELECT "ComponenteCode", "CantidadPorUnidad"
-- FROM "RCJ_BI"."VW_BI_RECETA_COSTO"
-- WHERE "RecetaCode" = 'ARPFQ-029'
-- ORDER BY "LineNum";
-- =============================================================================

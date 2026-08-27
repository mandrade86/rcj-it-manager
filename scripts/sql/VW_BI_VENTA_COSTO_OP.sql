-- =============================================================================
-- RCJ_BI — Opción A (v2) — reemplazar vistas (CREATE OR REPLACE)
-- Ejecutar TODO este bloque. No hace falta DROP.
-- =============================================================================

CREATE OR REPLACE VIEW "RCJ_BI"."VW_BI_MAP_VENTA_OP" AS
SELECT
    X."InvDocEntry",
    X."Factura",
    X."Fecha",
    X."CardCode",
    X."CardName",
    X."LineNum",
    X."RecetaCode",
    X."RecetaNombre",
    X."Cantidad",
    X."Venta",
    X."CostoReal",
    X."OrdenProd",
    X."OrdenId",
    X."OrigenLink"
FROM (
    SELECT
        T0."DocEntry"                          AS "InvDocEntry",
        T0."DocNum"                            AS "Factura",
        T0."DocDate"                           AS "Fecha",
        T0."CardCode"                          AS "CardCode",
        T0."CardName"                          AS "CardName",
        T1."LineNum"                           AS "LineNum",
        T1."ItemCode"                          AS "RecetaCode",
        IFNULL(T1."Dscription", T1."ItemCode") AS "RecetaNombre",
        IFNULL(T1."Quantity", 0)               AS "Cantidad",
        IFNULL(T1."LineTotal", 0)              AS "Venta",
        IFNULL(T1."StockSum",
               IFNULL(T1."GrossBuyPr", 0) * IFNULL(T1."Quantity", 0)) AS "CostoReal",
        W."DocNum"                             AS "OrdenProd",
        W."DocEntry"                           AS "OrdenId",
        CASE WHEN W."DocNum" IS NULL THEN NULL
             ELSE 'OP por Item+Fecha (<= factura, -30d)' END AS "OrigenLink",
        ROW_NUMBER() OVER (
            PARTITION BY T0."DocEntry", T1."LineNum"
            ORDER BY DAYS_BETWEEN(W."PostDate", T0."DocDate") ASC, W."DocNum" DESC
        ) AS "RN"
    FROM "IA_PRODHN"."OINV" T0
    INNER JOIN "IA_PRODHN"."INV1" T1
        ON T1."DocEntry" = T0."DocEntry"
    LEFT JOIN "IA_PRODHN"."OWOR" W
        ON W."ItemCode" = T1."ItemCode"
       AND W."Status" <> 'C'
       AND IFNULL(W."CmpltQty", 0) > 0
       AND W."PostDate" BETWEEN ADD_DAYS(T0."DocDate", -30) AND T0."DocDate"
    WHERE T0."CANCELED" = 'N'
      AND IFNULL(T1."ItemCode", '') <> ''
) X
WHERE X."RN" = 1;

CREATE OR REPLACE VIEW "RCJ_BI"."VW_BI_VENTA_COSTO_OP" AS
SELECT
    'HN'                               AS "Empresa",
    M."Fecha"                          AS "Fecha",
    TO_VARCHAR(M."Fecha", 'YYYY-MM')   AS "Periodo",
    M."CardCode"                       AS "CardCode",
    M."CardName"                       AS "CardName",
    IFNULL(TO_VARCHAR(C."GroupCode"), '') AS "GrupoCliente",
    M."RecetaCode"                     AS "RecetaCode",
    M."RecetaNombre"                   AS "RecetaNombre",
    M."Cantidad"                       AS "Cantidad",
    M."Venta"                          AS "Venta",
    M."CostoReal"                      AS "CostoReal",
    M."Venta" - M."CostoReal"          AS "Margen",
    TO_VARCHAR(M."Factura")            AS "Factura",
    TO_VARCHAR(M."OrdenProd")          AS "OrdenProd",
    M."OrigenLink"                     AS "OrigenLink"
FROM "RCJ_BI"."VW_BI_MAP_VENTA_OP" M
LEFT JOIN "IA_PRODHN"."OCRD" C
    ON C."CardCode" = M."CardCode";

-- Validar: CON_OP debe ser > 0
-- SELECT COUNT(*) TOTAL,
--   SUM(CASE WHEN "OrdenProd" IS NOT NULL THEN 1 ELSE 0 END) CON_OP
-- FROM "RCJ_BI"."VW_BI_VENTA_COSTO_OP";

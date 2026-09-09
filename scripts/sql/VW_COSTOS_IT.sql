-- Referencia: vista SAP HANA para control de gastos del departamento IT
-- En RCJ la vista vive en esquema TS_ZOLIHN (no RCJ_BI).
-- La app detecta automáticamente columnas y puede auto-descubrir la vista.

CREATE OR REPLACE VIEW VW_COSTOS_IT AS
SELECT
    T0."DocDate"                              AS "Fecha",
    ABS(T0."Debit" - T0."Credit")             AS "Monto",
    COALESCE(T0."LineMemo", T1."AcctName")      AS "Descripcion",
    T2."CardName"                             AS "Proveedor",
    T0."TransId"                              AS "DocNum",
    T0."Account"                              AS "Cuenta",
    T3."BPLName"                              AS "Empresa",
    T4."PrcName"                              AS "Categoria",
    T5."OcrName"                              AS "Departamento",
    T0."TransType"                            AS "TipoDoc"
FROM "JDT1" T0
LEFT JOIN "OACT" T1 ON T1."AcctCode" = T0."Account"
LEFT JOIN "OCRD" T2 ON T2."CardCode" = T0."ShortName"
LEFT JOIN "OBPL" T3 ON T3."BPLId" = T0."BPLId"
LEFT JOIN "OPRC" T4 ON T4."PrcCode" = T0."ProfitCode"
LEFT JOIN "OOCR" T5 ON T5."OcrCode" = T0."OcrCode2"
WHERE T5."OcrName" LIKE '%IT%'
   OR T0."OcrCode2" IN ('IT', 'TECNOLOGIA');

-- Notas:
-- 1. Filtre por centro de costo / dimensión del departamento IT según su catálogo SAP.
-- 2. Si la vista ya existe con otros nombres, la app mapeará columnas en /api/costos-it/vista-columnas.
-- 3. Conexión SAP reutiliza la configuración de BI Costeo (SAP_BI_* en .env).

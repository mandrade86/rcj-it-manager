-- Referencia: vista SAP HANA de presupuesto IT
-- Consulta equivalente: SELECT * FROM "TS_VW_BUDGET_IT"
-- La app expone esta vista en Presupuesto IT → tab "Vista SAP (TS_VW_BUDGET_IT)"
-- Endpoint: GET /api/costos-it/budget-sap
--
-- Columnas típicas observadas:
--   Empresa, Año, Numero de Cuenta, Nombre de Cuenta, Centro de costo,
--   Planificado Enero, Ejecutado Enero, … Planificado Diciembre, Ejecutado Diciembre
--
-- Al hacer clic en una fila (Numero de Cuenta) se cargan los gastos reales
-- desde la vista de costos IT (GET /api/costos-it/gastos-por-cuenta).

-- Opcional en .env (producción Docker):
-- SAP_BUDGET_IT_VIEW=TS_VW_BUDGET_IT
-- SAP_BUDGET_IT_SCHEMA=TS_ZOLIHN
--
-- Importante: no usar RCJ_BI aquí. Esa vista suele estar en el esquema de compañía SAP B1.

SELECT * FROM "TS_VW_BUDGET_IT";

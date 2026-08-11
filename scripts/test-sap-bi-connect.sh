#!/usr/bin/env bash
# Prueba conectividad desde el contenedor app hacia SQL Server SAP (Ubuntu + Docker).
# Uso en servidor:
#   docker compose -f docker-compose.prod.yml --env-file .env.production exec app bash scripts/test-sap-bi-connect.sh
set -euo pipefail

HOST="${SAP_BI_HOST:-}"
PORT="${SAP_BI_PORT:-30015}"

if [[ -z "$HOST" ]]; then
  echo "SAP_BI_HOST no definido. Configure .env.production o la app (BI → Configuración SAP)."
  exit 1
fi

echo "=== RCJ IT Manager — diagnóstico SAP BI ==="
echo "Host: ${HOST}:${PORT}"
echo ""

if command -v getent >/dev/null 2>&1; then
  echo "DNS:"
  getent hosts "$HOST" || echo "  (getent hosts falló — revisar DNS del contenedor)"
  echo ""
fi

echo "Puerto TCP (timeout 5s):"
if command -v bash >/dev/null 2>&1; then
  if timeout 5 bash -c "echo >/dev/tcp/${HOST}/${PORT}" 2>/dev/null; then
    echo "  OK — puerto ${PORT} alcanzable desde el contenedor"
  else
    echo "  FALLO — no se pudo abrir TCP ${HOST}:${PORT}"
    echo "  Revise: firewall Ubuntu (ufw), reglas del servidor SAP, VLAN/routing."
    exit 2
  fi
else
  echo "  (bash /dev/tcp no disponible; omitiendo prueba de puerto)"
fi

echo ""
echo "Prueba API interna (requiere MongoDB + config SAP):"
node -e "
fetch('http://127.0.0.1:3001/api/health')
  .then(r => r.json())
  .then(j => console.log('  Health:', JSON.stringify(j)))
  .catch(e => console.log('  Health falló:', e.message));
"

echo ""
echo "Para probar lectura de vista: use BI → Configuración SAP → Probar conexión en la app."

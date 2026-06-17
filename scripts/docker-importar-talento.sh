#!/usr/bin/env bash
# Importa talento-export.json en producción aunque la imagen Docker sea anterior.
# Uso en el servidor Ubuntu (SSH):
#   cd /opt/rcj-it-manager
#   bash scripts/docker-importar-talento.sh
#
# Requiere en el host:
#   - data/talento-export.json
#   - server/scripts/importarTalento.ts (git pull o scp desde tu PC)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
JSON_FILE="${JSON_FILE:-/app/data/talento-export.json}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE en $ROOT"
  exit 1
fi

if [[ ! -f data/talento-export.json ]]; then
  echo "No existe data/talento-export.json — copia el export desde tu PC primero."
  exit 1
fi

REQUIRED=(
  server/scripts/importarTalento.ts
  server/scripts/exportarTalento.ts
  server/scripts/diagnosticarTalento.ts
  server/utils/talentoExportImport.ts
)

for f in "${REQUIRED[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Falta $f en el servidor."
    echo "Ejecuta: git pull"
    echo "O copia desde tu PC los archivos server/scripts/*Talento* y server/utils/talentoExportImport.ts"
    exit 1
  fi
done

APP_ID="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q app)"
if [[ -z "$APP_ID" ]]; then
  echo "El contenedor app no está corriendo. Levanta con:"
  echo "  docker compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
  exit 1
fi

echo "Copiando scripts al contenedor $APP_ID …"
for f in "${REQUIRED[@]}"; do
  docker cp "$f" "$APP_ID:/app/$f"
done

echo "Diagnóstico previo …"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app \
  npx tsx server/scripts/diagnosticarTalento.ts --file "$JSON_FILE"

echo "Importando …"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app \
  npx tsx server/scripts/importarTalento.ts --file "$JSON_FILE"

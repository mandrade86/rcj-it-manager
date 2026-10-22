#!/usr/bin/env bash
# Exporta una base Mongo desde compose o desde URI.
#
# Uso:
#   bash scripts/mongo-export.sh
#   bash scripts/mongo-export.sh --dev
#   bash scripts/mongo-export.sh --db rcj_it_manager_dev --compose docker-compose.dev.yml --env-file .env.development
#   bash scripts/mongo-export.sh --uri 'mongodb://...' --db rcj_it_manager_dev
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DB=rcj_it_manager
URI=""
COMPOSE_FILE=docker-compose.prod.yml
ENV_FILE=.env.production
OUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev)
      DB=rcj_it_manager_dev
      COMPOSE_FILE=docker-compose.dev.yml
      ENV_FILE=.env.development
      shift
      ;;
    --db) DB="$2"; shift 2 ;;
    --uri) URI="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --compose) COMPOSE_FILE="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: bash scripts/mongo-export.sh [--dev] [--db NOMBRE] [--uri URI] [--out archivo.archive]"
      exit 0
      ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

OUT="${OUT:-$ROOT/data/backups/${DB}-$(date +%Y%m%d-%H%M%S).archive}"
mkdir -p "$(dirname "$OUT")"

if [[ -n "$URI" ]]; then
  echo "Exportando ${DB} desde URI…"
  docker run --rm --network host -v "$(dirname "$OUT"):/backup" mongo:7 \
    mongodump --uri="$URI" --db="$DB" --archive="/backup/$(basename "$OUT")"
else
  echo "Exportando ${DB} desde compose (${COMPOSE_FILE})…"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongo \
    mongodump --db="$DB" --archive > "$OUT"
fi

echo "Listo: ${OUT}"
ls -lh "$OUT"

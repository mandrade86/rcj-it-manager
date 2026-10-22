#!/usr/bin/env bash
# Exporta la base rcj_it_manager desde el Mongo del compose (servidor actual todo-en-uno)
# o desde un MONGODB_URI remoto.
#
# Uso:
#   bash scripts/mongo-export.sh                         # desde docker-compose.prod.yml (servicio mongo)
#   bash scripts/mongo-export.sh --uri 'mongodb://...'   # URI directa
#   bash scripts/mongo-export.sh --out /tmp/rcj.archive
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${OUT:-$ROOT/data/backups/rcj_it_manager-$(date +%Y%m%d-%H%M%S).archive}"
URI=""
COMPOSE_FILE=docker-compose.prod.yml
ENV_FILE=.env.production

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uri) URI="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --compose) COMPOSE_FILE="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    -h|--help)
      echo "Uso: bash scripts/mongo-export.sh [--uri URI] [--out archivo.archive]"
      exit 0
      ;;
    *) echo "Argumento desconocido: $1"; exit 1 ;;
  esac
done

mkdir -p "$(dirname "$OUT")"

if [[ -n "$URI" ]]; then
  echo "Exportando desde URI…"
  docker run --rm --network host -v "$(dirname "$OUT"):/backup" mongo:7 \
    mongodump --uri="$URI" --db=rcj_it_manager --archive="/backup/$(basename "$OUT")"
else
  echo "Exportando desde compose (${COMPOSE_FILE}) servicio mongo…"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongo \
    mongodump --db=rcj_it_manager --archive > "$OUT"
fi

echo "Listo: ${OUT}"
ls -lh "$OUT"

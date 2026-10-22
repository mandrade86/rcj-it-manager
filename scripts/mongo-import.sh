#!/usr/bin/env bash
# Restaura un archive de mongodump en el Mongo del servidor de BD.
#
# Uso:
#   bash scripts/mongo-import.sh archivo.archive
#   bash scripts/mongo-import.sh archivo.archive --dev
#   bash scripts/mongo-import.sh archivo.archive --db rcj_it_manager_dev --compose docker-compose.dev-mongo.yml --env-file .env.mongo.dev --drop
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCHIVE=""
URI=""
DB=rcj_it_manager
COMPOSE_FILE=docker-compose.mongo.yml
ENV_FILE=.env.mongo
DROP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev)
      DB=rcj_it_manager_dev
      COMPOSE_FILE=docker-compose.dev-mongo.yml
      ENV_FILE=.env.mongo.dev
      shift
      ;;
    --db) DB="$2"; shift 2 ;;
    --uri) URI="$2"; shift 2 ;;
    --compose) COMPOSE_FILE="$2"; shift 2 ;;
    --env-file) ENV_FILE="$2"; shift 2 ;;
    --drop) DROP=true; shift ;;
    -h|--help)
      echo "Uso: bash scripts/mongo-import.sh archivo.archive [--dev] [--db NOMBRE] [--uri URI] [--drop]"
      exit 0
      ;;
    *)
      if [[ -z "$ARCHIVE" ]]; then ARCHIVE="$1"; shift
      else echo "Argumento desconocido: $1"; exit 1
      fi
      ;;
  esac
done

if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Indica un archivo .archive existente."
  exit 1
fi

DROP_FLAG=()
if [[ "$DROP" == true ]]; then
  DROP_FLAG=(--drop)
fi

ABS="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"

AUTH_ARGS=()
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ENV_FILE" 2>/dev/null || true
  set +a
fi
if [[ -n "${MONGO_INITDB_ROOT_USERNAME:-}" && -n "${MONGO_INITDB_ROOT_PASSWORD:-}" ]]; then
  AUTH_ARGS=(
    -u "$MONGO_INITDB_ROOT_USERNAME"
    -p "$MONGO_INITDB_ROOT_PASSWORD"
    --authenticationDatabase admin
  )
fi

NS="${DB}.*"

if [[ -n "$URI" ]]; then
  echo "Restaurando ${DB} en URI…"
  docker run --rm --network host \
    -v "$(dirname "$ABS"):/backup:ro" mongo:7 \
    mongorestore --uri="$URI" --archive="/backup/$(basename "$ABS")" --nsInclude="$NS" "${DROP_FLAG[@]}"
else
  echo "Restaurando ${DB} en compose (${COMPOSE_FILE})…"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" cp "$ABS" mongo:/tmp/restore.archive
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongo \
    mongorestore "${AUTH_ARGS[@]}" --archive=/tmp/restore.archive --nsInclude="$NS" "${DROP_FLAG[@]}"
fi

echo "Restore OK (${DB})."

#!/usr/bin/env bash
# Despliega RCJ IT Manager en Ubuntu Server (Docker)
# Uso:
#   bash scripts/deploy-ubuntu.sh                 # producción todo-en-uno (app + mongo)
#   bash scripts/deploy-ubuntu.sh --app           # prod: solo app (Mongo remoto)
#   bash scripts/deploy-ubuntu.sh --mongo         # prod: solo Mongo
#   bash scripts/deploy-ubuntu.sh --dev           # desarrollo todo-en-uno
#   bash scripts/deploy-ubuntu.sh --dev --app     # desarrollo: solo app (Mongo remoto)
#   bash scripts/deploy-ubuntu.sh --dev --mongo   # desarrollo: solo Mongo
#   bash scripts/deploy-ubuntu.sh --seed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_NAME=prod
MODE=all
SEED=false
for arg in "$@"; do
  case "$arg" in
    --dev) ENV_NAME=dev ;;
    --app) MODE=app ;;
    --mongo) MODE=mongo ;;
    --seed) SEED=true ;;
    -h|--help)
      echo "Uso: bash scripts/deploy-ubuntu.sh [--dev] [--app|--mongo] [--seed]"
      echo ""
      echo "Producción:"
      echo "  (sin flags)     docker-compose.prod.yml      + .env.production"
      echo "  --app           docker-compose.app.yml       + .env.production  (Mongo remoto)"
      echo "  --mongo         docker-compose.mongo.yml     + .env.mongo"
      echo ""
      echo "Desarrollo:"
      echo "  --dev           docker-compose.dev.yml       + .env.development"
      echo "  --dev --app     docker-compose.dev-app.yml   + .env.development (Mongo remoto)"
      echo "  --dev --mongo   docker-compose.dev-mongo.yml + .env.mongo.dev"
      echo ""
      echo "Guía: deploy/SEPARAR-APP-Y-BD.md"
      exit 0
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no está instalado. Ejecuta: sudo bash scripts/install-docker-ubuntu.sh"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Falta el plugin docker compose."
  exit 1
fi

if [[ "$ENV_NAME" == "dev" && "$MODE" == "all" ]]; then
  COMPOSE_FILE=docker-compose.dev.yml
  ENV_FILE=.env.development
  ENV_EXAMPLE=.env.development.example
  DEFAULT_PORT=3002
  URL_HINT="http://portal-dev.rcjcorporacion.com (o http://IP:${DEFAULT_PORT})"
elif [[ "$ENV_NAME" == "dev" && "$MODE" == "app" ]]; then
  COMPOSE_FILE=docker-compose.dev-app.yml
  ENV_FILE=.env.development
  ENV_EXAMPLE=.env.development.example
  DEFAULT_PORT=3002
  URL_HINT="http://portal-dev.rcjcorporacion.com (app; Mongo en otro host)"
elif [[ "$ENV_NAME" == "dev" && "$MODE" == "mongo" ]]; then
  COMPOSE_FILE=docker-compose.dev-mongo.yml
  ENV_FILE=.env.mongo.dev
  ENV_EXAMPLE=.env.mongo.dev.example
  DEFAULT_PORT=27017
  URL_HINT="MongoDB desarrollo en :${DEFAULT_PORT} (solo red interna)"
elif [[ "$ENV_NAME" == "prod" && "$MODE" == "app" ]]; then
  COMPOSE_FILE=docker-compose.app.yml
  ENV_FILE=.env.production
  ENV_EXAMPLE=.env.production.example
  DEFAULT_PORT=3001
  URL_HINT="https://portal.rcjcorp.hn (Apache en este servidor; Mongo en otro host)"
elif [[ "$ENV_NAME" == "prod" && "$MODE" == "mongo" ]]; then
  COMPOSE_FILE=docker-compose.mongo.yml
  ENV_FILE=.env.mongo
  ENV_EXAMPLE=.env.mongo.example
  DEFAULT_PORT=27017
  URL_HINT="MongoDB producción en :${DEFAULT_PORT} (solo red interna)"
else
  COMPOSE_FILE=docker-compose.prod.yml
  ENV_FILE=.env.production
  ENV_EXAMPLE=.env.production.example
  DEFAULT_PORT=3001
  URL_HINT="https://portal.rcjcorp.hn (tras configurar Apache + DNS)"
fi

LABEL="${ENV_NAME}/${MODE}"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  if [[ "$MODE" != "mongo" ]]; then
    JWT="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"
    if grep -q '^JWT_SECRET=' "$ENV_FILE"; then
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" "$ENV_FILE"
    fi
    echo "Creado ${ENV_FILE} con JWT_SECRET aleatorio."
  else
    echo "Creado ${ENV_FILE}. Edita MONGO_INITDB_ROOT_* si quieres auth."
  fi
fi

if [[ "$MODE" == "app" ]]; then
  DB_NAME_HINT="rcj_it_manager"
  [[ "$ENV_NAME" == "dev" ]] && DB_NAME_HINT="rcj_it_manager_dev"
  if ! grep -qE '^MONGODB_URI=.+' "$ENV_FILE" 2>/dev/null; then
    echo "ERROR: En modo --app debes definir MONGODB_URI en ${ENV_FILE}"
    echo "  Ejemplo: MONGODB_URI=mongodb://172.16.x.x:27017/${DB_NAME_HINT}"
    echo "  Guía: deploy/SEPARAR-APP-Y-BD.md"
    exit 1
  fi
  if grep -qE '^MONGODB_URI=mongodb://mongo:' "$ENV_FILE" 2>/dev/null; then
    echo "ERROR: MONGODB_URI apunta a 'mongo' (contenedor local). Usa la IP del servidor de BD."
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE" 2>/dev/null || true
set +a
APP_PORT="${APP_PORT:-$DEFAULT_PORT}"
MONGO_PORT="${MONGO_PORT:-27017}"

if [[ "$MODE" != "mongo" ]]; then
  mkdir -p data/certificados data/adjuntos-tareas data/adjuntos-proyectos data/backups
  chmod -R u+rwX data 2>/dev/null || true
fi

echo "Entorno: ${LABEL} | compose: ${COMPOSE_FILE}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

if [[ "$MODE" == "mongo" ]]; then
  echo "Esperando MongoDB…"
  for i in $(seq 1 40); do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongo \
      mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
      echo "MongoDB listo en puerto ${MONGO_PORT}"
      break
    fi
    sleep 2
    if [[ "$i" -eq 40 ]]; then
      echo "Timeout. Revisa: docker compose -f ${COMPOSE_FILE} logs -f mongo"
      exit 1
    fi
  done
else
  echo "Esperando healthcheck…"
  for i in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
      echo "App lista en http://127.0.0.1:${APP_PORT}"
      break
    fi
    sleep 2
    if [[ "$i" -eq 60 ]]; then
      echo "Timeout. Revisa: docker compose -f ${COMPOSE_FILE} logs -f app"
      exit 1
    fi
  done
fi

if [[ "$SEED" == true ]]; then
  if [[ "$MODE" == "mongo" ]]; then
    echo "--seed no aplica al servidor de solo Mongo."
  else
    echo "Ejecutando seed…"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app npm run seed
  fi
fi

echo ""
echo "Despliegue OK (${LABEL})."
echo "  URL:        ${URL_HINT}"
if [[ "$MODE" == "mongo" ]]; then
  echo "  Puerto:     ${MONGO_PORT}"
  echo "  Logs:       docker compose -f ${COMPOSE_FILE} logs -f mongo"
  echo "  Parar:      docker compose -f ${COMPOSE_FILE} down"
  if [[ "$ENV_NAME" == "dev" ]]; then
    echo "  Importar:   bash scripts/mongo-import.sh data/backups/archivo.archive --compose docker-compose.dev-mongo.yml --env-file .env.mongo.dev --db rcj_it_manager_dev"
  else
    echo "  Importar:   bash scripts/mongo-import.sh data/backups/archivo.archive"
  fi
else
  echo "  Health:     http://127.0.0.1:${APP_PORT}/api/health"
  echo "  Logs:       docker compose -f ${COMPOSE_FILE} logs -f app"
  echo "  Parar:      docker compose -f ${COMPOSE_FILE} down"
fi
if [[ "$MODE" != "mongo" ]]; then
  if [[ "$ENV_NAME" == "prod" ]]; then
    echo "  Apache:     sudo cp deploy/apache-portal.rcjcorp.hn.conf.example /etc/apache2/sites-available/portal.rcjcorp.hn.conf"
    echo "              sudo a2ensite portal.rcjcorp.hn.conf && sudo apachectl configtest && sudo systemctl reload apache2"
  fi
  echo "  SAP BI:     docker compose -f ${COMPOSE_FILE} exec app bash scripts/test-sap-bi-connect.sh"
fi
if [[ "$MODE" == "app" ]]; then
  echo "  Mongo URI:  (definida en ${ENV_FILE})"
fi

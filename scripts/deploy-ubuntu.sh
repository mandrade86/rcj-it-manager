#!/usr/bin/env bash
# Despliega RCJ IT Manager en Ubuntu Server (Docker)
# Uso:
#   bash scripts/deploy-ubuntu.sh              # producción (portal.rcjcorporacion.com)
#   bash scripts/deploy-ubuntu.sh --dev        # desarrollo (portal-dev.rcjcorporacion.com)
#   bash scripts/deploy-ubuntu.sh --seed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_TARGET=prod
SEED=false
for arg in "$@"; do
  case "$arg" in
    --dev) ENV_TARGET=dev ;;
    --seed) SEED=true ;;
    -h|--help)
      echo "Uso: bash scripts/deploy-ubuntu.sh [--dev] [--seed]"
      echo "  prod (default): docker-compose.prod.yml + .env.production → portal.rcjcorporacion.com"
      echo "  --dev:          docker-compose.dev.yml + .env.development → portal-dev.rcjcorporacion.com"
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

if [[ "$ENV_TARGET" == "dev" ]]; then
  COMPOSE_FILE=docker-compose.dev.yml
  ENV_FILE=.env.development
  ENV_EXAMPLE=.env.development.example
  DEFAULT_PORT=3002
  URL_HINT="http://portal-dev.rcjcorporacion.com (o http://IP:${DEFAULT_PORT})"
else
  COMPOSE_FILE=docker-compose.prod.yml
  ENV_FILE=.env.production
  ENV_EXAMPLE=.env.production.example
  DEFAULT_PORT=3001
  URL_HINT="https://portal.rcjcorp.hn (tras configurar Apache + DNS)"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  JWT="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" "$ENV_FILE"
  echo "Creado ${ENV_FILE} con JWT_SECRET aleatorio."
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE" 2>/dev/null || true
set +a
APP_PORT="${APP_PORT:-$DEFAULT_PORT}"

mkdir -p data/certificados data/adjuntos-tareas
chmod -R u+rwX data 2>/dev/null || true

echo "Entorno: ${ENV_TARGET} | compose: ${COMPOSE_FILE}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

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

if [[ "$SEED" == true ]]; then
  echo "Ejecutando seed…"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app npm run seed
fi

echo ""
echo "Despliegue OK (${ENV_TARGET})."
echo "  URL:        ${URL_HINT}"
echo "  Health:     http://127.0.0.1:${APP_PORT}/api/health"
echo "  Logs:       docker compose -f ${COMPOSE_FILE} logs -f app"
echo "  Parar:      docker compose -f ${COMPOSE_FILE} down"
if [[ "$ENV_TARGET" == "prod" ]]; then
  echo "  Apache:     sudo cp deploy/apache-portal.rcjcorp.hn.conf.example /etc/apache2/sites-available/portal.rcjcorp.hn.conf"
  echo "              sudo a2ensite portal.rcjcorp.hn.conf && sudo apachectl configtest && sudo systemctl reload apache2"
fi

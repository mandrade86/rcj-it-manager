#!/usr/bin/env bash
# Despliega RCJ IT Manager con Docker Compose en Ubuntu Server
# Uso (desde la raíz del repo):
#   bash scripts/deploy-ubuntu.sh
#   bash scripts/deploy-ubuntu.sh --seed
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SEED=false
for arg in "$@"; do
  case "$arg" in
    --seed) SEED=true ;;
    -h|--help)
      echo "Uso: bash scripts/deploy-ubuntu.sh [--seed]"
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

if [[ ! -f .env ]]; then
  cp .env.docker.example .env
  JWT="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT}|" .env
  echo "Creado .env con JWT_SECRET aleatorio. Revisa JIRA/Anthropic si los usas."
fi

set -a
# shellcheck disable=SC1091
source .env 2>/dev/null || true
set +a
APP_PORT="${APP_PORT:-3001}"

mkdir -p data/certificados data/adjuntos-tareas
chmod -R u+rwX data 2>/dev/null || true

echo "Construyendo e iniciando contenedores…"
docker compose up -d --build

echo "Esperando healthcheck de la app…"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${APP_PORT}/api/health" >/dev/null 2>&1; then
    echo "App lista en http://127.0.0.1:${APP_PORT}"
    break
  fi
  sleep 2
  if [[ "$i" -eq 60 ]]; then
    echo "Timeout esperando /api/health. Revisa: docker compose logs -f app"
    exit 1
  fi
done

if [[ "$SEED" == true ]]; then
  echo "Ejecutando seed…"
  docker compose exec -T app npm run seed
fi

echo ""
echo "Despliegue OK."
echo "  URL red:    http://$(hostname -I | awk '{print $1}'):${APP_PORT}"
echo "  Logs:       docker compose logs -f app"
echo "  Parar:      docker compose down"

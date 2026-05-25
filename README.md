# RCJ IT Manager

Aplicación web local para gestión de IT en RCJ Corporación (Honduras): Plan IT 2026, equipo, capacitaciones, OPEX, KPIs y dashboard ejecutivo.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend:** Express.js (puerto 3001)
- **Base de datos:** MongoDB local
- **Despliegue:** Docker / Ubuntu Server — ver [DOCKER.md](./DOCKER.md)

## Desarrollo local

```bash
# Requisitos: Node 22+, MongoDB en 127.0.0.1:27017
cp .env.example .env
npm install
cd client && npm install && cd ..
npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3001  

```bash
npm run seed   # datos iniciales Plan IT 2026
```

## Docker (producción)

```bash
cp .env.docker.example .env
docker compose up -d --build
# http://localhost:3001
```

Ubuntu Server: `bash scripts/deploy-ubuntu.sh` — detalle en [DOCKER.md](./DOCKER.md).

## Datos locales (no van al repositorio)

Coloca en `data/`:

- `gastos.xlsx` — módulo Gastos / OPEX
- `certificados/` — diplomas subidos
- `adjuntos-tareas/` — archivos de tareas

## Variables de entorno

Ver `.env.example` y `.env.docker.example` (`JWT_SECRET`, integraciones Jira/Anthropic opcionales).

## Licencia

Uso interno RCJ Corporación.

# ── Frontend (Vite + React) ───────────────────────────────────────────────────
FROM node:22-bookworm-slim AS client-build
WORKDIR /build/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --ignore-scripts
COPY client/ ./
RUN npm run build

# ── API + SPA estática ────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts \
  && npm rebuild bcrypt @sap/hana-client

COPY server ./server
COPY scripts ./scripts
COPY --from=client-build /build/client/dist ./client/dist

RUN mkdir -p /app/data/certificados /app/data/adjuntos-tareas /app/data/adjuntos-proyectos \
  && groupadd --system --gid 1001 appuser \
  && useradd --system --uid 1001 --gid appuser --home-dir /app --shell /usr/sbin/nologin appuser \
  && chown -R appuser:appuser /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Usa el binario local (versión fijada en package-lock), sin npx
CMD ["./node_modules/.bin/tsx", "server/index.ts"]

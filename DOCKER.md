# RCJ IT Manager — Docker (desarrollo y producción)

| Ambiente | URL | Compose | Variables |
|----------|-----|---------|-----------|
| **Producción** | `https://portal.rcjcorp.hn` | `docker-compose.prod.yml` | `.env.production` |
| **Desarrollo** | `http://portal-dev.rcjcorp.hn` (o `:3002`) | `docker-compose.dev.yml` | `.env.development` |
| **Código local** | `http://localhost:5173` | — (`npm run dev`) | `.env` |

Bases MongoDB separadas: `rcj_it_manager` (prod) y `rcj_it_manager_dev` (dev).

---

## Resumen rápido

### Producción (Ubuntu Server)

```bash
cd /opt/rcj-it-manager
git pull
cp .env.production.example .env.production   # primera vez; edita JWT_SECRET
bash scripts/deploy-ubuntu.sh
# Configurar Nginx + DNS → portal.rcjcorp.hn
```

### Desarrollo (servidor o PC con Docker)

```bash
cp .env.development.example .env.development
docker compose -f docker-compose.dev.yml --env-file .env.development up -d --build
# http://localhost:3002  o  portal-dev.rcjcorp.hn
```

### Desarrollo en tu PC (sin Docker, día a día)

```bash
npm run dev
# Frontend :5173  |  API :3001  |  MongoDB local :27017
```

---

## DNS (red interna RCJ)

Registro en el DNS corporativo (o archivo hosts para pruebas):

| Registro | Tipo | Destino |
|----------|------|---------|
| `portal.rcjcorp.hn` | A | IP del servidor Ubuntu (producción) |
| `portal-dev.rcjcorp.hn` | A | Misma IP u otro servidor (desarrollo) |

Prueba local en `C:\Windows\System32\drivers\etc\hosts`:

```
192.168.x.x   portal.rcjcorp.hn
192.168.x.x   portal-dev.rcjcorp.hn
```

---

## Producción — `portal.rcjcorp.hn`

### 1. Instalar Docker (una vez)

```bash
sudo bash scripts/install-docker-ubuntu.sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Variables

```bash
cp .env.production.example .env.production
nano .env.production   # JWT_SECRET obligatorio; AUTH_LOCAL_FALLBACK=false
```

### 3. Levantar contenedores

```bash
bash scripts/deploy-ubuntu.sh
# o: docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

La app escucha solo en **127.0.0.1:3001** (no expuesta directamente a la red).

### 4. Nginx + HTTPS

```bash
sudo apt install -y nginx
sudo cp deploy/nginx-portal.rcjcorp.hn.conf.example /etc/nginx/sites-available/portal.rcjcorp.hn
sudo ln -sf /etc/nginx/sites-available/portal.rcjcorp.hn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d portal.rcjcorp.hn
```

### 5. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'    # 80 y 443
sudo ufw enable
```

No hace falta abrir el puerto 3001 al exterior si usas Nginx.

### 6. Actualizar versión

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## Desarrollo — `portal-dev.rcjcorp.hn`

Puerto por defecto **3002** y MongoDB en **27018** (no choca con prod ni con `mongod` local).

```bash
cp .env.development.example .env.development
bash scripts/deploy-ubuntu.sh --dev
```

Nginx opcional (bloque comentado en `deploy/nginx-portal.rcjcorp.hn.conf.example`).

`AUTH_LOCAL_FALLBACK=true` en dev permite contraseña local en MongoDB además de Active Directory.

---

## Comandos útiles

| Acción | Producción | Desarrollo |
|--------|------------|------------|
| Levantar | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` | `docker compose -f docker-compose.dev.yml --env-file .env.development up -d --build` |
| Logs | `docker compose -f docker-compose.prod.yml logs -f app` | `docker compose -f docker-compose.dev.yml logs -f app` |
| Parar | `docker compose -f docker-compose.prod.yml down` | `docker compose -f docker-compose.dev.yml down` |
| Seed | `docker compose -f docker-compose.prod.yml exec app npm run seed` | `...dev.yml...` |

---

## Datos persistentes

| Ruta | Contenido |
|------|-----------|
| `./data/gastos.xlsx` | Excel OPEX |
| `./data/certificados/` | Diplomas |
| `./data/adjuntos-tareas/` | Adjuntos |
| Volumen `mongo_data_prod` | BD producción |
| Volumen `mongo_data_dev` | BD desarrollo |

Prod y dev pueden compartir la carpeta `./data` o usar carpetas distintas si lo prefieres.

---

## Variables principales

| Variable | Producción | Desarrollo |
|----------|------------|------------|
| `JWT_SECRET` | Obligatorio, único | Distinto al de prod |
| `APP_PORT` | `3001` | `3002` |
| `AUTH_LOCAL_FALLBACK` | `false` (solo AD) | `true` (AD + local) |
| `AUTH_AD_ENABLED` | `true` | `true` |
| `EHR_LOGIN_URL` | URL login EHR | Igual |

---

## Solución de problemas

| Síntoma | Qué hacer |
|---------|-----------|
| 502 / ECONNREFUSED | API reiniciando; espera y reintenta |
| `portal.rcjcorp.hn` no abre | DNS, Nginx (`nginx -t`), `curl http://127.0.0.1:3001/api/health` |
| Login AD falla | Servidor debe alcanzar `ehr.rcjcorp.hn:8095`; usuario creado en Maestros → Usuarios |
| Prod y dev mezclados | Revisa que uses el compose y `.env` correctos |

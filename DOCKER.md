# RCJ IT Manager — Docker (desarrollo y producción)

| Ambiente | URL | Compose | Variables |
|----------|-----|---------|-----------|
| **Producción** | `https://portal.rcjcorporacion.com` | `docker-compose.prod.yml` | `.env.production` |
| **Desarrollo** | `http://portal-dev.rcjcorporacion.com` (o `:3002`) | `docker-compose.dev.yml` | `.env.development` |
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
# Configurar Apache + DNS → portal.rcjcorporacion.com
```

### Desarrollo (servidor o PC con Docker)

```bash
cp .env.development.example .env.development
docker compose -f docker-compose.dev.yml --env-file .env.development up -d --build
# http://localhost:3002  o  portal-dev.rcjcorporacion.com
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
| `portal.rcjcorporacion.com` | A | IP del servidor Ubuntu (producción) |
| `portal-dev.rcjcorporacion.com` | A | Misma IP u otro servidor (desarrollo) |

Prueba local en `C:\Windows\System32\drivers\etc\hosts`:

```
192.168.x.x   portal.rcjcorporacion.com
192.168.x.x   portal-dev.rcjcorporacion.com
```

---

## Producción — `portal.rcjcorporacion.com`

### 1. Instalar Docker (una vez)

```bash
sudo bash scripts/install-docker-ubuntu.sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Variables

```bash
cp .env.production.example .env.production
nano .env.production   # JWT_SECRET obligatorio; AUTH_LOCAL_FALLBACK=true (AD + local)
```

### 3. Levantar contenedores

```bash
bash scripts/deploy-ubuntu.sh
# o: docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

La app escucha en **127.0.0.1:3001** por defecto (`APP_BIND=127.0.0.1`; Apache en el host).
Para abrir por IP en la red interna (ej. `http://172.16.146.163:3001`), en `.env.production` pon `APP_BIND=0.0.0.0` y vuelve a levantar compose.

### 4. Apache + HTTPS

```bash
sudo apt install -y apache2
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo cp deploy/apache-portal.rcjcorporacion.com.conf.example /etc/apache2/sites-available/portal.rcjcorporacion.com.conf
sudo a2ensite portal.rcjcorporacion.com.conf
sudo apachectl configtest && sudo systemctl reload apache2

sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d portal.rcjcorporacion.com
```

### 5. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Apache Full'    # 80 y 443
sudo ufw enable
```

No hace falta abrir el puerto 3001 al exterior si usas Apache.

### 6. Actualizar versión

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

---

## Desarrollo — `portal-dev.rcjcorporacion.com`

Puerto por defecto **3002** y MongoDB en **27018** (no choca con prod ni con `mongod` local).

```bash
cp .env.development.example .env.development
bash scripts/deploy-ubuntu.sh --dev
```

Apache opcional (bloque comentado en `deploy/apache-portal.rcjcorporacion.com.conf.example`).

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
| `AUTH_LOCAL_FALLBACK` | `true` (AD + local) | `true` (AD + local) |
| `AUTH_AD_ENABLED` | `true` | `true` |
| `EHR_LOGIN_URL` | URL login EHR | Igual |

---

## Solución de problemas

| Síntoma | Qué hacer |
|---------|-----------|
| 502 / ECONNREFUSED | API reiniciando; espera y reintenta |
| `portal.rcjcorporacion.com` no abre | DNS, Apache (`apachectl configtest`), `curl http://127.0.0.1:3001/api/health` |
| Login AD falla | Servidor debe alcanzar `ehr.rcjcorp.hn:8095`; usuario creado en Maestros → Usuarios |
| Prod y dev mezclados | Revisa que uses el compose y `.env` correctos |

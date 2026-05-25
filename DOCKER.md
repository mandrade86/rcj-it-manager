# RCJ IT Manager — Docker

Despliegue con **MongoDB** + app en un puerto (API + frontend). Pensado para **Ubuntu Server** en red local; también funciona en Windows con Docker Desktop.

---

## Ubuntu Server (producción en red local)

### Requisitos

- Ubuntu Server **22.04** o **24.04** (LTS)
- Acceso `sudo`
- Puertos: **3001** (app) o **80/443** si usas Nginx
- ~2 GB RAM, ~10 GB disco

### 1. Instalar Docker

Copia el proyecto al servidor (git, scp o rsync):

```bash
# En tu PC (ejemplo)
scp -r rcj-it-manager usuario@IP_SERVIDOR:/opt/
```

En el servidor:

```bash
cd /opt/rcj-it-manager
sudo bash scripts/install-docker-ubuntu.sh

# Para no usar sudo en cada docker:
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Desplegar la aplicación

```bash
cd /opt/rcj-it-manager
bash scripts/deploy-ubuntu.sh
```

El script crea `.env` (con `JWT_SECRET` aleatorio), carpetas en `data/` y ejecuta `docker compose up -d --build`.

Con datos iniciales del Plan IT 2026:

```bash
bash scripts/deploy-ubuntu.sh --seed
```

### 3. Acceder desde la red

```bash
hostname -I   # IP del servidor
```

Abre en el navegador: `http://IP_DEL_SERVIDOR:3001`

### 4. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 3001/tcp comment 'RCJ IT Manager'
sudo ufw enable
sudo ufw status
```

Solo red interna (ejemplo):

```bash
sudo ufw allow from 192.168.0.0/16 to any port 3001 proto tcp
```

### 5. Nginx + nombre amigable (opcional)

Si quieres `http://it-manager.rcj.local` en lugar del puerto 3001:

```bash
sudo apt install -y nginx
sudo cp deploy/nginx-it-manager.conf.example /etc/nginx/sites-available/it-manager
sudo nano /etc/nginx/sites-available/it-manager   # ajusta server_name
sudo ln -sf /etc/nginx/sites-available/it-manager /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

HTTPS con Let's Encrypt (solo si el servidor tiene dominio público):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d it.tu-dominio.com
```

### 6. Datos persistentes

| Ruta en el servidor | Contenido |
|---------------------|-----------|
| `./data/gastos.xlsx` | Excel OPEX |
| `./data/certificados/` | Diplomas subidos |
| `./data/adjuntos-tareas/` | Adjuntos de tareas |
| Volumen Docker `mongo_data` | Base MongoDB |

Copiar Excel desde tu PC:

```bash
scp gastos.xlsx usuario@IP_SERVIDOR:/opt/rcj-it-manager/data/
```

### 7. Actualizar versión

```bash
cd /opt/rcj-it-manager
git pull   # si usas git
docker compose up -d --build
```

### 8. Arranque automático

Los servicios usan `restart: unless-stopped`. Tras reiniciar el servidor:

```bash
sudo systemctl enable docker
docker compose -f /opt/rcj-it-manager/docker-compose.yml ps
```

### 9. Servicio systemd (opcional)

Si prefieres un unit explícito:

```bash
sudo tee /etc/systemd/system/rcj-it-manager.service << 'EOF'
[Unit]
Description=RCJ IT Manager (Docker Compose)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/rcj-it-manager
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable rcj-it-manager
```

---

## Windows / desarrollo local

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```powershell
cp .env.docker.example .env
# Edita JWT_SECRET
mkdir -Force data\certificados, data\adjuntos-tareas
docker compose up -d --build
# http://localhost:3001
```

---

## Comandos útiles

| Acción | Comando |
|--------|---------|
| Ver logs | `docker compose logs -f app` |
| Parar | `docker compose down` |
| Parar y borrar BD | `docker compose down -v` |
| Rebuild | `docker compose up -d --build` |
| Seed manual | `docker compose exec app npm run seed` |
| Shell | `docker compose exec app sh` |

---

## Arquitectura

- **mongo** — MongoDB 7 (solo red interna Docker, no expuesto al host)
- **app** — Node 22: Express `:3001`, sirve `client/dist` + `/api/*`
- **./data** — volumen montado en `/app/data`

## Variables (.env en la raíz)

| Variable | Descripción |
|----------|-------------|
| `JWT_SECRET` | Obligatorio en producción |
| `APP_PORT` | Puerto en el host (default `3001`) |
| `ANTHROPIC_API_KEY` | Análisis OPEX con IA (opcional) |
| `JIRA_*` | Tech Debt → Jira (opcional) |

`MONGODB_URI` lo define `docker-compose.yml` (`mongodb://mongo:27017/rcj_it_manager`).

---

## Solución de problemas (Ubuntu)

| Síntoma | Qué hacer |
|---------|-----------|
| `permission denied` en docker | `sudo usermod -aG docker $USER` y volver a iniciar sesión |
| No abre desde otra PC | `sudo ufw status`, comprobar IP y puerto 3001 |
| App reinicia en bucle | `docker compose logs app` — suele ser MongoDB aún no listo; espera 1–2 min |
| Login falla | Revisa `JWT_SECRET` en `.env`; no cambies el secreto si ya hay usuarios creados |
| Gastos vacíos | Sube `data/gastos.xlsx` y pulsa *Sincronizar* en la app |
| Build lento | Primera vez descarga imágenes; en servidor sin internet fallará el build |

---

## Desarrollo vs Docker

- **Dev:** `npm run dev` — Vite `:5173` + API `:3001`
- **Docker:** todo en un solo origen, p. ej. `http://servidor:3001`

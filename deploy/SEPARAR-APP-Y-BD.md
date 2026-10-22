# Separar app y base de datos (dos servidores)

Hoy el despliegue por defecto levanta **app + Mongo** en el mismo host.  
Para dejarlos en servidores distintos (producción o desarrollo):

### Producción

| Servidor | Compose | Variables | Comando | Base |
|----------|---------|-----------|---------|------|
| **BD** | `docker-compose.mongo.yml` | `.env.mongo` | `bash scripts/deploy-ubuntu.sh --mongo` | `rcj_it_manager` |
| **App** | `docker-compose.app.yml` | `.env.production` + `MONGODB_URI` | `bash scripts/deploy-ubuntu.sh --app` | idem |

### Desarrollo / staging

| Servidor | Compose | Variables | Comando | Base |
|----------|---------|-----------|---------|------|
| **BD** | `docker-compose.dev-mongo.yml` | `.env.mongo.dev` | `bash scripts/deploy-ubuntu.sh --dev --mongo` | `rcj_it_manager_dev` |
| **App** | `docker-compose.dev-app.yml` | `.env.development` + `MONGODB_URI` | `bash scripts/deploy-ubuntu.sh --dev --app` | idem |

Todo-en-uno (sin separar):

- Prod: `bash scripts/deploy-ubuntu.sh`
- Dev: `bash scripts/deploy-ubuntu.sh --dev`

---

## Red

- App → BD: TCP **27017** (solo la IP del servidor de app)
- Usuarios → App: **80/443** (Apache)
- App → SAP BI: **30015** (igual que hoy; no va en el servidor de BD)
- No abras Mongo a internet

Sustituye en los ejemplos:

- `IP_BD` — IP interna del servidor Mongo  
- `IP_APP` — IP interna del servidor de la aplicación  
- `usuario@…` — tu usuario SSH (ej. `administrador`)

---

## 1. Servidor de base de datos

### Producción

```bash
ssh usuario@IP_BD
cd /opt/rcj-it-manager
cp .env.mongo.example .env.mongo
nano .env.mongo   # opcional: auth
bash scripts/deploy-ubuntu.sh --mongo
```

### Desarrollo

```bash
ssh usuario@IP_BD_DEV
cd /opt/rcj-it-manager
cp .env.mongo.dev.example .env.mongo.dev
nano .env.mongo.dev
bash scripts/deploy-ubuntu.sh --dev --mongo
```

Firewall (ufw ejemplo; usa la IP de la app correspondiente):

```bash
sudo ufw allow from IP_APP to any port 27017 proto tcp
sudo ufw deny 27017
sudo ufw reload
```

Prueba desde el servidor de app:

```bash
docker run --rm mongo:7 mongosh --host IP_BD --eval "db.adminCommand('ping')"
```

---

## 2. Exportar datos del servidor actual

### Producción (todo-en-uno viejo → BD nueva)

```bash
# En el servidor viejo
cd /opt/rcj-it-manager
bash scripts/mongo-export.sh
scp data/backups/rcj_it_manager-*.archive usuario@IP_BD:/opt/rcj-it-manager/data/backups/

# En el servidor de BD
mkdir -p data/backups
bash scripts/mongo-import.sh data/backups/rcj_it_manager-XXXX.archive --drop
```

### Desarrollo (todo-en-uno viejo → BD nueva de desarrollo)

```bash
# En el servidor viejo de desarrollo
bash scripts/mongo-export.sh --dev
scp data/backups/rcj_it_manager_dev-*.archive usuario@IP_BD_DEV:/opt/rcj-it-manager/data/backups/

# En el servidor de BD de desarrollo
mkdir -p data/backups
bash scripts/mongo-import.sh data/backups/rcj_it_manager_dev-XXXX.archive --dev --drop
```

`--drop` reemplaza la base si ya existía.

---

## 3. Servidor de la aplicación

### Producción

```bash
ssh usuario@IP_APP
cd /opt/rcj-it-manager
git pull
cp .env.production.example .env.production   # primera vez
nano .env.production
```

```env
APP_BIND=127.0.0.1
APP_PORT=3001
APP_PUBLIC_URL=https://portal.rcjcorporacion.com
JWT_SECRET=<secreto largo>
INIT_DATA_ON_START=false
MONGODB_URI=mongodb://IP_BD:27017/rcj_it_manager
```

```bash
rsync -av usuario@SERVIDOR_VIEJO:/opt/rcj-it-manager/data/ /opt/rcj-it-manager/data/
bash scripts/deploy-ubuntu.sh --app
curl -s http://127.0.0.1:3001/api/health
```

Apache en este servidor: `deploy/HTTPS-APACHE.md`.

### Desarrollo

```bash
ssh usuario@IP_APP_DEV
cd /opt/rcj-it-manager
git pull
cp .env.development.example .env.development   # primera vez
nano .env.development
```

```env
APP_BIND=0.0.0.0
APP_PORT=3002
APP_PUBLIC_URL=http://portal-dev.rcjcorporacion.com
JWT_SECRET=<secreto largo de desarrollo>
INIT_DATA_ON_START=false
MONGODB_URI=mongodb://IP_BD_DEV:27017/rcj_it_manager_dev
```

```bash
rsync -av usuario@SERVIDOR_DEV_VIEJO:/opt/rcj-it-manager/data/ /opt/rcj-it-manager/data/
bash scripts/deploy-ubuntu.sh --dev --app
curl -s http://127.0.0.1:3002/api/health
```

---

## 4. Corte y DNS

1. Avisa a usuarios / ventana corta de mantenimiento.  
2. Export final + import en BD.  
3. Confirma login y un módulo (proyectos, gastos).  
4. Apunta DNS / Apache al servidor de app.  
5. En el servidor viejo, baja el compose antiguo:  
   - Prod: `docker compose -f docker-compose.prod.yml --env-file .env.production down`  
   - Dev: `docker compose -f docker-compose.dev.yml --env-file .env.development down`

No borres el volumen Mongo viejo hasta confirmar varios días estables.

---

## Comandos útiles

```bash
# Prod — BD / app
docker compose -f docker-compose.mongo.yml --env-file .env.mongo logs -f mongo
docker compose -f docker-compose.app.yml --env-file .env.production logs -f app
cd /opt/rcj-it-manager && git pull && bash scripts/deploy-ubuntu.sh --app

# Dev — BD / app
docker compose -f docker-compose.dev-mongo.yml --env-file .env.mongo.dev logs -f mongo
docker compose -f docker-compose.dev-app.yml --env-file .env.development logs -f app
cd /opt/rcj-it-manager && git pull && bash scripts/deploy-ubuntu.sh --dev --app

# Backup
bash scripts/mongo-export.sh --compose docker-compose.mongo.yml --env-file .env.mongo
bash scripts/mongo-export.sh --dev --compose docker-compose.dev-mongo.yml --env-file .env.mongo.dev
```

---

## Problemas frecuentes

| Síntoma | Qué revisar |
|---------|-------------|
| App no arranca / timeout health | `MONGODB_URI` en `.env.production`; ping 27017 desde IP_APP |
| `mongo: not connected` en health | Firewall BD; auth incorrecta; nombre de base |
| Login vacío / sin usuarios | Faltó el `mongo-import` o usaste `--seed` sobre una BD vacía |
| Adjuntos 404 | Falta sincronizar carpeta `data/` al servidor de app |
| SAP BI falla | El servidor de **app** debe alcanzar `172.16.146.16:30015` |

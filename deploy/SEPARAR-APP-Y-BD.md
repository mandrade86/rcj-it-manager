# Separar app y base de datos (dos servidores)

Hoy el despliegue por defecto (`docker-compose.prod.yml`) levanta **app + Mongo** en el mismo host.  
Para dejarlos en servidores distintos:

| Servidor | Compose | Variables | Comando |
|----------|---------|-----------|---------|
| **BD** | `docker-compose.mongo.yml` | `.env.mongo` | `bash scripts/deploy-ubuntu.sh --mongo` |
| **App** | `docker-compose.app.yml` | `.env.production` con `MONGODB_URI` | `bash scripts/deploy-ubuntu.sh --app` |

El todo-en-uno (`bash scripts/deploy-ubuntu.sh` sin flags) sigue funcionando igual.

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

```bash
ssh usuario@IP_BD
sudo bash /ruta/install-docker-ubuntu.sh   # si aún no hay Docker
# o clona el repo solo para los compose:
sudo mkdir -p /opt/rcj-it-manager && cd /opt/rcj-it-manager
# copia el repo (git clone / rsync) o al menos:
#   docker-compose.mongo.yml  .env.mongo.example  scripts/

cd /opt/rcj-it-manager
cp .env.mongo.example .env.mongo
nano .env.mongo   # opcional: descomenta MONGO_INITDB_ROOT_USERNAME / PASSWORD

bash scripts/deploy-ubuntu.sh --mongo
```

Firewall (ufw ejemplo):

```bash
sudo ufw allow from IP_APP to any port 27017 proto tcp
sudo ufw deny 27017
sudo ufw reload
```

Prueba desde el servidor de app:

```bash
# sin auth
docker run --rm mongo:7 mongosh --host IP_BD --eval "db.adminCommand('ping')"
# con auth
docker run --rm mongo:7 mongosh "mongodb://rcjadmin:CLAVE@IP_BD:27017/admin" --eval "db.adminCommand('ping')"
```

---

## 2. Exportar datos del servidor actual

En el servidor **viejo** (todo-en-uno):

```bash
cd /opt/rcj-it-manager
bash scripts/mongo-export.sh
# genera data/backups/rcj_it_manager-YYYYMMDD-HHMMSS.archive
```

Copia el archive al servidor de BD:

```bash
# desde tu PC o el servidor viejo
scp /opt/rcj-it-manager/data/backups/rcj_it_manager-*.archive usuario@IP_BD:/opt/rcj-it-manager/data/backups/
```

En el servidor de BD (crea la carpeta si hace falta):

```bash
cd /opt/rcj-it-manager
mkdir -p data/backups
bash scripts/mongo-import.sh data/backups/rcj_it_manager-XXXX.archive --drop
```

`--drop` reemplaza la base si ya existía. Sin `--drop` solo agrega/actualiza.

---

## 3. Servidor de la aplicación

```bash
ssh usuario@IP_APP
cd /opt/rcj-it-manager
git pull

cp .env.production.example .env.production   # si es la primera vez
nano .env.production
```

Variables mínimas:

```env
APP_BIND=127.0.0.1
APP_PORT=3001
APP_PUBLIC_URL=https://portal.rcjcorporacion.com
JWT_SECRET=<secreto largo>
INIT_DATA_ON_START=false

# Sin auth en Mongo:
MONGODB_URI=mongodb://IP_BD:27017/rcj_it_manager

# Con auth:
# MONGODB_URI=mongodb://rcjadmin:CLAVE@IP_BD:27017/rcj_it_manager?authSource=admin
```

Copia adjuntos del servidor viejo (no están en Mongo):

```bash
rsync -av usuario@SERVIDOR_VIEJO:/opt/rcj-it-manager/data/ /opt/rcj-it-manager/data/
```

Levanta solo la app:

```bash
bash scripts/deploy-ubuntu.sh --app
curl -s http://127.0.0.1:3001/api/health
```

Debe mostrar `"mongo":"connected"` (o equivalente en el JSON).

Apache se configura **en este servidor**, igual que antes (`deploy/HTTPS-APACHE.md`).

---

## 4. Corte y DNS

1. Avisa a usuarios / ventana corta de mantenimiento.  
2. Export final + import en BD (para no perder cambios de última hora).  
3. Confirma login y un módulo (proyectos, gastos).  
4. Apunta DNS / Apache al `IP_APP`.  
5. En el servidor viejo:  
   `docker compose -f docker-compose.prod.yml --env-file .env.production down`

No borres el volumen Mongo del servidor viejo hasta confirmar varios días de operación estable.

---

## Comandos útiles

```bash
# BD — logs
docker compose -f docker-compose.mongo.yml --env-file .env.mongo logs -f mongo

# App — logs
docker compose -f docker-compose.app.yml --env-file .env.production logs -f app

# Actualizar solo la app
cd /opt/rcj-it-manager && git pull && bash scripts/deploy-ubuntu.sh --app

# Backup periódico desde la BD
bash scripts/mongo-export.sh --compose docker-compose.mongo.yml --env-file .env.mongo
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

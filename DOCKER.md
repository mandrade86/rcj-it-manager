# RCJ IT Manager — Docker (desarrollo y producción)

| Ambiente | URL | Compose | Variables |
|----------|-----|---------|-----------|
| **Producción** | `https://portal.rcjcorp.hn` (Apache) | `docker-compose.prod.yml` | `.env.production` |
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
# Configurar Apache + DNS → portal.rcjcorp.hn
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

## Despliegue por SSH (Apache + Docker, desde cero)

### A. Conectar desde tu PC (Windows)

Abre **PowerShell** o **Terminal** y entra al servidor:

```powershell
ssh administrador@172.16.146.103
```

Si el hostname resuelve en tu red:

```powershell
ssh administrador@intranet
```

La primera vez pedirá confirmar la huella (`yes`). Te pedirá la contraseña del usuario `administrador`.

> Si SSH no conecta: verifica VPN/red interna, que el puerto 22 esté abierto en el firewall del servidor y que uses la IP correcta.

---

### B. En el servidor — limpiar despliegue anterior (opcional)

```bash
cd /opt/rcj-it-manager
docker compose -f docker-compose.prod.yml --env-file .env.production down 2>/dev/null || true
```

Solo si quieres **base de datos vacía** (borra usuarios y datos):

```bash
docker volume rm rcj-it-manager-prod_mongo_data_prod
```

---

### C. Código y variables

```bash
cd /opt/rcj-it-manager
git pull

cp .env.production.example .env.production
nano .env.production
```

Ejemplo para **Apache delante + acceso por IP** `172.16.146.103`:

```env
APP_PORT=3001
APP_BIND=127.0.0.1
APP_PUBLIC_URL=http://172.16.146.103

JWT_SECRET=<salida de: openssl rand -hex 32>

AUTH_AD_ENABLED=true
AUTH_LOCAL_FALLBACK=false
AD_DOMAIN=RCJ
AD_EMAIL_DOMAINS=rcjcorp.com,grupoc.com
EHR_LOGIN_URL=https://ehr.rcjcorp.hn:8095/api/Login
```

Guardar en nano: `Ctrl+O`, Enter, `Ctrl+X`.

---

### D. Docker (app en 127.0.0.1:3001)

```bash
mkdir -p data/certificados data/adjuntos-tareas
bash scripts/deploy-ubuntu.sh --seed
curl -s http://127.0.0.1:3001/api/health
```

Debe responder JSON con estado OK.

---

### E. Apache (proxy inverso — obligatorio para entrar por :80)

```bash
sudo apt install -y apache2
sudo a2enmod proxy proxy_http headers rewrite ssl

# Por IP:
sudo cp deploy/apache-portal.ip.conf.example /etc/apache2/sites-available/portal-it-manager.conf
# Ajusta la IP en el archivo si no es 172.16.146.103:
# sudo nano /etc/apache2/sites-available/portal-it-manager.conf

# O por dominio portal.rcjcorp.hn:
# sudo cp deploy/apache-portal.rcjcorp.hn.conf.example /etc/apache2/sites-available/portal.rcjcorp.hn.conf
# sudo a2ensite portal.rcjcorp.hn.conf

sudo a2ensite portal-it-manager.conf
sudo a2dissite 000-default.conf 2>/dev/null || true
sudo apachectl configtest
sudo systemctl reload apache2
```

Firewall (solo Apache al exterior; **no** hace falta abrir 3001):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Apache Full'
sudo ufw enable
```

HTTPS con dominio (cuando el DNS apunte al servidor): ver **`deploy/HTTPS-APACHE.md`**.

```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d portal.rcjcorporacion.com
```

---

### F. Probar

En el servidor:

```bash
curl -s http://127.0.0.1:3001/api/health
curl -I http://127.0.0.1/
```

Desde tu PC (navegador):

- Por IP: `http://172.16.146.103`
- Por dominio: `http://portal.rcjcorp.hn` (si DNS o archivo `hosts` apunta a esa IP)

---

### G. Comandos que usarás después

```bash
# Ver logs de la app
docker compose -f docker-compose.prod.yml logs -f app

# Ver logs de Apache
sudo tail -f /var/log/apache2/portal-it-manager-error.log

# Actualizar versión
cd /opt/rcj-it-manager && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Salir de SSH
exit
```

---

## DNS (red interna RCJ)

Registro en el DNS corporativo (o archivo hosts para pruebas):

| Registro | Tipo | Destino |
|----------|------|---------|
| `portal.rcjcorp.hn` | A | IP del servidor Ubuntu (producción) |
| `portal-dev.rcjcorporacion.com` | A | Misma IP u otro servidor (desarrollo) |

Prueba local en `C:\Windows\System32\drivers\etc\hosts`:

```
192.168.x.x   portal.rcjcorp.hn
192.168.x.x   portal-dev.rcjcorporacion.com
```

---

## Producción — `portal.rcjcorp.hn` (Apache)

### 1. Instalar Docker (una vez)

```bash
sudo bash scripts/install-docker-ubuntu.sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Variables

```bash
cp .env.production.example .env.production
nano .env.production   # JWT_SECRET obligatorio; usuarios con correo + contraseña en MongoDB
```

### 3. Levantar contenedores

```bash
bash scripts/deploy-ubuntu.sh
# o: docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

La app escucha en **127.0.0.1:3001** por defecto (`APP_BIND=127.0.0.1`; Apache en el host).
Para abrir por IP en la red interna (ej. `http://172.16.146.163:3001`), en `.env.production` pon `APP_BIND=0.0.0.0` y vuelve a levantar compose.

### 4. Apache + HTTPS

Guía detallada: **`deploy/HTTPS-APACHE.md`**.

```bash
sudo apt install -y apache2
sudo a2enmod proxy proxy_http headers rewrite ssl

# Dominio público/intranet (ej. portal.rcjcorporacion.com):
sudo cp deploy/apache-portal.rcjcorporacion.com.conf.example \
  /etc/apache2/sites-available/portal.rcjcorporacion.com.conf
sudo a2ensite portal.rcjcorporacion.com.conf

# O dominio interno portal.rcjcorp.hn:
# sudo cp deploy/apache-portal.rcjcorp.hn.conf.example /etc/apache2/sites-available/portal.rcjcorp.hn.conf
# sudo a2ensite portal.rcjcorp.hn.conf

sudo apachectl configtest && sudo systemctl reload apache2

# Certificado TLS (Let's Encrypt)
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d portal.rcjcorporacion.com
# sudo certbot --apache -d portal.rcjcorp.hn

# .env.production en el servidor:
# APP_PUBLIC_URL=https://portal.rcjcorporacion.com
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
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

Login con **Active Directory** (validación vía API EHR). Opcional: contraseña local de respaldo si `AUTH_LOCAL_FALLBACK=true`.

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
| `AUTH_AD_ENABLED` | `true` | Validar credenciales contra AD (EHR) |
| `AUTH_LOCAL_FALLBACK` | `false` | `true` solo emergencia; login normal = Windows/AD |
| `AD_DOMAIN` | `RCJ` | Dominio Windows (ej. `RCJ\usuario`) |
| `AD_EMAIL_DOMAINS` | `rcjcorp.com,grupoc.com` | Dominios al resolver usuario sin @ |
| `EHR_LOGIN_URL` | URL login EHR | Igual |

---

## Solución de problemas

| Síntoma | Qué hacer |
|---------|-----------|
| 502 / ECONNREFUSED | API reiniciando; espera y reintenta |
| `portal.rcjcorp.hn` no abre | DNS, Apache (`apachectl configtest`), `curl http://127.0.0.1:3001/api/health` |
| Login AD falla | Servidor debe alcanzar `ehr.rcjcorp.hn:8095`; usuario creado en Maestros → Usuarios |
| Prod y dev mezclados | Revisa que uses el compose y `.env` correctos |

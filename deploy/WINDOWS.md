# RCJ IT Manager — Windows

Hay dos usos distintos:

| Uso | Dónde | Cómo |
|-----|--------|------|
| **Desarrollo en tu PC** | Windows local | `npm run dev` |
| **Deploy en servidor Windows** | Windows Server | Docker Desktop **o** Node producción (abajo §6) |
| **Deploy Ubuntu (actual portal)** | Linux | `bash scripts/deploy-ubuntu.sh` — ver [DOCKER.md](../DOCKER.md) |

En Windows Server lo habitual es: **app en Windows** + **Mongo en otro host** (ej. `172.16.146.20`).

---

## 1. Requisitos en Windows

1. **Node.js 22+** — https://nodejs.org/
2. **Git**
3. Para deploy con contenedores: **Docker Desktop** (Windows Server / Windows 10/11 con WSL2)
4. **MongoDB remoto** ya levantado (o local). Compass + Database Tools solo para dumps
5. Red/VPN RCJ si el Mongo o el código están en la LAN interna

---

## 2. Correr la app en local (sin Docker)

```powershell
cd C:\Users\Marcela.Hernandez\rcj-it-manager
copy .env.example .env
# Edita .env: JWT_SECRET=algo-seguro

npm install
cd client; npm install; cd ..
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3001  
- Mongo: `mongodb://127.0.0.1:27017/rcj_it_manager`

Datos iniciales (si la base está vacía):

```powershell
npm run seed
```

---

## 3. Dump desde el servidor → tu PC

Con VPN/red interna y contraseña de `administrador`:

```powershell
cd C:\Users\Marcela.Hernandez\rcj-it-manager
.\scripts\mongo-pull-from-server.ps1
```

Desarrollo (base `rcj_it_manager_dev`):

```powershell
.\scripts\mongo-pull-from-server.ps1 -Dev
```

El archivo queda en:

`data\backups\rcj_it_manager-YYYYMMDD-HHMMSS.archive`

### Manual (mismo resultado)

```powershell
# 1) En el servidor
ssh administrador@172.16.150.20
cd /opt/rcj-it-manager
bash scripts/mongo-export.sh
exit

# 2) Descargar (ajusta el nombre del archivo que te imprimió el export)
scp administrador@172.16.150.20:/opt/rcj-it-manager/data/backups/rcj_it_manager-*.archive .\data\backups\
```

---

## 4. Crear / restaurar la base en Compass

### Opción A — mongorestore (recomendada para `.archive`)

```powershell
.\scripts\mongo-import-local.ps1 data\backups\rcj_it_manager-XXXX.archive -Drop
```

Luego abre **Compass** → conexión `mongodb://127.0.0.1:27017` → base **`rcj_it_manager`**.

### Opción B — solo Compass (sin mongorestore)

Compass importa **JSON/CSV por colección**, no el `.archive` completo. Flujo:

1. En el servidor (o con Database Tools) exporta colección a JSON, o restaura primero con la opción A.
2. En Compass: **Create Database** → nombre `rcj_it_manager` → collection (ej. `colaboradors`).
3. **Add Data → Import File** → elige el JSON.

Para el dump oficial del proyecto usa siempre la **opción A**.

---

## 5. Desplegar en el portal Ubuntu (desde tu PC Windows)

```powershell
ssh administrador@172.16.150.20
cd /opt/rcj-it-manager
git pull
bash scripts/deploy-ubuntu.sh
```

Detalle: [DOCKER.md](../DOCKER.md) y [SEPARAR-APP-Y-BD.md](./SEPARAR-APP-Y-BD.md).

---

## 6. Deploy del código en un **servidor Windows**

### A. Preparar el servidor

1. Instala **Git**, **Node 22+** y (recomendado) **Docker Desktop**.
2. Clona el repo (o copia el proyecto):

```powershell
cd C:\apps
git clone <URL-del-repo> rcj-it-manager
cd rcj-it-manager
```

3. Crea `.env.production`:

```powershell
copy .env.production.example .env.production
notepad .env.production
```

Valores mínimos:

```env
APP_PORT=3001
APP_BIND=0.0.0.0
APP_PUBLIC_URL=http://IP_DEL_WINDOWS:3001
JWT_SECRET=un-secreto-largo-y-unico

# Mongo remoto (el que restauraste con mongorestore)
MONGODB_URI=mongodb://appUser:CLAVE@172.16.146.20:27017/rcj_it_manager?authSource=admin

INIT_DATA_ON_START=false
```

4. Firewall Windows: permite **TCP 3001** (entrada) si van a entrar por la LAN.

### B. Opción recomendada — Docker (solo app)

Mongo ya está en otro servidor → usamos `docker-compose.app.yml`.

```powershell
cd C:\apps\rcj-it-manager
.\scripts\deploy-windows.ps1 -Pull
```

Equivale a:

```powershell
docker compose -f docker-compose.app.yml --env-file .env.production up -d --build
```

Comprobar:

```powershell
docker compose -f docker-compose.app.yml --env-file .env.production ps
curl http://127.0.0.1:3001/api/health
```

Actualizar código después:

```powershell
.\scripts\deploy-windows.ps1 -Pull
```

### C. Opción sin Docker — Node en producción

```powershell
.\scripts\deploy-windows.ps1 -Mode node -Pull
```

O manual:

```powershell
git pull
npm install
cd client; npm install; cd ..
npm run build
copy .env.production .env
$env:NODE_ENV = 'production'
npm start
```

Para dejarlo corriendo tras cerrar sesión, usa **pm2** o **NSSM** como servicio de Windows:

```powershell
npm install -g pm2
pm2 start npm --name rcj-it-manager -- start
pm2 save
# pm2 startup  (sigue las instrucciones que imprime)
```

### D. IIS como reverse proxy → Node (`portal.rcjcorp.hn`)

La app Node debe estar corriendo en `http://127.0.0.1:3001` (`npm start`). IIS solo reenvía 80/443.

#### 1. Instalar componentes

1. **IIS** (Roles de Windows → Web Server).
2. **URL Rewrite** — https://www.iis.net/downloads/microsoft/url-rewrite  
3. **Application Request Routing (ARR) 3.0** — https://www.iis.net/downloads/microsoft/application-request-routing  

Reinicia IIS / el servidor si el instalador lo pide.

#### 2. Habilitar el proxy en ARR

1. Abre **IIS Manager**.
2. Clic en el **nombre del servidor** (nodo raíz).
3. Doble clic en **Application Request Routing Cache**.
4. A la derecha: **Server Proxy Settings…**
5. Marca **Enable proxy** → **Apply**.

#### 3. Sitio / binding del dominio

1. Sites → **Add Website** (o usa el Default Web Site).
2. **Site name:** `portal-rcj`
3. **Physical path:** carpeta vacía, ej. `C:\inetpub\portal-rcj` (no hace falta el código ahí).
4. Binding:
   - **http** — puerto **80** — Host name: `portal.rcjcorp.hn`
   - **https** — puerto **443** — mismo Host name + certificado (si ya tienes uno)

DNS de `portal.rcjcorp.hn` debe apuntar a la **IP de este Windows**.

#### 4. Regla de Reverse Proxy

1. Selecciona el sitio `portal-rcj`.
2. **URL Rewrite** → **Add Rule(s)…** → **Reverse Proxy**.
3. Inbound: `127.0.0.1:3001` (o `localhost:3001`).
4. Marca *Rewrite the domain names…* si aparece → OK.

Quedará un `web.config` parecido a:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyInboundRule1" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3001/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

Puedes pegarlo en `C:\inetpub\portal-rcj\web.config` si la regla no se creó sola.

#### 5. Variables de la app (Node)

En `D:\rcj-it-manager\.env`:

```env
HOST=127.0.0.1
PORT=3001
APP_PUBLIC_URL=https://portal.rcjcorp.hn
CORS_ORIGINS=http://portal.rcjcorp.hn,https://portal.rcjcorp.hn
```

Con IIS delante, Node solo escucha en localhost (`HOST=127.0.0.1`). Reinicia `npm start`.

#### 6. Probar

```powershell
curl.exe http://127.0.0.1:3001/api/health
curl.exe http://portal.rcjcorp.hn/api/health
```

Navegador: `https://portal.rcjcorp.hn` (o `http://` si aún no hay certificado).

#### 7. HTTPS (certificado)

- Con dominio público: **win-acme** (Let's Encrypt) o certificado corporativo en IIS → Bindings → https 443.
- Si el certificado es inválido, el navegador mostrará “Not secure”; el proxy igual puede funcionar por HTTP en el 80.

#### Problemas frecuentes

| Síntoma | Causa |
|---------|--------|
| 404 de IIS (“Not Found”) | No hay regla Reverse Proxy / sitio equivocado |
| 502 Bad Gateway | `npm start` no está corriendo en :3001 |
| Timeout | Firewall local o ARR proxy deshabilitado |
| Login / API falla por CORS | Falta el dominio en `CORS_ORIGINS` / `APP_PUBLIC_URL` |

---

## Resumen de scripts

| Script | Qué hace |
|--------|----------|
| `scripts/deploy-windows.ps1` | Deploy en Windows (Docker app o Node) |
| `scripts/mongo-pull-from-server.ps1` | Dump en servidor Ubuntu + descarga |
| `scripts/mongo-import-local.ps1` | Restaura `.archive` en Mongo (local o remoto) |
| `scripts/mongo-export.sh` | Dump (en Linux / Docker) |
| `scripts/mongo-import.sh` | Restore (en Linux / Docker) |
| `scripts/deploy-ubuntu.sh` | Deploy en Ubuntu Server |

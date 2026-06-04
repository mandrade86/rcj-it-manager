# HTTPS — portal RCJ IT Manager (Apache en Ubuntu)

La app Docker escucha en `127.0.0.1:3001`. Apache termina TLS en **443** y hace proxy a la app.

## Requisitos previos

- DNS `portal.rcjcorporacion.com` (o `portal.rcjcorp.hn`) → IP del servidor (`172.16.146.163` u otra).
- Sitio HTTP activo y `curl http://127.0.0.1:3001/api/health` → `{"ok":true,...}`.
- Firewall: `sudo ufw allow 'Apache Full'` (puertos 80 y 443).

## Opción A — Let's Encrypt (recomendado si el servidor tiene salida a internet)

```bash
cd /opt/rcj-it-manager
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo cp deploy/apache-portal.rcjcorporacion.com.conf.example \
  /etc/apache2/sites-available/portal.rcjcorporacion.com.conf

# Si aún no tienes certificado, comenta temporalmente el bloque <VirtualHost *:443>
# y deja solo el :80 con ProxyPass (sin RewriteRule) hasta ejecutar certbot.
sudo a2ensite portal.rcjcorporacion.com.conf
sudo apachectl configtest && sudo systemctl reload apache2

sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d portal.rcjcorporacion.com
```

Certbot crea/ajusta el VirtualHost `:443` y el certificado en `/etc/letsencrypt/live/portal.rcjcorporacion.com/`.

Renovación automática (timer de certbot):

```bash
sudo certbot renew --dry-run
```

## Opción B — Red interna (certificado corporativo o autofirmado)

```bash
sudo openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout /etc/ssl/private/portal.rcjcorporacion.com.key \
  -out /etc/ssl/certs/portal.rcjcorporacion.com.crt \
  -subj "/CN=portal.rcjcorporacion.com"
```

En el VirtualHost `:443` del sitio Apache, apunta a esos archivos en lugar de Let's Encrypt:

```apache
SSLCertificateFile    /etc/ssl/certs/portal.rcjcorporacion.com.crt
SSLCertificateKeyFile /etc/ssl/private/portal.rcjcorporacion.com.key
```

Los navegadores mostrarán advertencia con certificado autofirmado; en dominio interno suele usarse la CA de la empresa.

## Variables de entorno (producción)

En `/opt/rcj-it-manager/.env.production`:

```env
APP_PUBLIC_URL=https://portal.rcjcorporacion.com
APP_BIND=127.0.0.1
```

Reinicia la app:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Comprobación

```bash
curl -sI https://portal.rcjcorporacion.com | head -5
curl -s https://portal.rcjcorporacion.com/api/health
```

Debe responder por HTTPS sin redirigir a `http://`.

## Si ya tienes `intranet-ssl.conf`

No mezcles dos VirtualHost `:443` con el mismo `ServerName`. Deshabilita el sitio viejo si apunta al mismo dominio:

```bash
sudo a2dissite intranet-ssl.conf
sudo apachectl configtest && sudo systemctl reload apache2
```

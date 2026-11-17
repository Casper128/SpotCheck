# Desplegar SpotCheck en SiteGround

## Requisitos y límites

SiteGround permite proyectos Node.js en GrowBig (5), GoGeek (10) y Cloud; StartUp no los admite. Esta aplicación usa tres procesos HTTP independientes. En el alojamiento Node administrado configura tres proyectos desde el mismo repositorio y rama `main`, con Node 22 y npm. Docker Compose sigue siendo la alternativa local o para un servidor que permita Docker.

Dominio confirmado: **spotcheck.mrmamba.com**. Dominios propuestos, pendientes de crear y asignar: **api-spotcheck.mrmamba.com** y **preview-spotcheck.mrmamba.com**. Usa HTTPS en los tres. El proxy debe conservar un origen separado de la interfaz y la API.

**Antes de publicar datos reales:** pide a SiteGround una ruta absoluta, escribible y persistente entre despliegues para SQLite y adjuntos. Confirma que admite Prisma/SQLite y salida HTTPS a sitios públicos desde el proxy. La documentación pública consultada anuncia MySQL/PostgreSQL, pero no confirma la persistencia de SQLite entre versiones. No guardes la base dentro de un directorio de build que el alojamiento pueda reemplazar o eliminar. Si no ofrece esa persistencia, hará falta migrar base y archivos o alojar la API en un servidor con disco persistente; cambiar únicamente `DATABASE_URL` a PostgreSQL no funciona con el esquema y las consultas actuales.

## Configurar los proyectos

Importa `https://github.com/Casper128/SpotCheck`, rama `main`, conservando **la raíz completa del repositorio** en cada proyecto (no selecciones solo `frontend`, `backend` o `proxy`). Los workspaces dependen de `shared`; el proxy también utiliza `frontend/public/spotcheck-inspector.js`.

| Proyecto | Dominio | Instalación | Build | Inicio |
| --- | --- | --- | --- | --- |
| Interfaz | spotcheck.mrmamba.com | `npm ci --include=dev` | `npm run build:frontend` | `npm run start:frontend` |
| API | api-spotcheck.mrmamba.com | `npm ci --include=dev` | `npm run build:backend` | `npm run start:backend:production` |
| Proxy | preview-spotcheck.mrmamba.com | — | `npm run build:proxy` | `npm run start:proxy` |

Configura el proceso de inicio en las opciones que presente SiteGround para cada proyecto. No publiques estos servicios como archivos estáticos ni uses el `npm start` general: inicia dos procesos y no corresponde a un único proyecto administrado. Los tres servicios leen `PORT`; conserva el puerto que asigne SiteGround y su encaminamiento HTTP. Confirma con soporte cómo configurar el comando de inicio y la raíz del monorepo si el panel no ofrece esos campos. No hay que abrir 3000/4000/3002 al público.

El build necesita dependencias de desarrollo (TypeScript y herramientas de Next). No las omitas antes de compilar. Selecciona ejecución Node para Next; `.next` es su salida de build, no un sitio estático. Las migraciones se ejecutan al iniciar la API, contra la base persistente, nunca durante el build. Ejecuta una sola instancia de la API mientras uses SQLite.

## Variables

Interfaz: definir **antes del build**; cualquier cambio exige reconstruir:

```dotenv
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api-spotcheck.mrmamba.com
NEXT_PUBLIC_PROXY_ORIGIN=https://preview-spotcheck.mrmamba.com
```

API: definir en el entorno privado del proyecto. Sustituye las rutas de ejemplo por las que confirme SiteGround; crea sus directorios con permisos del usuario de la aplicación:

```dotenv
NODE_ENV=production
DATABASE_URL=file:/RUTA_PERSISTENTE/spotcheck/dev.db
UPLOAD_DIRECTORY=/RUTA_PERSISTENTE/spotcheck/uploads
FRONTEND_ORIGIN=https://spotcheck.mrmamba.com
PUBLIC_API_ORIGIN=https://api-spotcheck.mrmamba.com
GOOGLE_CLIENT_ID=TU_CLIENT_ID_WEB.apps.googleusercontent.com
SESSION_SECRET=SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
SESSION_COOKIE_SECURE=true
```

Genera el secreto una vez con `openssl rand -hex 32` y guárdalo en las variables privadas. Mantenerlo estable conserva las sesiones. No lo subas a Git ni lo expongas con prefijo `NEXT_PUBLIC_`.

Proxy:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://spotcheck.mrmamba.com
PROXY_ORIGIN=https://preview-spotcheck.mrmamba.com
```

Google Cloud → APIs y servicios → Credenciales → cliente OAuth web usado en `GOOGLE_CLIENT_ID`: añade `https://spotcheck.mrmamba.com` a **Orígenes autorizados de JavaScript**. El acceso usa Google Identity Services directamente; no requiere Auth0 ni configurar un callback de Firebase. Mantén los tres servicios bajo `mrmamba.com` para las cookies SameSite y configura los orígenes exactamente, sin rutas ni barra final.

## Publicación y datos existentes

1. Confirma plan, persistencia y configuración de inicio; crea los tres proyectos y configura dominios, DNS y SSL. Evita cambiar los registros del sitio principal `mrmamba.com`.
2. Configura variables; despliega API y proxy, después la interfaz. Las migraciones crean una base vacía si no existe. Si importas datos locales, hazlo **antes** de iniciar la API por primera vez.
3. Para trasladar los datos de Docker, detén temporalmente las escrituras y la API. Copia completa la carpeta `/app/data` del contenedor backend con `docker compose cp backend:/app/data ./spotcheck-data-backup`, manteniendo base, archivos auxiliares SQLite y uploads juntos. Reinicia la API local con `docker compose start backend`. Trata esa copia como privada: contiene datos de usuarios. No uses `docker compose down -v`.
4. Sube la copia por un canal privado a la ruta persistente; verifica dueño/permisos. El archivo `dev.db` debe coincidir con `DATABASE_URL` y la carpeta `uploads` con `UPLOAD_DIRECTORY`. No subas secretos `.env` como archivos públicos. No copies una base activa con escrituras en curso.
5. Conserva una copia de base y adjuntos antes de cada despliegue con migraciones. Un rollback de código no revierte automáticamente la base. La base debe residir fuera de versiones eliminables; configura backups y comprueba que incluyen esa ruta.
6. Revisión manual después de desplegar: Google login, listado de proyectos, sitio en el canvas, creación de pin/comentario, adjunto y persistencia tras un redespliegue. Esto queda pendiente de acceso al alojamiento; no se ha publicado ni validado en SiteGround desde este repositorio.

La conexión GitHub puede activar redespliegues en cada push de la rama vinculada. Configura primero las variables de cada proyecto; si los tres despliegan simultáneamente, evita cambios incompatibles de contratos o usa despliegues manuales ordenados.

## Fuentes oficiales consultadas

- [Disponibilidad y planes](https://www.siteground.com/kb/node-js-available)
- [Proyectos, gestión y despliegue desde GitHub](https://www.siteground.com/kb/what-is-node-js-project)
- [Opciones de build, bases, SSL y SSH](https://www.siteground.com/blog/hosting-node-js-projects-with-siteground)

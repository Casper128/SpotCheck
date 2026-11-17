# SiteGround: repositorio y despliegue unificados

## Proyecto

Usa un proyecto Node desde `Casper128/SpotCheck`, rama `main`, Node 22. Desde la raíz completa del repositorio:

- Instalación: `npm ci --include=dev` o `npm install` si el panel lo establece.
- Build: `npm run build` (escribe `run build` si el panel ya muestra `npm`).
- Inicio: `npm start` → `node scripts/start.mjs`.

El build genera Prisma PostgreSQL, compila backend/shared, construye Next con Webpack/PostCSS y comprueba sintaxis del proxy. El arranque ejecuta las migraciones contra la base real y abre un solo puerto, usando `PORT` del proveedor. SiteGround debe ejecutar el script `start` del package.json raíz; si autodetecta Next y ejecuta otro comando, debe ajustarse ese arranque. No se usa salida estática ni `next start` directamente.

## Dos hosts, un proceso

Asigna `spotcheck.mrmamba.com` a la aplicación y `preview.mrmamba.com` al proxy, ambos dirigidos al MISMO proyecto Node. El servidor distingue por Host. En el host de aplicación, `/api`, `/swagger` y `/health` atienden Fastify y las demás rutas atienden Next. En el host proxy solo responde el proxy aislado.

**Requisito por confirmar con SiteGround:** que un proyecto pueda recibir ambos dominios y que la capa HTTP preserve el Host solicitado. La documentación pública consultada explica cambiar el dominio principal, pero no garantiza alias adicionales para proyectos Node. Crear registros DNS por sí solo no vincula esos hosts al proyecto. Si SiteGround no permite esa entrada, no se puede prometer un solo despliegue allí con el aislamiento actual; habría que publicar el proxy como otro proyecto desde este mismo repositorio o usar una entrada que admita varios hosts. No cambies los registros de `mrmamba.com` principal.

## Variables de producción

Configura todas en el panel del mismo proyecto. Sustituye los ejemplos de conexión, rutas y dominios por los reales:

```dotenv
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST:5432/BASE?schema=public
UPLOAD_DIRECTORY=/RUTA_PERSISTENTE/uploads
FRONTEND_ORIGIN=https://spotcheck.mrmamba.com
PUBLIC_API_ORIGIN=https://spotcheck.mrmamba.com
PROXY_ORIGIN=https://preview.mrmamba.com
NEXT_PUBLIC_API_URL=https://spotcheck.mrmamba.com
NEXT_PUBLIC_PROXY_ORIGIN=https://preview.mrmamba.com
GOOGLE_CLIENT_ID=TU_CLIENT_ID_WEB.apps.googleusercontent.com
SESSION_SECRET=SECRETO_ALEATORIO_NUEVO_DE_AL_MENOS_32_CARACTERES
SESSION_COOKIE_SECURE=true
NODE_ENV=production
```

`APP_ORIGIN` no hace falta en modo unificado: se deriva de `FRONTEND_ORIGIN`. No fuerces PORT=4000; conserva el puerto que asigne el alojamiento. Codifica caracteres especiales del usuario/contraseña en la URL PostgreSQL. Si el proveedor exige TLS, añade su configuración SSL indicada a DATABASE_URL, por ejemplo `&sslmode=require`; no desactives la verificación por defecto sin indicación del proveedor. Genera SESSION_SECRET una vez con `openssl rand -hex 32`; no reutilices secretos expuestos en el chat. Nunca subas las variables privadas a Git.

Las variables `NEXT_PUBLIC_*` se incorporan en el build: debes reconstruir al cambiarlas. Mantén API y frontend con el mismo origen y proxy con host distinto. Las rutas de archivos deben ser escribibles y persistentes fuera de directorios de build reemplazables.

## PostgreSQL

Crea una base vacía en SiteGround y usa sus credenciales reales. El código usa el proveedor PostgreSQL de Prisma y una migración inicial específica. La consulta workspace utiliza CTE, joins y row_to_json con parámetros, manteniendo una consulta y permisos por organización. Las migraciones SQLite antiguas son solo historia y NO deben copiarse a la base nueva. El código no importa ni borra datos SQLite anteriores.

El inicio aplica `prisma migrate deploy` antes de aceptar tráfico y falla si la conexión o la migración falla. No pongas credenciales reales en el build ni ejecutes `db push --accept-data-loss`. Si ya existe un esquema PostgreSQL con tablas de otra instalación, respáldalo y planifica una migración/baseline: la migración inicial está diseñada para una base vacía.

## Google y revisión posterior

En el cliente OAuth web de Google autoriza `https://spotcheck.mrmamba.com` como origen JavaScript. No hace falta Auth0 ni el SDK de Firebase. Cada login verificado crea o conserva la organización del usuario; se mantiene la ausencia de aprobación manual.

Después del despliegue comprueba manualmente:

1. `/swagger/` y `/api/config` en el dominio principal.
2. `/health`: debe devolver `{"status":"ok"}` tras consultar PostgreSQL.
3. Frontend, Google login, proyecto, pin, comentario y adjunto.
4. `/health` del host proxy y sitio público dentro del canvas.
5. Que los adjuntos y registros sobrevivan a un redespliegue.

No se ha accedido a tu cuenta SiteGround ni confirmado sus credenciales, almacenamiento o alias. Un build correcto no verifica esas condiciones.

Los repositorios `backend-spotcheck` y `proxy-spotcheck` se conservan como copias históricas; este repositorio vuelve a ser la fuente del despliegue completo. Puedes pausar los despliegues separados cuando el unificado esté operativo.

## Referencias

- [Proyectos Node.js](https://www.siteground.com/kb/what-is-node-js-project)
- [Dominio principal del proyecto](https://www.siteground.com/kb/change-domain-node-js-project)

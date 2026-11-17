# Mr. Mamba Review

Revisión de sitios e imágenes con pines, comentarios, respuestas y resolución, compartida entre miembros aprobados de una organización. Kiro nombra únicamente los agentes de desarrollo.

## Arranque con Docker

```bash
npm run docker:up
```

Este comando prepara los `.env` sin sobrescribirlos, genera una clave privada de sesión si falta y levanta los tres servicios:

- UI: [localhost:3001](http://localhost:3001)
- API: [localhost:4000/health](http://localhost:4000/health)
- Proxy aislado: [localhost:3002/health](http://localhost:3002/health)

También puedes ejecutar `npm run env:prepare` seguido de `docker compose up --build -d --remove-orphans`. Backend aplica migraciones aditivas al iniciar y es el único servicio que monta el volumen **`usewpastel_pastel-data`** en `/app/data`. Se conservan proyectos, pines, comentarios e imágenes. Los proyectos anteriores sin organización quedan protegidos hasta su asignación administrativa explícita.

```bash
docker compose ps
docker compose logs -f backend frontend
docker compose down  # conserva el volumen; no añadir -v
```

## Google y aprobación de cuentas

El Client ID todavía no está configurado. La UI muestra «Continue with Google» deshabilitado y un mensaje; las APIs privadas rechazan accesos anónimos. No hay acceso invitado ni una simulación de Google en producción.

1. Crea un cliente OAuth de tipo **aplicación web** en Google Cloud y autoriza el origen de la UI: `http://localhost:3001` para Docker, `http://localhost:3000` para desarrollo y tu origen HTTPS en producción.
2. Configura `GOOGLE_CLIENT_ID` en `backend/.env` y vuelve a ejecutar `npm run docker:up`. No se necesita un client secret para este flujo de verificación de ID Token. `SESSION_SECRET` permanece solo en backend; no lo publiques ni lo copies al frontend.
3. Inicia sesión con Google y entra directamente. No hay aprobación manual: cada cuenta nueva recibe un espacio personal automáticamente. Las cuentas que ya pertenecen a un equipo conservan su organización. `/account-status` muestra el perfil y permite abrir los proyectos.

El acceso no requiere consola ni aprobación. El CLI **privado del backend** solo se utiliza para agrupar cuentas en un mismo equipo o asignar proyectos históricos, sin abrir datos de otras organizaciones. Lista los usuarios verificados y utiliza su `googleSub`:

```bash
docker compose exec -T backend npm run access:production --workspace @spotcheck/backend -- users

docker compose exec -T backend npm run access:production --workspace @spotcheck/backend -- organization --id equipo-1 --name "Mi equipo"

docker compose exec -T backend npm run access:production --workspace @spotcheck/backend -- membership --google-sub SUB_VERIFICADO --organization equipo-1

docker compose exec -T backend npm run access:production --workspace @spotcheck/backend -- assign-project --project ID_O_SHAREID --organization equipo-1
```

Reasignar un proyecto ya perteneciente a otro equipo requiere `--allow-reassign` explícito. Las cuentas no se agrupan automáticamente por dominio de correo ni se adjudican proyectos históricos al primer usuario que acceda. El campo técnico `status` se mantiene por compatibilidad de almacenamiento/API, pero ya no aprueba ni bloquea usuarios.

Google se verifica en backend (firma, audiencia, emisor, expiración, email verificado y nonce de un solo uso). La sesión JWT se guarda en cookie HttpOnly, SameSite=Lax; Secure es obligatorio en producción fuera de localhost HTTP. Para Docker local `SESSION_COOKIE_SECURE=false` permite HTTP local; una URL API HTTPS de producción fuerza Secure. UI y API deben estar bajo el mismo sitio y CORS permite solo el origen UI configurado con credenciales. Cada operación comprueba la membresía vigente; usuarios de otra organización no acceden a proyectos ni a sus imágenes, incluso con el enlace.

## Sitio fijo y workspace rápido

Un proyecto web conserva su sitio base. La vista carga `GET /api/projects/:id/workspace` con **una consulta SQL total**, incluida la autorización vigente, datos, pines y comentarios. Las rutas del selector tienen pines; un proyecto vacío abre su sitio base para colocar el primero. No hay explorador de URLs ni botón «Ir».

El shell aparece con skeleton; rutas y pines se conservan en memoria por usuario/organización/proyecto. Cambiar de ruta no vuelve a consultar la API y las escrituras actualizan el cache. «Actualizar comentarios» permite sincronizar cambios de otros usuarios. Logout, cambio de organización o denegación de acceso limpian el cache; respuestas antiguas no lo repueblan.

**Elemento**, **Contenedor**, **Punto libre** e **Interactuar** mantienen el inspector. Proxy restringe documentos/enlaces/redirecciones al origen del proyecto sin bloquear recursos CDN; backend rechaza nuevos pines de otro sitio. Los snapshots históricos de otro origen se conservan en BD, pero se omiten del workspace. DNS/IP fijados, límites de tiempo/tamaño/concurrencia y origen/nonce del puente mantienen sus controles.

El proxy admite GET de sitios públicos; sesiones, formularios, WebSockets y ciertas SPAs/importaciones dinámicas requieren integración directa y el snippet del propietario. Sin puente, Punto libre es relativo al viewport y no sigue el scroll interno. SQLite/archivos locales están orientados a una instancia.

## Desarrollo local y estructura

Requisitos: **Node.js 22+**, npm; Docker Compose para contenedores.

```bash
npm ci
npm run setup
npm run dev
```

`setup` prepara `.env`, instala dependencias del proxy, genera Prisma, migra la BD y construye shared. `dev` inicia shared en watch, backend en 4000 y Next UI en 3000. La BD local vive en `backend/prisma/dev.db`; imágenes en `backend/data/uploads`.

```bash
APP_ORIGIN=http://localhost:3000 npm --prefix proxy start
```

Para producción local compilada: `npm run build` y `npm start` (backend + frontend; proxy opcional aparte). El CLI local es `npm run access --workspace @spotcheck/backend -- <comando>`.

- `backend/`: Fastify + TypeScript, negocio, Prisma/SQLite, Google/sesiones y permisos.
- `frontend/`: Next.js/React solo UI, cliente HTTP y estado; sin BD ni secretos.
- `shared/`: contratos Zod y DTO únicos.
- `proxy/`: servicio auxiliar aislado.
- `scripts/` y `docs/`: arranque, comprobaciones y documentación.

Ambas aplicaciones tienen `src/domain`, `src/application`, `src/infrastructure`, `src/presentation`. Next usa adaptadores mínimos en `frontend/app`. En la raíz permanecen workspaces/lockfile, configuración compartida de TypeScript/ESLint y Compose. `node_modules/` se regenera con `npm ci`. Los restos antiguos se archivaron fuera del proyecto en `../usewpastel-backups/`.

El Design System usa fondo `#09090B`, superficies `#121215`/`#161618`, borde `#27272A`, texto `#FAFAFA`/`#A1A1AA`, acciones blancas y pines ámbar. Los tokens CSS son la fuente de color; incluye foco visible, reduced-motion y paneles adaptables.

## Orígenes y puertos

```bash
SPOTCHECK_PORT=3010 SPOTCHECK_API_PORT=4010 SPOTCHECK_PROXY_PORT=3012 npm run docker:up
```

En otro equipo o HTTPS configura orígenes públicos exactos, sin barra final:

```bash
SPOTCHECK_APP_ORIGIN=https://review.example.com \
SPOTCHECK_API_ORIGIN=https://api.example.com \
SPOTCHECK_PROXY_ORIGIN=https://preview.example.net npm run docker:up
```

Cambiar API/proxy requiere reconstruir frontend porque Next incorpora estas variables públicas durante build. Configura TLS/enrutamiento hacia cada servicio y mantén app/proxy en orígenes distintos. Backend recibe `.env` privada y frontend solo variables `NEXT_PUBLIC_*` de URLs públicas.

## Comprobaciones

```bash
npm run typecheck
npm run check:architecture
npm run lint
npm test
npm run build
npm run test:r4  # requiere Docker arrancado
```

`test:r1`, `test:r2` y `test:r3` cubren cada módulo; la suite global incluye contratos, reglas de arquitectura/residuos, backend, frontend y proxy sin repetir suites. `test:m4 -- --config-only` valida Compose sin consultar servicios.

[Plan](docs/ARCHITECTURE_MIGRATION_PLAN.md) · [QA](docs/QA_MIGRATION_REPORT.md)

## Publicación en SiteGround

Consulta [la guía de despliegue](docs/DEPLOY_SITEGROUND.md) para `spotcheck.mrmamba.com`: tres servicios Node 22, variables, Google OAuth y conservación de base de datos y adjuntos.

# SpotCheck

Frontend Next.js, backend Fastify y proxy del inspector en un solo repositorio. `npm start` inicia un único proceso y puerto HTTP. La aplicación y API comparten origen; el contenido externo del proxy conserva un host separado, que debe llegar al mismo despliegue.

```text
frontend/  interfaz Next.js
backend/   API, Google, permisos, Swagger y Prisma/PostgreSQL
proxy/     proxy aislado para sitios públicos
shared/    contratos canónicos utilizados por frontend y backend
scripts/   arranque unificado y herramientas
```

## Instalación y ejecución

Node 22 y PostgreSQL. Desde la raíz:

```bash
npm ci --include=dev
npm run setup
# Configura PostgreSQL y las variables de backend/.env y frontend/.env
npm run build
npm start
```

El arranque aplica `prisma migrate deploy` y después inicia los tres componentes. No se realizan migraciones durante el build. El usuario de la BD necesita permisos para crear las tablas en el esquema configurado. En producción configura las variables en el panel del alojamiento: consulta `.env.example` (el arranque local carga `backend/.env`; el frontend lee `frontend/.env` al compilar). `npm run dev` prepara el backend y usa el mismo servidor con Next en desarrollo; reinicia si cambias código del backend.

## URLs del mismo despliegue

- `https://spotcheck.mrmamba.com/`: frontend.
- `https://spotcheck.mrmamba.com/api/*`: API.
- `https://spotcheck.mrmamba.com/swagger/`: Swagger.
- `https://spotcheck.mrmamba.com/health`: servidor y consulta PostgreSQL.
- `https://preview.mrmamba.com/`: proxy de sitios externos, dirigido al mismo proceso Node.

No sirve publicar contenido externo bajo el origen autenticado de la aplicación. El servidor enruta por el encabezado Host y rechaza hosts no configurados. SiteGround debe admitir ambos hosts en un proyecto y preservar Host. Si solo admite un dominio por proyecto, el repositorio sigue siendo uno, pero será necesario desplegar el proxy aparte o usar un proveedor/entrada HTTP que permita varios hosts.

## Base de datos y datos anteriores

La base activa es PostgreSQL. Las migraciones SQLite antiguas están archivadas en `docs/history/sqlite-migrations` y no se ejecutan. No apuntes este código a un archivo SQLite ni reutilices el historial SQLite como historial PostgreSQL. La migración inicial crea una base PostgreSQL nueva; los datos SQLite anteriores NO se importan automáticamente. Conserva el volumen histórico `usewpastel_pastel-data` y exporta/importa los datos por separado si necesitas trasladarlos, preservando IDs y relaciones.

Los adjuntos siguen siendo archivos locales y requieren `UPLOAD_DIRECTORY` persistente entre despliegues; PostgreSQL no guarda su contenido. Haz backups de BD y archivos.

## Docker

Define `POSTGRES_PASSWORD` con una contraseña fuerte apta para URL (por ejemplo hexadecimal) en tu entorno o `.env` raíz; ejecuta `npm run docker:up`. Compose crea `app` y `postgres`, con volúmenes nuevos y separados, sin migrar ni eliminar el volumen SQLite histórico. Para desarrollo, la app abre en `http://localhost:3001` y el proxy en `http://preview.localhost:3001`; ambos llegan al mismo puerto. Si el sistema no resuelve `preview.localhost`, añade una entrada local hacia 127.0.0.1. No uses `down -v` con datos que quieras conservar.

## Verificación

`npm run typecheck`, `npm run lint`, `npm run check:architecture`, `npm test`.

Las pruebas de integración del backend requieren `TEST_DATABASE_URL` apuntando a una base PostgreSQL desechable con permiso para crear esquemas. Cada fixture crea y elimina su propio esquema; nunca usa automáticamente la conexión de producción. La prueba histórica de backfill SQLite quedó archivada; las pruebas de workspace y persistencia cubren la base nueva.

[Despliegue SiteGround](docs/DEPLOY_SITEGROUND.md). Los planes e informes antiguos documentan etapas anteriores y no sustituyen esta guía.

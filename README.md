# SpotCheck

Frontend Next.js, backend Fastify y proxy del inspector en un solo repositorio. `npm start` inicia un único proceso y puerto HTTP. La aplicación, API y proxy comparten dominio. El proxy vive bajo `/proxy` y sus documentos se ejecutan en un sandbox de origen opaco.

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

- `https://juane17.sg-host.com/`: frontend.
- `https://juane17.sg-host.com/api/*`: API.
- `https://juane17.sg-host.com/swagger/`: Swagger.
- `https://juane17.sg-host.com/health`: servidor y consulta PostgreSQL.
- `https://juane17.sg-host.com/proxy/`: proxy de sitios externos, dentro del mismo proceso Node.

El proxy usa sandbox HTTP y de iframe sin `allow-same-origin`, bloquea frames, formularios y workers, y limita scripts y conexiones a `/proxy`. Los mensajes del inspector validan ventana, origen opaco y nonce. Los sitios que necesitan almacenamiento, cookies o ciertos comportamientos SPA pueden requerir integración mediante snippet. No se necesitan alias ni otro proyecto Node.

## Base de datos y datos anteriores

La base activa es PostgreSQL. Las migraciones SQLite antiguas están archivadas en `docs/history/sqlite-migrations` y no se ejecutan. No apuntes este código a un archivo SQLite ni reutilices el historial SQLite como historial PostgreSQL. La migración inicial crea una base PostgreSQL nueva; los datos SQLite anteriores NO se importan automáticamente. Conserva el volumen histórico `usewpastel_pastel-data` y exporta/importa los datos por separado si necesitas trasladarlos, preservando IDs y relaciones.

Los adjuntos siguen siendo archivos locales y requieren `UPLOAD_DIRECTORY` persistente entre despliegues; PostgreSQL no guarda su contenido. Haz backups de BD y archivos.

## Docker

Define `POSTGRES_PASSWORD` con una contraseña fuerte apta para URL (por ejemplo hexadecimal) en tu entorno o `.env` raíz; ejecuta `npm run docker:up`. Compose crea `app` y `postgres`, con volúmenes nuevos y separados, sin migrar ni eliminar el volumen SQLite histórico. Para desarrollo, la app abre en `http://localhost:3001` y el proxy en `http://localhost:3001/proxy/`; ambos llegan al mismo puerto. No uses `down -v` con datos que quieras conservar.

## Verificación

`npm run typecheck`, `npm run lint`, `npm run check:architecture`, `npm test`.

Las pruebas de integración del backend requieren `TEST_DATABASE_URL` apuntando a una base PostgreSQL desechable con permiso para crear esquemas. Cada fixture crea y elimina su propio esquema; nunca usa automáticamente la conexión de producción. La prueba histórica de backfill SQLite quedó archivada; las pruebas de workspace y persistencia cubren la base nueva.

[Despliegue SiteGround](docs/DEPLOY_SITEGROUND.md). Los planes e informes antiguos documentan etapas anteriores y no sustituyen esta guía.

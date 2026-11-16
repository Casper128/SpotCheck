# SpotCheck

MVP de SpotCheck para revisar páginas web e imágenes con comentarios anclados, hilos y resolución de pines.

## Requisitos

- Node.js 20.9 o posterior
- npm

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run db:migrate -- --name init
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La base SQLite se guarda en `prisma/dev.db`; las imágenes PNG/JPG, de hasta 10 MB, se guardan en `data/uploads/` y se sirven mediante una ruta segura de la aplicación.

## Arrancar con Docker Compose

Requiere Docker Desktop con Compose v2.

```bash
docker compose up --build -d
```

Abre [http://localhost:3001](http://localhost:3001). Compose construye la aplicación, aplica las migraciones Prisma al iniciar y guarda la base de datos y las imágenes en el volumen persistente de Docker.

```bash
docker compose logs -f app   # ver el arranque y los logs
docker compose down         # parar; conserva los datos
```

Si el puerto 3001 también está ocupado:

```bash
SPOTCHECK_PORT=3002 docker compose up --build -d
```

`docker compose down -v` elimina también el volumen y todos los datos guardados.

## Funcionalidades

- Crear una revisión con una URL HTTP(S) o una imagen PNG/JPG.
- Compartir `/review/[shareId]`; cada invitado entra con un nombre, sin contraseña.
- Activar **Comentar**, elegir una posición, escribir comentarios y responder en el hilo.
- Filtrar puntos pendientes/resueltos y marcar puntos como resueltos.
- Guardar dimensiones de ventana, navegador, sistema operativo y URL revisada por punto.

Los sitios que bloquean iframes no pueden mostrarse dentro de la aplicación; se pueden abrir aparte y los pines siguen disponibles sobre el área de revisión. La URL externa se carga directamente en el navegador; el servidor no la solicita.

La subida local es para desarrollo y una única instancia. Para producción, usa almacenamiento compartido y una base persistente adecuados a tu despliegue. Los enlaces compartibles son el único control de acceso del MVP; cualquiera que tenga el enlace puede ver y comentar.

## Arquitectura

- `src/domain` — entidades y reglas de negocio puras.
- `src/application` — casos de uso y contratos.
- `src/infrastructure` — Prisma/SQLite, IDs, reloj y almacenamiento local de imágenes.
- `src/presentation` — adaptadores HTTP, componentes y estado Zustand.
- `src/app` — rutas Next.js App Router.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm run build
```

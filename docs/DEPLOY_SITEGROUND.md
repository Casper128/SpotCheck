# Frontend SpotCheck en SiteGround

Este repositorio contiene frontend, contratos compartidos y proxy. La API se publica desde [backend-spotcheck](https://github.com/Casper128/backend-spotcheck).

## Frontend

Crea o conserva el proyecto Node conectado a `Casper128/SpotCheck`, rama `main`. Usa Node 22, instalación `npm ci --include=dev` (o `npm install` si el panel lo establece), build `npm run build` e inicio `npm start`. Si el panel ya muestra `npm`, el campo de build debe contener `run build`.

El build compila `shared` y Next.js usando Webpack/PostCSS. El inicio ejecuta solo Next.js, escucha en todas las interfaces y utiliza el `PORT` asignado por el alojamiento. El arranque del proveedor debe ejecutar el script `start`; si autodetecta otro entrypoint, configura o confirma ese mecanismo con SiteGround.

Configura estas variables ANTES de compilar:

```dotenv
NEXT_PUBLIC_API_URL=https://DOMINIO_REAL_DE_LA_API
NEXT_PUBLIC_PROXY_ORIGIN=https://DOMINIO_REAL_DEL_PROXY
```

Sustituye los marcadores por servicios ya publicados; no uses localhost ni dominios propuestos que todavía no existen. Después de cambiar variables `NEXT_PUBLIC_*`, reconstruye. No configures `DATABASE_URL`, `SESSION_SECRET` ni credenciales privadas de backend aquí.

Asigna `spotcheck.mrmamba.com` desde Client Area → Websites → Node.js Projects → proyecto frontend → Change Primary Domain → Existing Domain. Verifica DNS y HTTPS sin alterar los registros del sitio principal `mrmamba.com`. Si creaste un sitio convencional con ese mismo nombre, resuelve el conflicto de asignación antes de continuar.

## Backend externo

Publica otro proyecto desde `Casper128/backend-spotcheck`. Su README contiene instalación, build, inicio y variables. En el backend, `FRONTEND_ORIGIN` debe coincidir con la URL real del frontend, sin barra final. Autoriza esa URL en el cliente OAuth web de Google.

Comprueba en el dominio de la API `/swagger/`, `/api/config` y `/health`. Swagger confirma que el proceso sirve documentación; `/health` también consulta la base. Una página 404 de Next.js significa que estás consultando el frontend, sin encaminamiento a la API.

El backend independiente conserva SQLite por ahora; PostgreSQL requiere una adaptación separada. Base y adjuntos necesitan persistencia. Usa frontend y API bajo subdominios de `mrmamba.com` para que la configuración actual de cookies SameSite funcione entre ambos.

## Proxy

Publica un tercer proyecto desde este repositorio: build `npm run build:proxy`, inicio `npm run start:proxy`. Configura:

```dotenv
APP_ORIGIN=https://spotcheck.mrmamba.com
PROXY_ORIGIN=https://DOMINIO_REAL_DEL_PROXY
```

El proxy debe utilizar un origen separado del frontend y la API. Confirma el mecanismo de inicio del proyecto Custom con el alojamiento. Necesita el repositorio completo porque sirve `frontend/public/spotcheck-inspector.js`.

## Datos y despliegues

El Compose de este repositorio solo administra frontend y proxy; la API se administra aparte. El volumen Docker histórico `usewpastel_pastel-data` no se elimina con este cambio. No ejecutes `docker compose down -v` sobre instalaciones que contienen datos. Conserva una copia coherente de SQLite y adjuntos antes de moverlos.

Los pushes a `main` pueden disparar el despliegue automático del frontend. La API tiene su propia rama `main` en su propio repositorio: los pushes aquí ya no publican el backend.

## Fuentes oficiales

- [Proyectos Node.js y despliegues](https://www.siteground.com/kb/what-is-node-js-project)
- [Asignar dominio al proyecto](https://www.siteground.com/kb/change-domain-node-js-project)

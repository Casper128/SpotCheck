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

Abre [http://localhost:3001](http://localhost:3001). Compose construye la aplicación y el proxy aislado (puerto 3002), aplica las migraciones Prisma al iniciar y guarda la base de datos y las imágenes en el volumen persistente de Docker. El visor usa el proxy por defecto; la casilla «Revisar mediante proxy» permite cambiar a integración directa.

```bash
docker compose logs -f app   # ver el arranque y los logs
docker compose down         # parar; conserva los datos
```

Si el puerto 3001 también está ocupado:

```bash
SPOTCHECK_PORT=3002 docker compose up --build -d
```

Las migraciones se aplican antes del arranque. Las migraciones de rutas, anclaje DOM y desplazamiento son aditivas y conservan proyectos, pines antiguos por coordenadas, comentarios y el volumen existente. `docker compose down -v` elimina también el volumen y todos los datos guardados.

## Funcionalidades

- Crear una revisión con una URL HTTP(S) o una imagen PNG/JPG.
- Compartir `/review/[shareId]`; cada invitado entra con un nombre, sin contraseña.
- Elegir **Elemento**, **Contenedor** o **Punto libre** para ubicar comentarios; escribir respuestas en el hilo.
- Filtrar puntos pendientes/resueltos y marcar puntos como resueltos.
- Guardar dimensiones de ventana, navegador, sistema operativo y URL revisada por punto.
- Revisar varias rutas de un mismo sitio desde el selector de página; los puntos se filtran por ruta y su numeración sigue siendo global en todo el proyecto.

El selector se rellena con las rutas observadas en los pines y la ruta de origen. Se puede elegir una ruta o introducir una URL/ruta manualmente. Sin integración del sitio, el navegador impide a SpotCheck leer el DOM o detectar cambios de ruta en un iframe externo; los pines libres siguen disponibles como coordenadas del viewport.

### Integración opcional del inspector DOM

La barra ofrece herramientas mutuamente excluyentes: **Elemento** selecciona el nodo elegible más profundo; **Contenedor** permite escoger entre el nodo y sus ancestros; **Punto libre** guarda solo coordenadas, sin selector DOM; y **Navegar** devuelve la interacción al sitio. Elemento/Contenedor requieren que el propietario añada antes de `</body>` el snippet de **Integración del sitio**. Este carga `/spotcheck-inspector.js`, limitado al origen exacto de SpotCheck y al host permitido, y no realiza solicitudes a terceros.

Con el puente, pines DOM y puntos libres registran el desplazamiento del iframe y siguen el contenido. Sin puente, Punto libre usa coordenadas del viewport: el marcador mantiene su proporción al redimensionar el canvas, pero no sigue el scroll interno. La UI lo advierte explícitamente. Los sitios que bloquean iframes no pueden mostrarse dentro de la aplicación.

La integración no elude el aislamiento del navegador: el iframe externo conserva un sandbox restrictivo. A sitios de otro origen que requieren el puente se les permite `allow-same-origin` junto con `allow-scripts`; al ser otro origen respecto de SpotCheck, no concede acceso DOM al padre. Un destino del mismo origen que la aplicación nunca recibe esa combinación. Los mensajes requieren origen, ventana fuente, versión y nonce de sesión exactos; nunca se acepta el origen opaco `null` ni se usa `*`.

### Proxy aislado sin snippet

Docker arranca un servicio independiente en `http://localhost:3002`. Reescribe páginas HTML, recursos CSS y enlaces e inyecta el mismo inspector cooperativo. Los mensajes conservan la validación de origen, ventana, versión y nonce; el visor traduce la URL del proxy a la URL original antes de guardar rutas y pines.

El proxy solo consulta HTTP(S) público en puertos estándar; valida todas las direcciones DNS y fija una IP validada en cada conexión, incluidas las redirecciones. Bloquea redes privadas, loopback, link-local y direcciones reservadas; no reenvía credenciales, cookies ni cabeceras de autenticación. Limita redirecciones, tiempo, tamaño y concurrencia. Las páginas se sirven en un origen separado, con CSP y sin formularios, frames ni workers. No se permite usar el mismo origen para app y proxy.

Este modo está orientado a páginas públicas. Sesiones, formularios, WebSockets y algunas aplicaciones que generan URLs o módulos dinámicamente requieren integración directa; no se garantiza compatibilidad con cualquier sitio.

Para otro dominio o equipo, configura los **orígenes públicos que abrirá el navegador** (sin barra final), usando HTTPS en ambos si publicas la app mediante HTTPS:

```bash
SPOTCHECK_APP_ORIGIN=https://review.example.com \
SPOTCHECK_PROXY_ORIGIN=https://preview.example.net \
docker compose up --build -d
```

`SPOTCHECK_PORT` y `SPOTCHECK_PROXY_PORT` cambian los puertos publicados (3001 y 3002 por defecto). En local los orígenes se ajustan automáticamente a esos puertos. En desarrollo sin Docker, ejecuta `npm ci --prefix proxy`, `npm --prefix proxy start` y configura `SPOTCHECK_PROXY_ORIGIN=http://localhost:3002` para Next y `APP_ORIGIN=http://localhost:3000` para el proxy.

Las imágenes subidas usan su URL de imagen como ruta de origen y conservan el flujo habitual de revisión.

La subida local es para desarrollo y una única instancia. Para producción, usa almacenamiento compartido y una base persistente adecuados a tu despliegue. Los enlaces compartibles son el único control de acceso del MVP; cualquiera que tenga el enlace puede ver y comentar.

## Arquitectura

- `src/domain` — entidades y reglas de negocio puras.
- `src/application` — casos de uso y contratos.
- `src/infrastructure` — Prisma/SQLite, IDs, reloj y almacenamiento local de imágenes.
- `src/presentation` — adaptadores HTTP, componentes y estado Zustand.
- `src/app` — rutas Next.js App Router.
- `proxy/` — servicio de navegación aislado con validación de egreso e inyección del inspector.
- `public/spotcheck-inspector.js` — puente cooperativo, instalado explícitamente por el propietario del sitio.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm test
npm --prefix proxy test
npm run build
```

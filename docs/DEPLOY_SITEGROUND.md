# SiteGround: repositorio y despliegue unificados

## Proyecto

Usa un proyecto Node desde `Casper128/SpotCheck`, rama `main`, Node 22. Desde la raíz completa del repositorio:

- Instalación: `npm ci --include=dev` o `npm install` si el panel lo establece.
- Build: `npm run build` (escribe `run build` si el panel ya muestra `npm`).
- Inicio: `npm start` → `node scripts/start.mjs`.

El build genera Prisma PostgreSQL, compila backend/shared, construye Next con Webpack/PostCSS y comprueba sintaxis del proxy. El arranque ejecuta las migraciones contra la base real y abre un solo puerto, usando `PORT` del proveedor. SiteGround debe ejecutar el script `start` del package.json raíz; si autodetecta Next y ejecuta otro comando, debe ajustarse ese arranque. No se usa salida estática ni `next start` directamente.

## Una URL y un proceso

Asigna `juane17.sg-host.com` al proyecto. `/api/*`, `/swagger/*` y `/health` atienden Fastify; `/proxy` y `/proxy/*` atienden el proxy; las demás rutas las gestiona Next.js. No se necesitan subdominios, alias ni proyectos adicionales.

El proxy sirve documentos bajo sandbox HTTP `allow-scripts`, sin `allow-same-origin`, y el iframe mantiene el mismo aislamiento. Incluso abrir directamente una página del proxy conserva el origen opaco. CSP restringe scripts/recursos y conexiones al endpoint proxy, bloquea formularios, objetos, frames y workers. El inspector comprueba la ventana emisora, origen `null`, protocolo y nonce; las órdenes al iframe opaco usan `postMessage` a su ventana concreta. La integración directa mediante snippet conserva su validación de origen habitual.

Las páginas externas no tienen acceso al DOM, almacenamiento o cookies de la aplicación. Algunos sitios que requieren sesión o APIs incompatibles con sandbox necesitan integración directa. No añadas `allow-same-origin` para solucionarlo.

## Variables de producción

Configura todas en el panel del mismo proyecto. Sustituye los ejemplos de conexión, rutas y dominios por los reales:

```dotenv
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST:5432/BASE?schema=public
UPLOAD_DIRECTORY=/RUTA_PERSISTENTE/uploads
FRONTEND_ORIGIN=https://juane17.sg-host.com
PUBLIC_API_ORIGIN=https://juane17.sg-host.com
PROXY_ORIGIN=https://juane17.sg-host.com/proxy
NEXT_PUBLIC_API_URL=https://juane17.sg-host.com
NEXT_PUBLIC_PROXY_ORIGIN=https://juane17.sg-host.com/proxy
GOOGLE_CLIENT_ID=TU_CLIENT_ID_WEB.apps.googleusercontent.com
SESSION_SECRET=SECRETO_ALEATORIO_NUEVO_DE_AL_MENOS_32_CARACTERES
SESSION_COOKIE_SECURE=true
NODE_ENV=production
```

`APP_ORIGIN` no hace falta en modo unificado: se deriva de `FRONTEND_ORIGIN`. No fuerces PORT=4000; conserva el puerto que asigne el alojamiento. Codifica caracteres especiales del usuario/contraseña en la URL PostgreSQL. Si el proveedor exige TLS, añade su configuración SSL indicada a DATABASE_URL, por ejemplo `&sslmode=require`; no desactives la verificación por defecto sin indicación del proveedor. Genera SESSION_SECRET una vez con `openssl rand -hex 32`; no reutilices secretos expuestos en el chat. Nunca subas las variables privadas a Git.

Las variables `NEXT_PUBLIC_*` se incorporan en el build: debes reconstruir al cambiarlas. Mantén API y frontend con el mismo origen y configura ambas variables del proxy con ese origen seguido de `/proxy`. Las rutas de archivos deben ser escribibles y persistentes fuera de directorios de build reemplazables.

## PostgreSQL

Crea una base vacía en SiteGround y usa sus credenciales reales. El código usa el proveedor PostgreSQL de Prisma y una migración inicial específica. La consulta workspace utiliza CTE, joins y row_to_json con parámetros, manteniendo una consulta y permisos por organización. Las migraciones SQLite antiguas son solo historia y NO deben copiarse a la base nueva. El código no importa ni borra datos SQLite anteriores.

El inicio aplica `prisma migrate deploy` antes de aceptar tráfico y falla si la conexión o la migración falla. No pongas credenciales reales en el build ni ejecutes `db push --accept-data-loss`. Si ya existe un esquema PostgreSQL con tablas de otra instalación, respáldalo y planifica una migración/baseline: la migración inicial está diseñada para una base vacía.

## Google y revisión posterior

En el cliente OAuth web de Google autoriza `https://juane17.sg-host.com` como origen JavaScript. No hace falta Auth0 ni el SDK de Firebase. Cada login verificado crea o conserva la organización del usuario; se mantiene la ausencia de aprobación manual.

Después del despliegue comprueba manualmente:

1. `/swagger/` y `/api/config` en el mismo dominio.
2. `/health`: debe devolver `{"status":"ok"}` tras consultar PostgreSQL.
3. Frontend, Google login, proyecto, pin, comentario y adjunto.
4. `/proxy/health` del mismo dominio y sitio público dentro del canvas.
5. Que los adjuntos y registros sobrevivan a un redespliegue.

No se ha accedido a tu cuenta SiteGround ni confirmado sus credenciales, almacenamiento. Un build correcto no verifica esas condiciones.

Los repositorios `backend-spotcheck` y `proxy-spotcheck` se conservan como copias históricas; este repositorio vuelve a ser la fuente del despliegue completo. Puedes pausar los despliegues separados cuando el unificado esté operativo.

## Referencias

- [Proyectos Node.js](https://www.siteground.com/kb/what-is-node-js-project)
- [Dominio principal del proyecto](https://www.siteground.com/kb/change-domain-node-js-project)

## TS2688: falta la definición de tipos `node`

El build necesita `@types/node`, TypeScript, tipos de React y Tailwind/PostCSS. `NODE_ENV=production` puede hacer que npm omita las dependencias de desarrollo durante la instalación. El `.npmrc` raíz establece `include=dev` para incluirlas también en el entorno de build de SiteGround. Conserva `NODE_ENV=production` para ejecutar la aplicación; no cambies el código a JavaScript ni elimines los tipos para ocultar el error. Redespliega con una nueva instalación de dependencias. Si el panel permite configurar instalación, utiliza `npm ci --include=dev`.

## Diagnosticar 502 después de un build correcto

`npm start` ejecuta `node scripts/start.mjs`. Ese entrypoint escribe eventos JSON de arranque a consola y al archivo privado `.runtime/startup.jsonl`, relativo a la raíz del repositorio (`app_source`), con permisos 600. El directorio se crea automáticamente; en Docker está preparado para el usuario `node`. El archivo rota al superar 1 MiB y conserva una copia `.1`. No se sirve por HTTP y se excluye de Git y del contexto Docker.

En File Manager busca `public_html/.nodeapp/latest/app_source/.runtime/startup.jsonl`. Si no hay `latest`, usa el directorio del despliegue activo, identificado en los logs; no una versión vieja. Si el administrador oculta carpetas con punto, activa su visualización.

Si la ruta de la aplicación es de solo lectura, configura `SPOTCHECK_LOG_FILE` en el panel con una ruta absoluta, privada y escribible fuera del directorio público. Si no puede escribir, la consola emite `logging.file-unavailable` y conserva el diagnóstico por stdout/stderr. No descargues ni publiques `.env-local`, `.env` o credenciales para diagnosticar.

El primer evento es `startup.begin`; después cada etapa emite `stage.begin`, `stage.ready` y, si tarda, `stage.waiting`. Las etapas son `modules`, `configuration`, `postgres.migrations`, `backend`, `next.prepare`, `backend.ready`, `proxy` y `http.listen`. `startup.ready` confirma que abrió `0.0.0.0` en el puerto registrado. `startup.failed` indica la etapa, código seguro y orientación; errores de configuración muestran solo nombres de campos, nunca valores. No se guardan mensajes de error originales, stacks, cadenas de conexión ni salida cruda de Prisma en este log. Las migraciones tienen un límite de 120 segundos y registran códigos Prisma como P1000 (credenciales), P1001 (host/puerto) o P1010 (permisos).

Interpretación:

- `startup.failed`: comparte esas líneas y la última etapa; corrige la causa indicada antes de reconstruir por ensayo/error.
- `stage.waiting`: el arranque sigue esperando en esa etapa. El supervisor puede tener un tiempo de inicio menor; una señal de terminación registra `startup.interrupted` si alcanza al proceso.
- `startup.ready` pero el navegador recibe 502: revisar el puerto/encaminamiento del proveedor y si el proceso fue reiniciado o terminado después. El build correcto por sí solo no confirma el arranque.
- `request.host-mismatch`: el proceso está recibiendo otro Host. Comparar `expectedHost` y `observedHost`; no desactivar el filtro sin identificar el dominio real recibido.
- No hay archivo ni `startup.begin` en consola: confirmar si el proveedor ejecuta `npm start` desde este repositorio. La ausencia del archivo también puede deberse a permisos; buscar `logging.file-unavailable` en el log de ejecución. No concluir que la BD falla sin una etapa registrada.

Si puedes usar SSH, desde `app_source` ejecuta `npm start` temporalmente para observar el arranque con las variables reales disponibles. No lances otra instancia sobre un puerto ya ocupado ni pegues secretos en el comando. Reinicia siempre desde el supervisor del alojamiento al terminar el diagnóstico.

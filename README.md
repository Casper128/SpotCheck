# SpotCheck — Frontend

Interfaz Next.js de revisión colaborativa. El backend se mantiene en [backend-spotcheck](https://github.com/Casper128/backend-spotcheck), fuera de este repositorio.

## Estructura

- `frontend/`: aplicación Next.js, dominio, aplicación, infraestructura y presentación.
- `frontend/shared/`: contratos y validaciones compartidas con la API. Mantenerlos sincronizados con la copia del backend independiente.
- Proxy independiente: [proxy-spotcheck](https://github.com/Casper128/proxy-spotcheck), con otro origen y proceso.
- `scripts/`: preparación, desarrollo y verificaciones.
- `docs/`: guía de despliegue y documentación histórica de la migración.

## Ejecutar

Requiere Node 22.

```bash
npm ci
npm run setup
# Configurar frontend/.env con las URLs reales de API y proxy
npm run dev
```

Producción:

```bash
npm run build
npm start
```

El comando `npm start` inicia únicamente Next.js. La API debe desplegarse desde su propio repositorio. El proxy se instala y despliega desde su propio repositorio.

## Variables de frontend

```dotenv
NEXT_PUBLIC_API_URL=https://DOMINIO_REAL_DE_LA_API
NEXT_PUBLIC_PROXY_ORIGIN=https://DOMINIO_REAL_DEL_PROXY
```

Se incorporan al compilar: reconstruye al cambiarlas. No agregues credenciales de base de datos ni secretos de sesión en el proyecto frontend.

## Docker

`npm run docker:up` despliega solo el frontend. Configura `SPOTCHECK_API_ORIGIN` con la URL pública de la API externa antes de compilar. Este Compose ya no administra la API ni su base de datos. No elimines el volumen histórico `usewpastel_pastel-data`: puede contener datos de la instalación anterior. La separación del código no migra esos datos al nuevo alojamiento.

## Verificaciones disponibles

`npm run typecheck`, `npm run lint`, `npm test`, `npm run check:architecture`.

[Guía SiteGround](docs/DEPLOY_SITEGROUND.md). Los informes de migración anteriores describen el monorepo histórico; no son instrucciones del despliegue actual.

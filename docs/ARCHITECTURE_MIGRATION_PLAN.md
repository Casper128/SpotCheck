# Estado actual: repositorio reunificado y PostgreSQL

- [x] Frontend, backend, proxy y shared canónico en el repositorio SpotCheck.
- [x] Swagger preservado en `/swagger/`.
- [x] Proveedor, migración inicial y consulta workspace adaptados a PostgreSQL.
- [x] Un comando `npm start`, un proceso y puerto; API/Next en el host principal y proxy en otro host del mismo proceso.
- [x] Build completo y TypeScript del backend correctos.
- [ ] Configurar credenciales PostgreSQL y almacenamiento de adjuntos en SiteGround.
- [ ] Confirmar dos hosts por proyecto Node y preservación de Host.
- [ ] Validación funcional del alojamiento e importación opcional de datos SQLite anteriores.

La guía vigente es [DEPLOY_SITEGROUND.md](DEPLOY_SITEGROUND.md). El documento siguiente conserva el diseño y seguimiento histórico; no cambia los requisitos actuales.

---

# Refactorización de SpotCheck — Mr. Mamba

## Estado y auditoría única (2026-11-16)

El monorepo ya funciona con Fastify 5/Prisma 6/SQLite en `backend`, Next.js 16/React en `frontend`, contratos Zod en `shared` y un proxy auxiliar aislado. Se conservan las cuatro capas simétricas y el volumen `usewpastel_pastel-data`.

Hechos: hoy no existen usuarios autenticados, organizaciones ni un sistema de aprobación. Las escrituras confían en una identidad invitada del cliente; las imágenes se sirven públicamente. La navegación ofrece URL libre y vuelve a consultar la API al cambiar de ruta. El repositorio contiene una integración ficticia que debe retirarse por completo; **Kiro solo nombra los agentes de desarrollo**.

## Decisiones vinculantes

- Mantener stack, URLs de revisión y entidades/pines/comentarios existentes. No renombrar físicamente Canvas a Project: `siteUrl` representa el `sourceUrl` inmutable del proyecto web; imágenes conservan su ruta de origen.
- `backend/src` y `frontend/src`: únicamente domain/application/infrastructure/presentation. Puertos internos, adaptadores externos, composición en presentation; DTO y esquemas únicos en shared. Strict TypeScript, sin `any` ni `@ts-ignore`.
- Eliminar la integración ficticia completa: clases, puerto, caso de uso, endpoint, config, claves de `.env` reales/ejemplos/Compose, contratos, pruebas y documentación. Sus nombres no deben sobrevivir en el árbol activo ni en artefactos regenerados; no editar respaldos externos.
- Google Identity Services devuelve una credencial ID Token al frontend; el backend la verifica con `google-auth-library` (`aud`, `iss`, firma, `exp`, `sub`, `email_verified`). No aceptar identidad, estado aprobado ni organización enviados por el cliente.
- Sesión JWT firmada en cookie HttpOnly, expiración y logout; Secure en producción, SameSite=Lax para UI/API del mismo sitio. CORS con origen UI exacto y credentials=true; protección CSRF/origen en login y mutaciones. No guardar tokens en localStorage ni registrar credenciales.
- Organización y aprobación son datos server-side. Cada lectura/escritura/listado/imagen comprueba pertenencia vigente y `approved`; autores y resolvedBy se derivan de la sesión. Compartir enlace no concede acceso entre organizaciones. Las imágenes verifican Canvas.imagePath junto con membresía y usan cache privado; nunca `public`/immutable sin autorización.
- El usuario confirmó que los sitios citados son referencias visuales. Implementar la ruta interna `/account-status` para cuentas pendientes/rechazadas; no enlazar ni integrar un admin externo. Usuarios nuevos quedan pendientes. La aprobación es local y server-managed: un CLI privado permite provisionar organizaciones, membresías y asignar proyectos; ningún endpoint público permite aprobarse.
- Migración aditiva: Organization, User (googleSub único), OrganizationMembership (estado) y Canvas.organizationId nullable/indexado. Proyectos antiguos sin organización conservan sus datos y quedan inaccesibles hasta asignación administrativa explícita; nunca asignarlos al primer usuario ni inferir organización por dominio de correo.
- Workspace: una consulta SQL SQLite parametrizada con LEFT JOIN de Canvas/Pin/Comment y autorización por organización. Agrupar filas en memoria; no usar consultas por pin/comentario. En workspace, validar criptográficamente el JWT sin lookup previo; la consulta única incluye User/OrganizationMembership vigente y organización mediante CTE/join junto con Canvas/Pin/Comment. Un CTE de actor con LEFT JOIN permite distinguir pendiente (403) de proyecto ajeno/inexistente (404) sin una segunda consulta. Los demás endpoints pueden utilizar un prehandler de membresía normal. El contador de pruebas abarca todo el endpoint, incluida autorización, y debe dar exactamente una consulta SQL para una sesión válida.

## Workspace y navegación

`GET /api/projects/:id/workspace` acepta ID o shareId y devuelve un contrato único: datos del proyecto con `siteUrl`, rutas distintas que tienen pines, todos los pines con comentarios y estado necesarios para derivar la ruta activa en memoria. Mantener abiertos/resueltos, orden global `pinNumber` y metadatos actuales; no duplicar proyectos ni renumerar pines. El workspace omite de la UI rutas/pines históricos cuyo snapshot pertenece a otro origen o es inválido, conservando sus filas originales sin borrarlas.

La UI muestra el shell/skeleton inmediatamente. Un cache en memoria por usuario/organización/proyecto deduplica solicitudes en vuelo y permite cambiar entre rutas sin refetch; se vacía al logout/cambio de usuario/organización. Las respuestas de escritura actualizan el cache o provocan una única invalidación controlada; ninguna respuesta tardía reemplaza el proyecto/ruta actual.

Eliminar input de URL/ruta, botón «Ir» y flujo de explorador. La lista contiene solo rutas con pines. Un proyecto vacío muestra su sitio base para colocar el primer pin, sin inventar una ruta en la lista. El modo off/interacción sigue disponible para utilizar el sitio y el inspector, sin un paso «ir a navegar».

El origen base queda fijo. Elegir rutas compone URL desde siteUrl, nunca desde una URL arbitraria; bloquear navegación/enlaces externos y rechazar callbacks/snapshots de otro origen en frontend y backend. En proxy, distinguir navegación de documento de recursos: validar el origen de destino y redirecciones de documento sin bloquear imágenes/CSS/JS de CDN. Conservar controles DNS/IP y aislamiento existentes. Los pines históricos con snapshots de otro origen se conservan, pero no autorizan abandonar el sitio ni nuevas escrituras fuera del origen.

## Design System obligatorio antes de editar frontend

El developer adopta estos tokens primero en `frontend/src/presentation/styles/globals.css` y los aplica a login, aprobación, dashboard, skeleton, canvas, paneles y formularios:

| Token | Valor |
| --- | --- |
| Fondo | `#09090B` / `#0A0A0A` |
| Superficie | `#121215` / `#161618` |
| Borde | `1px solid #27272A` |
| Texto principal / secundario | `#FAFAFA` / `#A1A1AA` |
| Acción principal | `#FFFFFF` con texto oscuro |
| Pin activo / aprobación / alertas | `#F59E0B` / `#D97706` |

Sans moderna Geist/Inter o fallback sans sin depender de descarga durante build; contenedores rounded-xl, controles rounded-lg; transiciones de color, sombra y transform 200ms ease-out, `prefers-reduced-motion`; glassmorphism con backdrop blur en barras flotantes. Foco visible, contraste y estados loading/error/disabled consistentes. No introducir dependencias visuales innecesarias.

## Ubicación de cambios

```text
backend/prisma/{schema.prisma,migrations/}
backend/src/domain/{entities/,ports/}                   # identidad/aprobación/organización y puertos
backend/src/application/use-cases/                      # login, permisos y workspace
backend/src/infrastructure/{auth/,repositories/,config/}# Google, sesiones, SQLite
backend/src/presentation/{routes/,middleware/}          # auth, workspace y protección APIs/assets
backend/scripts/                                       # provisionamiento privado, sin credenciales embebidas
frontend/src/domain/ports/                              # sesión y workspace
frontend/src/application/                               # orquestación/cache
frontend/src/infrastructure/{http/,config/}              # credentials include y configuración pública
frontend/src/presentation/{pages/,components/,hooks/,styles/}
shared/src/{schemas.ts,dtos.ts}                          # identidad/workspace/errores
proxy/{server.mjs,rewrite.mjs}                          # ámbito de navegación al sitio base
```

## Separación proporcional: evitar código espagueti

No añadir módulos Gauntlet ni refactorizar archivos ajenos. Extraer responsabilidades al introducirlas, sin crear interfaces para cada helper ni imponer límites arbitrarios de líneas.

- **R2 / backend:** `presentation/createApp.ts` sigue siendo composición y ciclo de vida: crear dependencias, instalar plugins/middleware y registrar rutas. Ampliar `presentation/dependencies.ts` para ensamblar auth/repositorios; ubicar CORS/CSRF y sesión en middleware, handlers HTTP en `routes/auth.ts` y sistema en `routes/system.ts`. Verificar Google/firmar cookies en adaptadores `infrastructure/auth`; aprobación/permisos en casos de uso application y persistencia en repositorios. No insertar SQL, decisiones de aprobación o un controlador OAuth gigante en createApp.
- **R2 / frontend:** sesión mediante servicio/puerto y un hook/proveedor de sesión; login y `/account-status` como componentes/páginas separados. `ReviewWorkspace` recibe identidad confiable y compone la vista; no implementa OAuth, lee tokens ni conserva un segundo estado de sesión. Retirar la identidad invitada del flujo autenticado sin mantener dos mecanismos activos.
- **R3 / backend:** `routes/workspace.ts` valida/serializa y llama `GetProjectWorkspace`; el caso de uso depende de un puerto de consulta. SQL parametrizado y agrupación de filas viven en `infrastructure/repositories`, no en el controlador. El middleware de identidad solo valida JWT para este endpoint; la autorización vigente está en la consulta única. El resto de rutas utiliza la comprobación de membresía normal sin un bypass global.
- **R3 / frontend:** el cache/deduplicación y actualización tras writes pertenecen a `application/WorkspaceService` sobre puertos HTTP. `useCanvasNavigation` se simplifica o sustituye por un hook de selección de ruta; guarda la ruta activa y deriva pines/URL desde el workspace, sin copiar el proyecto filtrado en varios stores. `usePinManager` conserva coordenadas/feedback UI y `useCommentThread` el formulario; ambos delegan escrituras/cache al servicio, eliminando cadenas de `reloadCanvas` y refetch por navegación. Zustand conserva solo preferencias/selección/modo, no otra copia de datos del servidor.
- **R4 / UI:** `ReviewWorkspace` compone Header/Toolbar/Canvas/Sidebar y feedback; no crece con render condicional de OAuth/aprobación/cache. Tokens de marca con una fuente CSS y componentes reutilizados; corregir reglas existentes en vez de añadir bloques de overrides contradictorios.

**QA de responsabilidad (R2–R4):** revisar estos seams solo en archivos cambiados; verificar capas/imports y que no haya Google/SQL en handlers/componente, ni HTTP/localStorage en application. Tests de casos de uso con puertos inyectados, permisos en endpoints, consulta única con auth, cache/races/invalidation y regresión de pin/comentario/ruta deben cubrir la separación sin tests que solo reproduzcan la estructura. Mantener las suites y comportamiento anteriores del módulo; no duplicar validaciones de seguridad en React como sustituto del backend.

## Plan Gauntlet

Máximo tres iteraciones por módulo. QA corta en el primer fallo: `tsc` de backend/frontend/shared → script arquitectura/ausencia de residuos → tests solo del módulo. Solo QA marca aprobado y escribe una línea `módulo | fecha | pass/fail | iteraciones` en `docs/QA_MIGRATION_REPORT.md`. Suite completa, builds y browser global una vez al final.

- [x] **R1 — Limpieza y base visual.** Retirar integración ficticia de fuentes/config/env/tests/docs/Compose, regenerar dist cuando corresponda y simplificar publicConfig. Adoptar tokens del Design System antes de cualquier otro cambio frontend. Tests: contrato config y script de ausencia de residuos; los respaldos externos no se inspeccionan ni modifican.
- [x] **R2 — Google, sesión y organización.** Migración aditiva; Google verifier inyectable, sesión HttpOnly, login/me/logout y aprobación server-side, CLI de provisionamiento/asignación explícita, autor confiable y protección de todos los endpoints e imágenes. Login «Continue with Google» y página interna `/account-status` con el Design System. Tests: token inválido/expirado/audience incorrecta (dobles de verificador), cookies/logout/CSRF/CORS, pending/rejected, dos usuarios aprobados de la misma organización comparten proyectos/pines/comentarios/respuestas, otra organización recibe 404/403 y no ve imágenes, revocación y body spoofed no permiten acceso/aprobación/impersonación; proyectos legacy sin asignar denegados sin pérdida de datos.
- [x] **R3 — Workspace, sitio fijo y cache.** Endpoint unificado, JOIN parametrizado único verificado con contador de consultas, DTO Zod; quitar explorador/URL libre/Ir, listar rutas con pines, skeleton inmediato, cache deduplicado y actualización tras writes. Tests: una consulta con varios pines/comentarios, agrupación/vacío/estados/numeración, aislamiento org, cambio de ruta sin llamadas adicionales, invalidación/logout/race, rechazo de origen ajeno y navegación/redirecciones de documento externas conservando CDN.
- [x] **R4 — Acabado de marca y cierre.** Aplicar tokens a toda la UI, estados y microinteracciones; actualizar README/env/Compose y smoke con autenticación (sin atajos productivos). Gate global: tsc/arquitectura/ausencia de residuos/lint/tests/builds; Docker saludable; browser desktop/móvil login configurado o estado no configurado, aprobación, shell/skeleton, rutas/cache, pines/comentarios/respuestas/resolución, imágenes, contraste/foco/reduced-motion. Comprobar conservación del volumen y datos existentes. No declarar login real con Google validado sin su Client ID configurado; la aprobación se administra localmente mediante CLI privado.

## Configuración de Google

El usuario todavía no dispone de Google Client ID y confirmó que el admin citado era solo un ejemplo visual. No existe integración externa de aprobación que recuperar. Preparar `GOOGLE_CLIENT_ID` por configuración para cuando el usuario lo cree, y la aprobación/organización local mediante CLI privado. Sin Client ID, login comunica indisponibilidad y el backend falla cerrado; tests con dependencias inyectadas validan comportamiento, no un inicio de sesión real con Google.

Referencias: [verificación oficial de ID Token de Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [referencia de marca pública](https://mrmamba.com/projects/). Para Next prevalecen las guías instaladas en `node_modules/next/dist/docs/`; no se cambia su versión.

## Cierre por indicación del usuario

R4 está implementado y desplegado. El desarrollador reportó TypeScript, arquitectura, controles del módulo y despliegue correctos. La revisión independiente de R4 y el Gauntlet global final no se completaron; el usuario pidió no ejecutar más pruebas para ahorrar tokens. El checkbox de R4 representa la implementación terminada, no una aprobación global de QA. Google requiere configurar un Client ID propio.

## Decisión posterior: acceso directo con Google

Por solicitud del usuario, la verificación de Google basta para entrar: se retira la aprobación manual y los bloqueos por estados anteriores. Las cuentas nuevas obtienen un espacio personal; las existentes conservan su equipo y las que no tenían organización se provisionan con una migración aditiva. Se mantienen sesión HttpOnly y aislamiento de datos por organización. Los proyectos históricos sin organización no se adjudican automáticamente. Esta decisión sustituye las reglas de aprobación de la refactorización anterior. No se ejecutan pruebas adicionales por indicación del usuario.

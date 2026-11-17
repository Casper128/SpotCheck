import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import {
  googleLoginSchema, addPinRequestSchema, addCommentRequestSchema, resolvePinRequestSchema,
  publicConfigSchema, authChallengeSchema, sessionResponseSchema, canvasListResponseSchema,
  canvasResponseSchema, createdCanvasResponseSchema, pinResponseSchema, commentResponseSchema,
  apiErrorSchema,
} from "@spotcheck/shared";

// Documentation-only schemas: existing Zod validation and response serialization stay unchanged.
const routes = {
  "GET /health": { tags: ["Sistema"], summary: "Comprobar servidor y conexión a la base de datos" },
  "GET /api/config": { tags: ["Sistema"], summary: "Consultar configuración pública", response: { 200: publicConfigSchema.toJSONSchema() } },
  "GET /api/auth/challenge": { tags: ["Autenticación"], summary: "Crear nonce para el acceso con Google", response: { 200: authChallengeSchema.toJSONSchema() } },
  "POST /api/auth/google": { tags: ["Autenticación"], summary: "Verificar ID token de Google y emitir cookie de sesión", description: "Obtén primero el challenge e incluye su nonce en el ID token de Google. La cookie de challenge se envía automáticamente desde el mismo navegador.", body: googleLoginSchema.toJSONSchema(), response: { 200: sessionResponseSchema.toJSONSchema() } },
  "GET /api/auth/me": { tags: ["Autenticación"], summary: "Consultar la cuenta de la sesión", response: { 200: sessionResponseSchema.toJSONSchema() } },
  "POST /api/auth/logout": { tags: ["Autenticación"], summary: "Cerrar la sesión" },
  "GET /api/canvases": { tags: ["Proyectos"], summary: "Listar proyectos de la organización", response: { 200: canvasListResponseSchema.toJSONSchema() } },
  "GET /api/canvases/:shareId": { tags: ["Proyectos"], summary: "Consultar proyecto y pines", querystring: { type: "object", properties: { pageRoute: { type: "string", description: "Filtrar por ruta del sitio" } } }, response: { 200: canvasResponseSchema.toJSONSchema() } },
  "POST /api/canvases": { tags: ["Proyectos"], summary: "Crear proyecto desde URL o imagen", consumes: ["multipart/form-data"], body: { type: "object", required: ["sourceType", "title", "viewportWidth", "viewportHeight", "deviceScaleFactor", "userAgent"], properties: { sourceType: { type: "string", enum: ["web", "image"] }, title: { type: "string" }, url: { type: "string" }, viewportWidth: { type: "number" }, viewportHeight: { type: "number" }, deviceScaleFactor: { type: "number" }, userAgent: { type: "string" }, image: { type: "string", format: "binary" } } }, response: { 201: createdCanvasResponseSchema.toJSONSchema() } },
  "GET /api/projects/:id/workspace": { tags: ["Proyectos"], summary: "Obtener proyecto, rutas, pines y comentarios en una consulta" },
  "POST /api/canvases/:shareId/pins": { tags: ["Pines y comentarios"], summary: "Crear un pin", body: addPinRequestSchema.toJSONSchema(), response: { 201: pinResponseSchema.toJSONSchema() } },
  "PATCH /api/canvases/:shareId/pins/:pinId": { tags: ["Pines y comentarios"], summary: "Resolver un pin", body: resolvePinRequestSchema.toJSONSchema(), response: { 200: pinResponseSchema.toJSONSchema() } },
  "POST /api/canvases/:shareId/pins/:pinId/comments": { tags: ["Pines y comentarios"], summary: "Comentar o responder en un pin", body: addCommentRequestSchema.toJSONSchema(), response: { 201: commentResponseSchema.toJSONSchema() } },
  "GET /api/uploads/:filename": { tags: ["Archivos"], summary: "Descargar una imagen autorizada para la organización" },
};

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "SpotCheck API", version: "0.1.0", description: "API de revisión colaborativa. Las operaciones privadas requieren la cookie HttpOnly obtenida al iniciar sesión con Google. Swagger no sustituye el login de Google." },
      servers: [{ url: "/", description: "Este backend" }],
      components: { securitySchemes: { sessionCookie: { type: "apiKey", in: "cookie", name: "spotcheck_session", description: "Cookie HttpOnly emitida por /api/auth/google. El navegador la envía en las peticiones /api del mismo origen; no se pega manualmente en Swagger." } } },
    },
    transform: ({ schema, url, route }) => {
      const method = Array.isArray(route.method) ? route.method[0] : route.method;
      const documentation = routes[`${method} ${url}` as keyof typeof routes];
      if (!documentation) return { schema: { ...schema, hide: true }, url };
      const authenticated = url === "/api/auth/me" || url.startsWith("/api/canvases") || url.startsWith("/api/projects") || url.startsWith("/api/uploads");
      const parameters = [...url.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)].map(match => match[1]);
      return {
        url,
        schema: {
          ...schema, ...documentation,
          ...(parameters.length ? { params: { type: "object", required: parameters, properties: Object.fromEntries(parameters.map(name => [name, { type: "string" }])) } } : {}),
          security: authenticated ? [{ sessionCookie: [] }] : [],
          response: { 400: apiErrorSchema.toJSONSchema(), 401: apiErrorSchema.toJSONSchema(), 403: apiErrorSchema.toJSONSchema(), 500: apiErrorSchema.toJSONSchema(), ...("response" in documentation ? documentation.response : { 200: { description: "Operación completada" } }) },
        },
      };
    },
  });
  await app.register(swaggerUI, {
    routePrefix: "/swagger",
    staticCSP: true,
    uiConfig: { docExpansion: "list", deepLinking: true, persistAuthorization: false },
  });
}

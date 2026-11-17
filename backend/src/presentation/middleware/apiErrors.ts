import { AccessError } from "../../domain/ports/IdentityRepository";
import type { FastifyInstance } from "fastify";
import { DomainError } from "../../domain/errors";
import { ApplicationError, ConcurrentCanvasUpdateError } from "../../application/errors";
import { ImageStorageError } from "../../infrastructure/storage/LocalImageStorage";

export class RequestValidationError extends Error {}
export function installApiErrors(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AccessError) return reply.code(error.statusCode).send({ error: error.message });
    if (error instanceof RequestValidationError || error instanceof ImageStorageError) return reply.code(400).send({ error: error.message });
    if (error instanceof DomainError) return reply.code(400).send({ error: error.message, field: error.field });
    if (error instanceof ConcurrentCanvasUpdateError) return reply.code(409).send({ error: "El proyecto cambió mientras guardábamos. Inténtalo otra vez." });
    if (error instanceof ApplicationError) return reply.code(error.code === "CANVAS_NOT_FOUND" || error.code === "PIN_NOT_FOUND" ? 404 : 409).send({ error: error.message });
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (typeof code === "string" && (code.startsWith("FST_REQ_FILE") || code.startsWith("FST_FILES") || code.startsWith("FST_FIELDS") || code.startsWith("FST_PARTS"))) return reply.code(400).send({ error: "La imagen o el formulario exceden los límites permitidos." });
    if (typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) return reply.code(error.statusCode).send({ error: "El contenido de la solicitud no es válido." });
    request.log.error(error);
    return reply.code(500).send({ error: "Ocurrió un error inesperado. Inténtalo de nuevo." });
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "No se encontró este recurso." }));
}

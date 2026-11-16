import { DomainError } from "@/domain/errors";
import { ApplicationError, ConcurrentCanvasUpdateError } from "@/application/errors";
import { ImageStorageError } from "@/infrastructure/storage/LocalImageStorage";

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function apiError(error: unknown): Response {
  if (error instanceof RequestValidationError || error instanceof ImageStorageError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof DomainError) {
    return Response.json({ error: error.message, field: error.field }, { status: 400 });
  }
  if (error instanceof ConcurrentCanvasUpdateError) {
    return Response.json({ error: "El proyecto cambió mientras guardábamos. Inténtalo otra vez." }, { status: 409 });
  }
  if (error instanceof ApplicationError) {
    return Response.json({ error: error.message }, { status: error.code === "CANVAS_NOT_FOUND" ? 404 : 409 });
  }

  console.error("API request failed:", error);
  return Response.json({ error: "Ocurrió un error inesperado. Inténtalo de nuevo." }, { status: 500 });
}

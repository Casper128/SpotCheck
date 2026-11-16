export type ApplicationErrorCode =
  | "CANVAS_NOT_FOUND"
  | "CANVAS_ALREADY_EXISTS"
  | "CONCURRENT_CANVAS_UPDATE";

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: ApplicationErrorCode,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class CanvasNotFoundError extends ApplicationError {
  constructor(identifier: string) {
    super(`Canvas "${identifier}" was not found.`, "CANVAS_NOT_FOUND");
    this.name = "CanvasNotFoundError";
  }
}

export class CanvasAlreadyExistsError extends ApplicationError {
  constructor(identifier: string) {
    super(`Canvas "${identifier}" already exists.`, "CANVAS_ALREADY_EXISTS");
    this.name = "CanvasAlreadyExistsError";
  }
}

export class ConcurrentCanvasUpdateError extends ApplicationError {
  constructor(canvasId: string) {
    super(`Canvas "${canvasId}" changed before the update could be saved.`, "CONCURRENT_CANVAS_UPDATE");
    this.name = "ConcurrentCanvasUpdateError";
  }
}

export type ApplicationErrorCode =
  | "CANVAS_NOT_FOUND"
  | "CANVAS_ALREADY_EXISTS"
  | "CONCURRENT_CANVAS_UPDATE"
  | "PIN_NOT_FOUND";

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

export class PinNotFoundError extends ApplicationError {
  constructor(pinId: string) {
    super(`Pin "${pinId}" was not found on the requested page.`, "PIN_NOT_FOUND");
    this.name = "PinNotFoundError";
  }
}

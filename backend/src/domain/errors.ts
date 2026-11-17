export type DomainErrorCode =
  | "INVALID_VALUE"
  | "ALREADY_RESOLVED"
  | "DUPLICATE_ID"
  | "NOT_FOUND"
  | "INVALID_STATE";

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: DomainErrorCode,
    readonly field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function assertNonBlank(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new DomainError(`${field} must not be blank.`, "INVALID_VALUE", field);
  }
  return normalized;
}

export function assertTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new DomainError(`${field} must be a valid timestamp.`, "INVALID_VALUE", field);
  }
}

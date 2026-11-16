import { assertNonBlank, assertTimestamp, DomainError } from "../errors";
import type { Comment } from "./Comment";
import type { GuestReviewer } from "./GuestReviewer";

export type PinStatus = "open" | "resolved";

export interface Pin {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly status: PinStatus;
  readonly createdBy: GuestReviewer;
  readonly createdAt: string;
  readonly resolvedBy?: GuestReviewer;
  readonly resolvedAt?: string;
  readonly comments: readonly Comment[];
}

export interface PinAttributes {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly createdBy: GuestReviewer;
  readonly createdAt: string;
}

export function createPin(attributes: PinAttributes): Pin {
  const id = assertNonBlank(attributes.id, "pin.id");
  assertCoordinate(attributes.x, "pin.x");
  assertCoordinate(attributes.y, "pin.y");
  assertTimestamp(attributes.createdAt, "pin.createdAt");

  return {
    id,
    x: attributes.x,
    y: attributes.y,
    status: "open",
    createdBy: attributes.createdBy,
    createdAt: attributes.createdAt,
    comments: [],
  };
}

export function resolvePin(pin: Pin, reviewer: GuestReviewer, resolvedAt: string): Pin {
  if (pin.status === "resolved") {
    throw new DomainError("Pin is already resolved.", "ALREADY_RESOLVED", "pin.status");
  }
  assertTimestamp(resolvedAt, "pin.resolvedAt");
  if (Date.parse(resolvedAt) < Date.parse(pin.createdAt)) {
    throw new DomainError("resolvedAt cannot precede createdAt.", "INVALID_VALUE", "pin.resolvedAt");
  }
  return { ...pin, status: "resolved", resolvedBy: reviewer, resolvedAt };
}

function assertCoordinate(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new DomainError(`${field} must be between 0 and 1 inclusive.`, "INVALID_VALUE", field);
  }
}

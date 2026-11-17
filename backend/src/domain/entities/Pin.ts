import { assertNonBlank, assertTimestamp, DomainError } from "../errors";
import type { GuestReviewer } from "./GuestReviewer";
import { createPinSnapshotMetadata, type PinSnapshotMetadata } from "./PinSnapshotMetadata";
import { normalizePageRoute } from "../normalizePageRoute";

import type { DOMAnchor, Pin } from "@spotcheck/shared";
export type { DOMAnchor, Pin, PinStatus } from "@spotcheck/shared";

export interface PinAttributes {
  readonly id: string;
  readonly pageRoute: string;
  readonly pinNumber: number;
  readonly x: number;
  readonly y: number;
  readonly domAnchor?: DOMAnchor;
  readonly createdBy: GuestReviewer;
  readonly createdAt: string;
  readonly snapshot: PinSnapshotMetadata;
}

export function createPin(attributes: PinAttributes): Pin {
  const id = assertNonBlank(attributes.id, "pin.id");
  const pageRoute = normalizePageRoute(assertNonBlank(attributes.pageRoute, "pin.pageRoute"));
  if (!Number.isSafeInteger(attributes.pinNumber) || attributes.pinNumber < 1) {
    throw new DomainError("pin.pinNumber must be a positive integer.", "INVALID_VALUE", "pin.pinNumber");
  }
  assertCoordinate(attributes.x, "pin.x");
  assertCoordinate(attributes.y, "pin.y");
  const domAnchor = attributes.domAnchor === undefined ? undefined : validateDOMAnchor(attributes.domAnchor);
  assertTimestamp(attributes.createdAt, "pin.createdAt");

  return {
    id,
    pageRoute,
    pinNumber: attributes.pinNumber,
    x: attributes.x,
    y: attributes.y,
    ...(domAnchor ? { domAnchor } : {}),
    status: "open",
    createdBy: attributes.createdBy,
    createdAt: attributes.createdAt,
    snapshot: createPinSnapshotMetadata(attributes.snapshot),
    comments: [],
  };
}

function validateDOMAnchor(anchor: DOMAnchor): DOMAnchor {
  if (typeof anchor !== "object" || anchor === null
    || typeof anchor.selector !== "string" || anchor.selector.trim().length === 0 || anchor.selector.length > 1200) {
    throw new DomainError("pin.domAnchor.selector must be non-empty and at most 1200 characters.", "INVALID_VALUE", "pin.domAnchor.selector");
  }
  assertCoordinate(anchor.offsetX, "pin.domAnchor.offsetX");
  assertCoordinate(anchor.offsetY, "pin.domAnchor.offsetY");
  return { selector: anchor.selector, offsetX: anchor.offsetX, offsetY: anchor.offsetY };
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

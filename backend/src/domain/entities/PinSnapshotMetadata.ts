import type { PinSnapshotMetadata } from "@spotcheck/shared";
export type { PinSnapshotMetadata } from "@spotcheck/shared";
import { assertNonBlank, DomainError } from "../errors";

export type PinSnapshotMetadataAttributes = PinSnapshotMetadata;

export function createPinSnapshotMetadata(
  attributes: PinSnapshotMetadataAttributes,
): PinSnapshotMetadata {
  if (!attributes || typeof attributes !== "object") {
    throw new DomainError("Snapshot metadata must be an object.", "INVALID_VALUE", "snapshot");
  }
  assertRecord(attributes.viewport, "snapshot.viewport");
  assertRecord(attributes.browser, "snapshot.browser");
  assertRecord(attributes.operatingSystem, "snapshot.operatingSystem");

  const { reviewedUrl } = attributes;
  if (
    typeof reviewedUrl !== "string" ||
    !reviewedUrl ||
    reviewedUrl !== reviewedUrl.trim() ||
    /[\u0000-\u0020]/.test(reviewedUrl)
  ) {
    throw new DomainError("reviewedUrl must be an exact absolute HTTP(S) URL.", "INVALID_VALUE", "snapshot.reviewedUrl");
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(reviewedUrl);
  } catch {
    throw new DomainError("reviewedUrl must be an exact absolute HTTP(S) URL.", "INVALID_VALUE", "snapshot.reviewedUrl");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new DomainError("reviewedUrl must use HTTP or HTTPS.", "INVALID_VALUE", "snapshot.reviewedUrl");
  }

  assertPositiveFinite(attributes.viewport.width, "snapshot.viewport.width");
  assertPositiveFinite(attributes.viewport.height, "snapshot.viewport.height");
  if (attributes.scrollOffset !== undefined) {
    assertRecord(attributes.scrollOffset, "snapshot.scrollOffset");
    assertFiniteScroll(attributes.scrollOffset.x, "snapshot.scrollOffset.x");
    assertFiniteScroll(attributes.scrollOffset.y, "snapshot.scrollOffset.y");
  }

  const browserName = validateLabel(attributes.browser.name, "snapshot.browser.name", 100);
  const operatingSystemName = validateLabel(
    attributes.operatingSystem.name,
    "snapshot.operatingSystem.name",
    100,
  );
  const browserVersion = validateOptionalLabel(attributes.browser.version, "snapshot.browser.version", 50);
  const operatingSystemVersion = validateOptionalLabel(
    attributes.operatingSystem.version,
    "snapshot.operatingSystem.version",
    50,
  );

  return {
    reviewedUrl,
    viewport: {
      width: attributes.viewport.width,
      height: attributes.viewport.height,
    },
    ...(attributes.scrollOffset === undefined
      ? {}
      : { scrollOffset: { x: attributes.scrollOffset.x, y: attributes.scrollOffset.y } }),
    browser: {
      name: browserName,
      ...(browserVersion === undefined ? {} : { version: browserVersion }),
    },
    operatingSystem: {
      name: operatingSystemName,
      ...(operatingSystemVersion === undefined ? {} : { version: operatingSystemVersion }),
    },
  };
}

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError(`${field} must be a positive finite number.`, "INVALID_VALUE", field);
  }
}

function assertFiniteScroll(value: number, field: string): void {
  if (!Number.isFinite(value) || Math.abs(value) > 100_000) {
    throw new DomainError(`${field} must be a finite scroll offset within 100000 pixels.`, "INVALID_VALUE", field);
  }
}

function validateLabel(value: string, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new DomainError(`${field} must be a string.`, "INVALID_VALUE", field);
  }
  const normalized = assertNonBlank(value, field);
  if (normalized.length > maxLength) {
    throw new DomainError(`${field} must be at most ${maxLength} characters.`, "INVALID_VALUE", field);
  }
  return normalized;
}

function validateOptionalLabel(value: string | undefined, field: string, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return validateLabel(value, field, maxLength);
}

function assertRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new DomainError(`${field} must be an object.`, "INVALID_VALUE", field);
  }
}

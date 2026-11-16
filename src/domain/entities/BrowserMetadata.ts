import { assertNonBlank, assertTimestamp, DomainError } from "../errors";

export interface BrowserMetadata {
  readonly pageUrl: string;
  readonly pageTitle: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly deviceScaleFactor?: number;
  readonly userAgent?: string;
  readonly capturedAt: string;
}

export interface BrowserMetadataAttributes {
  readonly pageUrl: string;
  readonly pageTitle: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly deviceScaleFactor?: number;
  readonly userAgent?: string;
  readonly capturedAt: string;
}

export function createBrowserMetadata(attributes: BrowserMetadataAttributes): BrowserMetadata {
  const pageUrl = assertNonBlank(attributes.pageUrl, "browserMetadata.pageUrl");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pageUrl);
  } catch {
    throw new DomainError("pageUrl must be an absolute HTTP(S) URL.", "INVALID_VALUE", "browserMetadata.pageUrl");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new DomainError("pageUrl must use HTTP or HTTPS.", "INVALID_VALUE", "browserMetadata.pageUrl");
  }

  const pageTitle = attributes.pageTitle.trim();
  if (pageTitle.length > 200) {
    throw new DomainError("pageTitle must be at most 200 characters.", "INVALID_VALUE", "browserMetadata.pageTitle");
  }
  assertPositiveFinite(attributes.viewportWidth, "browserMetadata.viewportWidth");
  assertPositiveFinite(attributes.viewportHeight, "browserMetadata.viewportHeight");
  if (attributes.deviceScaleFactor !== undefined) {
    assertPositiveFinite(attributes.deviceScaleFactor, "browserMetadata.deviceScaleFactor");
  }
  if (attributes.userAgent !== undefined && attributes.userAgent.length > 1000) {
    throw new DomainError("userAgent must be at most 1000 characters.", "INVALID_VALUE", "browserMetadata.userAgent");
  }
  assertTimestamp(attributes.capturedAt, "browserMetadata.capturedAt");

  return {
    pageUrl: parsedUrl.toString(),
    pageTitle,
    viewportWidth: attributes.viewportWidth,
    viewportHeight: attributes.viewportHeight,
    ...(attributes.deviceScaleFactor === undefined ? {} : { deviceScaleFactor: attributes.deviceScaleFactor }),
    ...(attributes.userAgent === undefined ? {} : { userAgent: attributes.userAgent }),
    capturedAt: attributes.capturedAt,
  };
}

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError(`${field} must be a positive finite number.`, "INVALID_VALUE", field);
  }
}

import { assertNonBlank, DomainError } from "../errors";

import type { ImageSource } from "@spotcheck/shared";
export type { ImageSource } from "@spotcheck/shared";
export type ExternalUrlImageSource = Extract<ImageSource, { kind: "external-url" }>;
export type UploadedPathImageSource = Extract<ImageSource, { kind: "uploaded-path" }>;

export function createImageSource(source: ImageSource): ImageSource {
  if (!source || typeof source !== "object") {
    throw new DomainError("Image source must be an object.", "INVALID_VALUE", "imageSource");
  }

  if (source.kind === "external-url") {
    if (typeof source.url !== "string") {
      throw new DomainError("Image URL must be a string.", "INVALID_VALUE", "imageSource.url");
    }
    const url = assertNonBlank(source.url, "imageSource.url");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new DomainError("Image URL must be an absolute HTTP(S) URL.", "INVALID_VALUE", "imageSource.url");
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new DomainError("Image URL must use HTTP or HTTPS.", "INVALID_VALUE", "imageSource.url");
    }
    return { kind: "external-url", url };
  }

  if (source.kind === "uploaded-path") {
    if (typeof source.path !== "string") {
      throw new DomainError("Uploaded image path must be a string.", "INVALID_VALUE", "imageSource.path");
    }
    const path = assertNonBlank(source.path, "imageSource.path");
    const segments = path.split("/");
    if (
      path.length > 2048 ||
      /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path) ||
      path.includes("\\") ||
      /[\u0000-\u001f]/.test(path) ||
      segments.some((segment) => segment === "." || segment === "..")
    ) {
      throw new DomainError("Uploaded image path must be a safe storage path.", "INVALID_VALUE", "imageSource.path");
    }
    return { kind: "uploaded-path", path };
  }

  throw new DomainError("Unsupported image source.", "INVALID_VALUE", "imageSource");
}

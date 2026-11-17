import type { Canvas } from "@spotcheck/shared";
export function belongsToProjectSite(canvas: Pick<Canvas, "imageSource" | "browserMetadata">, reviewedUrl: string): boolean {
  try {
    const target = new URL(reviewedUrl);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) return false;
    return canvas.imageSource.kind === "uploaded-path" ? target.pathname === canvas.imageSource.path : target.origin === new URL(canvas.imageSource.url).origin;
  } catch { return false; }
}

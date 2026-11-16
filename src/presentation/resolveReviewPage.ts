import { normalizePageRoute } from "@/domain/normalizePageRoute";

export function resolveReviewPage(value: string, baseUrl: string) {
  if (!value.trim()) throw new Error("Introduce una URL o ruta de página.");
  const target = new URL(value.trim(), baseUrl);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("La URL de página debe usar HTTP o HTTPS.");
  }
  return { url: target.href, pageRoute: normalizePageRoute(target.href) };
}

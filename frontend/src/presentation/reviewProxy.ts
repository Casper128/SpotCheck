export function proxyFrameUrl(target: string, proxyOrigin: string | null, siteUrl?: string): string {
  if (siteUrl && new URL(target).origin !== new URL(siteUrl).origin) throw new Error("La página no pertenece al sitio de este proyecto.");
  if (!proxyOrigin) return target;
  const original = new URL(target);
  const url = new URL("/", proxyOrigin);
  url.hash = original.hash;
  original.hash = "";
  url.searchParams.set("url", original.href);
  if (siteUrl) { url.searchParams.set("siteOrigin", new URL(siteUrl).origin); url.searchParams.set("document", "1"); }
  return url.href;
}

/** Called only after the inspector envelope, source window and origin are verified. */
export function reviewedProxyUrl(href: string, proxyOrigin: string | null): string {
  if (!proxyOrigin) return href;
  const frame = new URL(href);
  if (frame.origin !== new URL(proxyOrigin).origin || frame.pathname !== "/") {
    throw new Error("El proxy comunicó una ruta no válida.");
  }
  const target = new URL(frame.searchParams.get("url") ?? "");
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error("El proxy comunicó una URL no válida.");
  }
  if (frame.hash) target.hash = frame.hash;
  return target.href;
}

/** Route validation belongs to navigation, which also recovers the project frame. */
export function inspectorRouteHref(href: string, proxyOrigin: string | null): string {
  try { return reviewedProxyUrl(href, proxyOrigin); } catch { return href; }
}

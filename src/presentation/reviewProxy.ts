export function proxyFrameUrl(target: string, proxyOrigin: string | null): string {
  if (!proxyOrigin) return target;
  const original = new URL(target);
  const url = new URL("/", proxyOrigin);
  url.hash = original.hash;
  original.hash = "";
  url.searchParams.set("url", original.href);
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

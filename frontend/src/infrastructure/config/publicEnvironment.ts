function configuredOrigin(value: string, name: string): string {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value) throw new Error(`${name} debe ser un origen HTTP(S) exacto.`);
  return parsed.origin;
}
export function publicEnvironment() {
  const apiOrigin = configuredOrigin(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", "NEXT_PUBLIC_API_URL");
  const configuredProxy = process.env.NEXT_PUBLIC_PROXY_ORIGIN;
  const proxy = configuredProxy ? new URL(configuredProxy) : null;
  if (proxy && (!['http:', 'https:'].includes(proxy.protocol) || proxy.username || proxy.password || proxy.search || proxy.hash || !['/', '/proxy', '/proxy/'].includes(proxy.pathname))) throw new Error("NEXT_PUBLIC_PROXY_ORIGIN debe apuntar al proxy HTTP(S), opcionalmente en /proxy.");
  return { apiOrigin, proxyOrigin: proxy ? proxy.href.replace(/\/$/, "") : null };
}

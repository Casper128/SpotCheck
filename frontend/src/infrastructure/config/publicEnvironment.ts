function configuredOrigin(value: string, name: string): string {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== value) throw new Error(`${name} debe ser un origen HTTP(S) exacto.`);
  return parsed.origin;
}
export function publicEnvironment() {
  const apiOrigin = configuredOrigin(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", "NEXT_PUBLIC_API_URL");
  const configuredProxy = process.env.NEXT_PUBLIC_PROXY_ORIGIN;
  return { apiOrigin, proxyOrigin: configuredProxy ? configuredOrigin(configuredProxy, "NEXT_PUBLIC_PROXY_ORIGIN") : null };
}

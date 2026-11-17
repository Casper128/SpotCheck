import path from "node:path";
import { z } from "zod";

const origin = z.url({ protocol: /^https?$/ }).refine((value) => new URL(value).origin === value, "Se requiere un origen exacto sin ruta ni barra final.");
const schema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//, "DATABASE_URL debe ser una conexión PostgreSQL."),
  UPLOAD_DIRECTORY: z.string().min(1).default("data/uploads"),
  PUBLIC_API_ORIGIN: origin.default("http://localhost:4000"),
  FRONTEND_ORIGIN: origin.default("http://localhost:3000"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  PROXY_ORIGIN: z.url({ protocol: /^https?$/ }).refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash && (url.pathname === "/" || url.pathname === "/proxy" || url.pathname === "/proxy/");
  }, "El proxy debe usar un origen HTTP(S) o su ruta /proxy.").optional(),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  SESSION_SECRET: z.preprocess(value => value === "" ? undefined : value, z.string().min(32).optional()),
  SESSION_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  NODE_ENV: z.string().optional(),
});
export function readConfig(environment: Record<string, string | undefined> = process.env) {
  const parsed = schema.parse(environment);
  const publicApi = new URL(parsed.PUBLIC_API_ORIGIN);
  const localHttp = publicApi.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(publicApi.hostname);
  return {
    databaseUrl: parsed.DATABASE_URL,
    uploadDirectory: path.resolve(parsed.UPLOAD_DIRECTORY),
    frontendOrigin: parsed.FRONTEND_ORIGIN,
    publicApiOrigin: parsed.PUBLIC_API_ORIGIN,
    port: parsed.PORT,
    proxyOrigin: parsed.PROXY_ORIGIN ?? null,
    googleClientId: parsed.GOOGLE_CLIENT_ID || null,
    sessionSecret: parsed.SESSION_SECRET ?? null,
    cookieSecure: parsed.NODE_ENV === "production" && !localHttp ? true : parsed.SESSION_COOKIE_SECURE ? parsed.SESSION_COOKIE_SECURE === "true" : parsed.NODE_ENV === "production",
  };
}
export type BackendConfig = ReturnType<typeof readConfig>;

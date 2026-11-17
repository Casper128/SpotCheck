import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { BackendConfig } from "../../infrastructure/config/environment";
export function registerSystemRoutes(app: FastifyInstance, database: PrismaClient | null, config: BackendConfig) {
  app.get("/health", async () => { if (database) await database.$queryRaw`SELECT 1`; return { status: "ok" }; });
  app.get("/api/config", async () => ({ proxyOrigin: config.proxyOrigin, googleConfigured: Boolean(config.googleClientId && config.sessionSecret), googleClientId: config.googleClientId }));
}

import { registerSwagger } from "./documentation/swagger";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import type { PrismaClient } from "@prisma/client";
import type { ReviewRepository } from "../application/ports/ReviewRepository";
import { createDatabase } from "../infrastructure/database/prisma";
import { readConfig, type BackendConfig } from "../infrastructure/config/environment";
import { LocalImageStorage } from "../infrastructure/storage/LocalImageStorage";
import { createDependencies, type AuthDependencies } from "./dependencies";
import { installApiErrors } from "./middleware/apiErrors";
import { installCors } from "./middleware/cors";
import { registerWorkspaceRoutes } from "./routes/workspace";
import { registerAuthRoutes } from "./routes/auth";
import { registerSystemRoutes } from "./routes/system";
import { registerCanvasRoutes } from "./routes/canvases";
import { registerPinRoutes } from "./routes/pins";
import { registerUploadRoutes } from "./routes/uploads";

export async function createApp(options: AuthDependencies & { config?: BackendConfig; database?: PrismaClient; repository?: ReviewRepository; logger?: boolean } = {}) {
  const config = options.config ?? readConfig();
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 12 * 1024 * 1024, requestTimeout: 20_000 });
  const ownedDatabase = !options.database && !options.repository ? createDatabase(config.databaseUrl) : null;
  const database = options.database ?? ownedDatabase;
  const dependencies = createDependencies(database, config, options);
  const images = new LocalImageStorage(config.uploadDirectory);
  installApiErrors(app);
  await installCors(app, config.frontendOrigin);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 16, parts: 17 } });
  await registerSwagger(app);
  registerSystemRoutes(app, database, config);
  registerAuthRoutes(app, dependencies.access, Boolean(config.googleClientId && config.sessionSecret));
  registerCanvasRoutes(app, dependencies.review, images, config);
  registerPinRoutes(app, dependencies.review);
  if (dependencies.getWorkspace) registerWorkspaceRoutes(app, dependencies.access, dependencies.getWorkspace);
  registerUploadRoutes(app, images, dependencies.imageAllowed);
  if (ownedDatabase) app.addHook("onClose", async () => { await ownedDatabase.$disconnect(); });
  return app;
}

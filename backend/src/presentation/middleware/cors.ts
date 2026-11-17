import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
export async function installCors(app: FastifyInstance, frontendOrigin: string) {
  app.addHook("onRequest", async (request, reply) => {
    if ((!["GET", "HEAD", "OPTIONS"].includes(request.method) || (request.method === "OPTIONS" && request.headers.origin !== undefined)) && request.headers.origin !== frontendOrigin) {
      return reply.code(403).send({ error: "Origen no permitido." });
    }
  });
  await app.register(cors, { origin: (origin, callback) => callback(null, origin === frontendOrigin ? frontendOrigin : false),
    methods: ["GET", "POST", "PATCH", "OPTIONS"], allowedHeaders: ["Content-Type"], credentials: true });
}

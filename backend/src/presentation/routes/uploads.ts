import type { ImageAccess } from "../dependencies";
import type { FastifyInstance } from "fastify";
import type { LocalImageStorage } from "../../infrastructure/storage/LocalImageStorage";

export function registerUploadRoutes(app: FastifyInstance, images: LocalImageStorage, allowed: ImageAccess) {
  app.get<{ Params: { filename: string } }>("/api/uploads/:filename", async (request, reply) => {
    if (!await allowed(request, `/api/uploads/${request.params.filename}`)) return reply.code(404).send({ error: "No se encontró la imagen." });
    if (!/^[\da-f-]{36}\.(png|jpg)$/.test(request.params.filename)) return reply.code(404).send({ error: "No se encontró la imagen." });
    try {
      const image = await images.load(`/api/uploads/${request.params.filename}`);
      return reply.type(image.contentType).header("cache-control", "private, no-store").header("x-content-type-options", "nosniff").send(Buffer.from(image.contents));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return reply.code(404).send({ error: "No se encontró la imagen." });
      throw error;
    }
  });
}

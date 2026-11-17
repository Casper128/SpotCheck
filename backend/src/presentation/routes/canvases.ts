import { File } from "node:buffer";
import type { FastifyInstance } from "fastify";
import { createCanvasFieldsSchema, httpUrlSchema, pageRouteSchema, type ImageSource } from "@spotcheck/shared";
import type { LocalImageStorage } from "../../infrastructure/storage/LocalImageStorage";
import type { BackendConfig } from "../../infrastructure/config/environment";
import type { ReviewContext } from "../dependencies";
import { RequestValidationError } from "../middleware/apiErrors";

export function registerCanvasRoutes(app: FastifyInstance, review: ReviewContext, images: LocalImageStorage, config: BackendConfig) {
  app.get("/api/canvases", async (request, reply) => { const { repository } = await review(request); return reply.header("cache-control", "no-store").send({ canvases: await repository.listSummaries() }); });
  app.get<{ Params: { shareId: string }; Querystring: { pageRoute?: string } }>("/api/canvases/:shareId", async (request, reply) => {
    reply.header("cache-control", "no-store");
    const { useCases } = await review(request);
    const { shareId } = request.params;
    const rawRoute = request.query.pageRoute;
    const route = rawRoute === undefined ? undefined : pageRouteSchema.safeParse(rawRoute);
    if (route && !route.success) throw new RequestValidationError("La ruta de página no es válida.");
    const canvas = route?.success ? await useCases.getPinsByRoute.execute({ shareId, pageRoute: route.data }) : await useCases.getCanvas.execute({ shareId });
    return { canvas };
  });
  app.post("/api/canvases", async (request, reply) => {
    const { useCases } = await review(request);
    const fields: Record<string, string> = {};
    let image: File | null = null;
    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "image") throw new RequestValidationError("El campo de imagen no es válido.");
        const bytes = await part.toBuffer();
        image = new File([Uint8Array.from(bytes)], part.filename, { type: part.mimetype });
      } else {
        if (typeof part.value !== "string") throw new RequestValidationError("El formulario no es válido.");
        fields[part.fieldname] = part.value;
      }
    }
    const parsed = createCanvasFieldsSchema.safeParse({ ...fields, url: fields.url || undefined });
    if (!parsed.success) throw new RequestValidationError("Los datos del proyecto no son válidos.");
    const input = parsed.data;
    let storedImagePath: string | null = null;
    try {
      let imageSource: ImageSource;
      let pageUrl: string;
      if (input.sourceType === "web") {
        const url = httpUrlSchema.safeParse(input.url);
        if (!url.success) throw new RequestValidationError("Escribe una URL válida que comience por http:// o https://.");
        imageSource = { kind: "external-url", url: url.data };
        pageUrl = url.data;
      } else {
        if (!image) throw new RequestValidationError("Elige una imagen PNG o JPG.");
        storedImagePath = await images.save(image);
        imageSource = { kind: "uploaded-path", path: storedImagePath };
        // Stable public origin, independent of internal Host/proxy headers.
        pageUrl = new URL(storedImagePath, config.publicApiOrigin).href;
      }
      const canvas = await useCases.createCanvas.execute({ imageSource, pageUrl, pageTitle: input.title || (input.sourceType === "web" ? new URL(pageUrl).hostname : "Imagen sin título"), viewportWidth: input.viewportWidth, viewportHeight: input.viewportHeight, deviceScaleFactor: input.deviceScaleFactor, userAgent: input.userAgent });
      return reply.code(201).send({ id: canvas.id, shareId: canvas.shareId });
    } catch (error) {
      if (storedImagePath) await images.remove(storedImagePath).catch((cleanupError: unknown) => request.log.error(cleanupError));
      throw error;
    }
  });
}

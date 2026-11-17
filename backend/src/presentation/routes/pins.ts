import type { FastifyInstance } from "fastify";
import { addCommentRequestSchema, addPinRequestSchema, resolvePinRequestSchema } from "@spotcheck/shared";
import type { ReviewContext } from "../dependencies";
import { RequestValidationError } from "../middleware/apiErrors";

type PinParams = { shareId: string; pinId: string };
export function registerPinRoutes(app: FastifyInstance, review: ReviewContext) {
  app.post<{ Params: { shareId: string } }>("/api/canvases/:shareId/pins", async (request, reply) => {
    const { account, useCases } = await review(request);
    const parsed = addPinRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new RequestValidationError("El punto o los metadatos de revisión no son válidos.");
    const { x, y, pageRoute, domAnchor, snapshot } = parsed.data;
    const point = { x, y, pageRoute, domAnchor, snapshot };
    const canvas = await useCases.getCanvas.execute({ shareId: request.params.shareId });
    const pin = await useCases.addPin.execute({ ...point, canvasId: canvas.id, author: { reviewerId: account.id, displayName: account.displayName } });
    return reply.code(201).send({ pin });
  });
  app.patch<{ Params: PinParams }>("/api/canvases/:shareId/pins/:pinId", async (request) => {
    const { account, useCases } = await review(request);
    const parsed = resolvePinRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new RequestValidationError("El nombre del revisor no es válido.");
    const canvas = await useCases.getCanvas.execute({ shareId: request.params.shareId });
    const pin = await useCases.resolvePin.execute({ canvasId: canvas.id, pinId: request.params.pinId, pageRoute: parsed.data.pageRoute, resolvedBy: { reviewerId: account.id, displayName: account.displayName } });
    return { pin };
  });
  app.post<{ Params: PinParams }>("/api/canvases/:shareId/pins/:pinId/comments", async (request, reply) => {
    const { account, useCases } = await review(request);
    const parsed = addCommentRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new RequestValidationError("Escribe un comentario de hasta 5.000 caracteres.");
    const data = parsed.data;
    const canvas = await useCases.getCanvas.execute({ shareId: request.params.shareId });
    const input = { canvasId: canvas.id, pinId: request.params.pinId, pageRoute: data.pageRoute, author: { reviewerId: account.id, displayName: account.displayName }, body: data.body };
    const comment = data.replyToCommentId ? await useCases.replyToComment.execute({ ...input, commentId: data.replyToCommentId }) : await useCases.addComment.execute(input);
    return reply.code(201).send({ comment });
  });
}

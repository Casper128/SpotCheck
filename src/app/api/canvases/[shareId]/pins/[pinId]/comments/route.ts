import { z } from "zod";
import { apiError, RequestValidationError } from "@/presentation/server/apiErrors";
import { canvasRepository, useCases } from "@/presentation/server/dependencies";

const commentSchema = z.object({
  pageRoute: z.string().trim().min(1).max(2048),
  body: z.string().trim().min(1).max(5000),
  replyToCommentId: z.string().min(1).optional(),
  author: z.object({
    id: z.string().min(1).max(100),
    displayName: z.string().trim().min(1).max(80),
  }),
});

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly shareId: string; readonly pinId: string }> },
): Promise<Response> {
  try {
    const { shareId, pinId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new RequestValidationError("El contenido de la solicitud no es válido.");
    }
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Escribe un comentario de hasta 5.000 caracteres." }, { status: 400 });
    }
    const canvas = await useCases.getCanvas.execute({ shareId });
    const input = {
      canvasId: canvas.id,
      pinId,
      pageRoute: parsed.data.pageRoute,
      author: { reviewerId: parsed.data.author.id, displayName: parsed.data.author.displayName },
      body: parsed.data.body,
    };
    const comment = parsed.data.replyToCommentId
      ? await useCases.replyToComment.execute({ ...input, commentId: parsed.data.replyToCommentId })
      : await useCases.addComment.execute(input);
    await canvasRepository.rememberReviewer(canvas.id, comment.author.id, comment.author.displayName);
    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

import { z } from "zod";
import { apiError, RequestValidationError } from "@/presentation/server/apiErrors";
import { canvasRepository, useCases } from "@/presentation/server/dependencies";

const resolveSchema = z.object({
  resolvedBy: z.object({
    id: z.string().min(1).max(100),
    displayName: z.string().trim().min(1).max(80),
  }),
});

export async function PATCH(
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
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "El nombre del revisor no es válido." }, { status: 400 });
    }
    const canvas = await useCases.getCanvas.execute({ shareId });
    const pin = await useCases.resolvePin.execute({
      canvasId: canvas.id,
      pinId,
      resolvedBy: {
        reviewerId: parsed.data.resolvedBy.id,
        displayName: parsed.data.resolvedBy.displayName,
      },
    });
    if (pin.resolvedBy) {
      await canvasRepository.rememberReviewer(canvas.id, pin.resolvedBy.id, pin.resolvedBy.displayName);
    }
    return Response.json({ pin });
  } catch (error) {
    return apiError(error);
  }
}

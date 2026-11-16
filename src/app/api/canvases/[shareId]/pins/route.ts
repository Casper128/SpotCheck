import { z } from "zod";
import { apiError, RequestValidationError } from "@/presentation/server/apiErrors";
import { canvasRepository, useCases } from "@/presentation/server/dependencies";

const reviewerSchema = z.object({
  id: z.string().min(1).max(100),
  displayName: z.string().trim().min(1).max(80),
});

const pinSchema = z.object({
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
  author: reviewerSchema,
  snapshot: z.object({
    reviewedUrl: z.string().url(),
    viewport: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
    }),
    browser: z.object({
      name: z.string().trim().min(1).max(100),
      version: z.string().trim().max(50).optional(),
    }),
    operatingSystem: z.object({
      name: z.string().trim().min(1).max(100),
      version: z.string().trim().max(50).optional(),
    }),
  }),
});

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ readonly shareId: string }> },
): Promise<Response> {
  try {
    const { shareId } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new RequestValidationError("El contenido de la solicitud no es válido.");
    }
    const parsed = pinSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "El punto o los metadatos de revisión no son válidos." }, { status: 400 });
    }

    const canvas = await useCases.getCanvas.execute({ shareId });
    const pin = await useCases.addPin.execute({
      canvasId: canvas.id,
      x: parsed.data.x,
      y: parsed.data.y,
      snapshot: parsed.data.snapshot,
      author: { reviewerId: parsed.data.author.id, displayName: parsed.data.author.displayName },
    });
    await canvasRepository.rememberReviewer(canvas.id, pin.createdBy.id, pin.createdBy.displayName);
    return Response.json({ pin }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

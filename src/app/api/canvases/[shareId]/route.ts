import { z } from "zod";
import { apiError } from "@/presentation/server/apiErrors";
import { useCases } from "@/presentation/server/dependencies";

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ readonly shareId: string }> },
): Promise<Response> {
  try {
    const { shareId } = await params;
    const rawPageRoute = new URL(request.url).searchParams.get("pageRoute");
    const parsedRoute = rawPageRoute === null ? null : z.string().trim().min(1).max(2048).safeParse(rawPageRoute);
    if (parsedRoute !== null && !parsedRoute.success) {
      return Response.json({ error: "La ruta de página no es válida." }, { status: 400 });
    }
    const canvas = parsedRoute === null
      ? await useCases.getCanvas.execute({ shareId })
      : await useCases.getPinsByRoute.execute({ shareId, pageRoute: parsedRoute.data });
    return Response.json({ canvas });
  } catch (error) {
    return apiError(error);
  }
}

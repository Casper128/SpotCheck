import { apiError } from "@/presentation/server/apiErrors";
import { useCases } from "@/presentation/server/dependencies";

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly shareId: string }> },
): Promise<Response> {
  try {
    const { shareId } = await params;
    const canvas = await useCases.getCanvas.execute({ shareId });
    return Response.json({ canvas });
  } catch (error) {
    return apiError(error);
  }
}

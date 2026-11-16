import { ApplicationError } from "@/application/errors";
import type { Canvas } from "@/domain/entities/Canvas";
import { useCases } from "@/presentation/server/dependencies";
import ReviewWorkspace from "@/presentation/components/ReviewWorkspace";
import { notFound } from "next/navigation";

export default async function ReviewPage({
  params,
}: {
  readonly params: Promise<{ readonly shareId: string }>;
}) {
  const { shareId } = await params;
  let canvas: Canvas;
  try {
    canvas = await useCases.getCanvas.execute({ shareId });
  } catch (error) {
    if (error instanceof ApplicationError && error.code === "CANVAS_NOT_FOUND") {
      notFound();
    }
    throw error;
  }
  const configuredProxy = process.env.SPOTCHECK_PROXY_ORIGIN;
  let proxyOrigin: string | null = null;
  if (configuredProxy) {
    const parsed = new URL(configuredProxy);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.origin !== configuredProxy) {
      throw new Error("SPOTCHECK_PROXY_ORIGIN debe ser un origen HTTP(S) sin ruta.");
    }
    proxyOrigin = parsed.origin;
  }
  return <ReviewWorkspace canvas={canvas} proxyOrigin={proxyOrigin} />;
}

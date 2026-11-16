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
  return <ReviewWorkspace canvas={canvas} />;
}

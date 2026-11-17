import type { Canvas } from "../../domain/entities/Canvas";
import { normalizePageRoute } from "../../domain/normalizePageRoute";
import { CanvasNotFoundError } from "../errors";
import type { CanvasRepository } from "../ports/CanvasRepository";
import type { PinsByRouteQuery } from "../ports/PinsByRouteQuery";

export class GetPinsByRoute {
  constructor(
    private readonly canvases: CanvasRepository,
    private readonly pins: PinsByRouteQuery,
  ) {}

  async execute(input: { readonly shareId: string; readonly pageRoute: string }): Promise<Canvas> {
    const canvas = await this.canvases.findMetadataByShareId(input.shareId);
    if (!canvas) throw new CanvasNotFoundError(input.shareId);
    const pins = await this.pins.findPinsByCanvasIdAndPageRoute(
      canvas.id,
      normalizePageRoute(input.pageRoute),
    );
    return { ...canvas, pins };
  }
}
